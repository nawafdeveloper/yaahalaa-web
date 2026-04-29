import db from "@/db";
import {
    chatRecipientKeys,
    chats,
    message as messageTable,
    messageRecipientKeys,
} from "@/db/schema";
import type {
    EncryptedContentEnvelope,
    RecipientEncryptedAesKey,
    RecipientEncryptedAesKeyInput,
    TextEncryptionAlgorithm,
} from "@/types/crypto";
import type { Message } from "@/types/messages.type";
import { DurableObject } from "cloudflare:workers";
import { parseManagedMessageMediaUrl } from "@/lib/message-media-url";

type SessionState = {
    userId: string;
    phoneNumber: string | null;
    activeConversationId: string | null;
};

type PresenceIncomingMessage =
    | {
          type: "JOIN_CONVERSATION";
          conversationId: string;
      }
    | {
          type: "LEAVE_CONVERSATION";
          conversationId?: string;
      }
    | SendMessagePayload
    | {
          type: "MARK_READ";
          conversationId: string;
          messageId?: string;
      }
    | {
          type: "MARK_DELIVERED";
          conversationId: string;
          messageId?: string;
      };

type SendMessagePayload = {
          type: "SEND_MESSAGE";
          clientMessageId?: string;
          conversationId?: string;
          conversationType: "direct" | "group";
          senderUserId?: string;
          senderNickname?: string;
          recipientUserId?: string;
          senderPhone?: string;
          recipientPhone?: string;
          participantIds?: string[];
          content?: string;
          messageTextContent?: string | null;
          attachedMedia?: Message["attached_media"];
          mediaUrl?: string | null;
          videoThumbnail?: string | null;
          encryptedContent?: EncryptedContentEnvelope | null;
          recipientEncryptionKeys?: RecipientEncryptedAesKeyInput[] | null;
          encryptedChatPreview?: EncryptedContentEnvelope | null;
          chatPreviewRecipientKeys?: RecipientEncryptedAesKeyInput[] | null;
      };

type ChatEvent = {
    type: string;
    [key: string]: unknown;
};

type StoredMessage = {
    message_id: string;
    sender_user_id: string;
    chat_room_id: string;
    encrypted_content_ciphertext: string | null;
    encrypted_content_iv: string | null;
    encrypted_content_algorithm: TextEncryptionAlgorithm | null;
    message_recipient_keys: RecipientEncryptedAesKey[] | null;
    attached_media: Message["attached_media"];
    event: null;
    poll: null;
    reply_message: null;
    location: null;
    media_url: string | null;
    video_thumbnail: string | null;
    message_raction: null;
    is_forward_message: boolean;
    message_text_content: string | null;
    open_graph_data: null;
    user_ids_pin_it: string[] | null;
    user_ids_star_it: string[] | null;
    deleted: boolean;
    user_id_delete_it: string | null;
    edited: boolean;
    user_id_edit_it: string | null;
    created_at: string;
    updated_at: string;
    contact: null;
};

type DurableBindingsEnv = {
    CHAT_ROOM_DO: DurableObjectNamespace;
    USER_PRESENCE_DO: DurableObjectNamespace;
};

export class UserPresenceDO extends DurableObject<DurableBindingsEnv> {
    private sessions = new Map<WebSocket, SessionState>();

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/event" && request.method === "POST") {
            const event = (await request.json()) as ChatEvent;
            await this.receiveEvent(event);
            return Response.json({ ok: true });
        }

        const upgradeHeader = request.headers.get("Upgrade");
        if (upgradeHeader !== "websocket") {
            return new Response("Expected WebSocket", { status: 426 });
        }

        const userId = url.searchParams.get("userId");
        if (!userId) {
            return Response.json(
                { error: "Missing userId query parameter" },
                { status: 400 }
            );
        }
        const phoneNumber = url.searchParams.get("phone");

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];

        this.sessions.set(server, {
            userId,
            phoneNumber,
            activeConversationId: null,
        });
        this.ctx.acceptWebSocket(server);

        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws: WebSocket, rawMessage: string) {
        const session = this.sessions.get(ws);
        if (!session) {
            ws.close(1011, "Unknown websocket session");
            return;
        }

        let data: PresenceIncomingMessage;
        try {
            data = JSON.parse(rawMessage) as PresenceIncomingMessage;
        } catch {
            ws.send(
                JSON.stringify({
                    type: "ERROR",
                    message: "Invalid JSON payload",
                })
            );
            return;
        }

        try {
            switch (data.type) {
                case "JOIN_CONVERSATION": {
                    await this.leaveConversationIfNeeded(session);
                    session.activeConversationId = data.conversationId;
                    await this.notifyRoom(
                        "/user-joined",
                        data.conversationId,
                        session.userId
                    );
                    break;
                }

                case "LEAVE_CONVERSATION": {
                    await this.leaveConversationIfNeeded(
                        session,
                        data.conversationId
                    );
                    break;
                }

                case "SEND_MESSAGE": {
                    await this.handleSendMessage(ws, session, data);
                    break;
                }

                case "MARK_DELIVERED":
                case "MARK_READ": {
                    await this.receiveEvent({
                        type: data.type,
                        conversationId: data.conversationId,
                        messageId: data.messageId ?? null,
                        userId: session.userId,
                    });
                    break;
                }

                default: {
                    ws.send(
                        JSON.stringify({
                            type: "ERROR",
                            message: "Unsupported message type",
                        })
                    );
                }
            }
        } catch (error) {
            ws.send(
                JSON.stringify({
                    type: "ERROR",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unexpected realtime error",
                })
            );
        }
    }

    async webSocketClose(ws: WebSocket) {
        const session = this.sessions.get(ws);
        if (session) {
            await this.leaveConversationIfNeeded(session);
            this.sessions.delete(ws);
        }
    }

    async webSocketError(ws: WebSocket) {
        const session = this.sessions.get(ws);
        if (session) {
            await this.leaveConversationIfNeeded(session);
            this.sessions.delete(ws);
        }
    }

    private async receiveEvent(event: ChatEvent) {
        const payload = JSON.stringify(event);

        for (const ws of this.ctx.getWebSockets()) {
            ws.send(payload);
        }
    }

    private async handleSendMessage(
        ws: WebSocket,
        session: SessionState,
        data: SendMessagePayload
    ) {
        const senderUserId = data.senderUserId ?? session.userId;
        if (data.senderUserId && data.senderUserId !== session.userId) {
            throw new Error("senderUserId must match the active session.");
        }

        const messageTextContent =
            data.messageTextContent ?? data.content ?? null;
        if (
            !messageTextContent &&
            !data.attachedMedia &&
            !data.encryptedContent?.ciphertext
        ) {
            throw new Error(
                "A message must include plaintext content, encrypted content, or attached media."
            );
        }

        const attachmentValidationError = validateEncryptedAttachmentPayload({
            attachedMedia: data.attachedMedia ?? null,
            mediaUrl: data.mediaUrl ?? null,
            videoThumbnail: data.videoThumbnail ?? null,
        });
        if (attachmentValidationError) {
            throw new Error(attachmentValidationError);
        }

        const directRecipientId = data.recipientUserId ?? data.recipientPhone;
        if (data.conversationType === "direct" && !directRecipientId) {
            throw new Error(
                "recipientUserId or recipientPhone is required for direct messages."
            );
        }

        const conversationId =
            data.conversationId ??
            (data.conversationType === "direct"
                ? buildDirectRoomId(senderUserId, directRecipientId!)
                : null);
        if (!conversationId) {
            throw new Error(
                "conversationId is required for group messages."
            );
        }

        const savedMessage = await saveMessageToDb({
            messageId: data.clientMessageId,
            senderUserId,
            senderNickname: data.senderNickname ?? senderUserId,
            chatRoomId: conversationId,
            chatType:
                data.conversationType === "group" ? "group" : "single",
            attachedMedia: data.attachedMedia ?? null,
            mediaUrl: data.mediaUrl ?? null,
            videoThumbnail: data.videoThumbnail ?? null,
            messageTextContent,
            encryptedContent: data.encryptedContent ?? null,
            recipientEncryptionKeys: data.recipientEncryptionKeys ?? null,
            encryptedChatPreview: data.encryptedChatPreview ?? null,
            chatPreviewRecipientKeys: data.chatPreviewRecipientKeys ?? null,
        });

        ws.send(
            JSON.stringify({
                type: "MESSAGE_SENT",
                conversationId,
                conversationType: data.conversationType,
                clientMessageId: data.clientMessageId ?? savedMessage.message_id,
                message: savedMessage,
            })
        );

        const roomDO = this.env.CHAT_ROOM_DO.get(
            this.env.CHAT_ROOM_DO.idFromName(conversationId)
        );

        await roomDO.fetch("https://do/broadcast", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                type: "NEW_MESSAGE",
                conversationId,
                conversationType: data.conversationType,
                message: savedMessage,
            }),
        });

        const recipients =
            data.conversationType === "group"
                ? data.participantIds ?? []
                : directRecipientId
                  ? [directRecipientId]
                  : [];
        if (recipients.length > 0) {
            await this.notifyParticipants(recipients, senderUserId, {
                type: "CONVERSATION_UPDATED",
                conversationId,
                conversationType: data.conversationType,
                lastMessage: savedMessage,
                unreadCount: 1,
            });
        }
    }

    private async notifyParticipants(
        participantIds: string[],
        senderUserId: string,
        event: ChatEvent
    ) {
        const uniqueRecipients = [...new Set(participantIds)].filter(
            (participantId) => participantId && participantId !== senderUserId
        );

        await Promise.all(
            uniqueRecipients.map(async (participantId) => {
                const userDO = this.env.USER_PRESENCE_DO.get(
                    this.env.USER_PRESENCE_DO.idFromName(participantId)
                );

                await userDO.fetch("https://do/event", {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify(event),
                });
            })
        );
    }

    private async leaveConversationIfNeeded(
        session: SessionState,
        requestedConversationId?: string
    ) {
        const conversationId =
            requestedConversationId ?? session.activeConversationId;
        if (!conversationId) {
            return;
        }

        await this.notifyRoom("/user-left", conversationId, session.userId);
        if (session.activeConversationId === conversationId) {
            session.activeConversationId = null;
        }
    }

    private async notifyRoom(
        pathname: "/user-joined" | "/user-left",
        roomId: string,
        userId: string
    ) {
        const roomDO = this.env.CHAT_ROOM_DO.get(
            this.env.CHAT_ROOM_DO.idFromName(roomId)
        );

        await roomDO.fetch(`https://do${pathname}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ userId, conversationId: roomId }),
        });
    }
}

function buildDirectRoomId(senderParticipant: string, recipientParticipant: string) {
    return [senderParticipant, recipientParticipant]
        .filter(Boolean)
        .sort()
        .join("::");
}

async function saveMessageToDb({
    messageId,
    senderUserId,
    senderNickname,
    chatRoomId,
    chatType,
    attachedMedia,
    mediaUrl,
    videoThumbnail,
    messageTextContent,
    encryptedContent,
    recipientEncryptionKeys,
    encryptedChatPreview,
    chatPreviewRecipientKeys,
}: {
    messageId?: string;
    senderUserId: string;
    senderNickname: string;
    chatRoomId: string;
    chatType: "single" | "group";
    attachedMedia: Message["attached_media"];
    mediaUrl: string | null;
    videoThumbnail: string | null;
    messageTextContent: string | null;
    encryptedContent: EncryptedContentEnvelope | null;
    recipientEncryptionKeys: RecipientEncryptedAesKeyInput[] | null;
    encryptedChatPreview: EncryptedContentEnvelope | null;
    chatPreviewRecipientKeys: RecipientEncryptedAesKeyInput[] | null;
}): Promise<StoredMessage> {
    const finalMessageId = messageId ?? crypto.randomUUID();
    const now = new Date();
    const normalizedMessageKeys = normalizeRecipientKeys(
        recipientEncryptionKeys
    );
    const normalizedChatPreviewKeys = normalizeRecipientKeys(
        chatPreviewRecipientKeys
    );

    await db
        .insert(chats)
        .values({
            chat_id: chatRoomId,
            chat_type: chatType,
            avatar: "",
            last_message_id: finalMessageId,
            encrypted_preview_ciphertext:
                encryptedChatPreview?.ciphertext ?? null,
            encrypted_preview_iv: encryptedChatPreview?.iv ?? null,
            encrypted_preview_algorithm:
                encryptedChatPreview?.algorithm ?? null,
            last_message_context: messageTextContent ?? "",
            last_message_media: attachedMedia,
            last_message_sender_is_me: false,
            last_message_sender_nickname: senderNickname,
            is_unreaded_chat: false,
            unreaded_messages_length: 0,
            is_archived_chat: false,
            is_muted_chat_notifications: false,
            is_pinned_chat: false,
            is_favourite_chat: false,
            is_blocked_chat: false,
            created_at: now,
            updated_at: now,
        })
        .onConflictDoUpdate({
            target: chats.chat_id,
            set: {
                chat_type: chatType,
                last_message_id: finalMessageId,
                encrypted_preview_ciphertext:
                    encryptedChatPreview?.ciphertext ?? null,
                encrypted_preview_iv: encryptedChatPreview?.iv ?? null,
                encrypted_preview_algorithm:
                    encryptedChatPreview?.algorithm ?? null,
                last_message_context: messageTextContent ?? "",
                last_message_media: attachedMedia,
                last_message_sender_is_me: false,
                last_message_sender_nickname: senderNickname,
                updated_at: now,
            },
        });

    await db.insert(messageTable).values({
        message_id: finalMessageId,
        sender_user_id: senderUserId,
        chat_room_id: chatRoomId,
        encrypted_content_ciphertext: encryptedContent?.ciphertext ?? null,
        encrypted_content_iv: encryptedContent?.iv ?? null,
        encrypted_content_algorithm: encryptedContent?.algorithm ?? null,
        attached_media: attachedMedia,
        event: null,
        poll: null,
        reply_message: null,
        location: null,
        media_url: mediaUrl,
        video_thumbnail: videoThumbnail,
        message_raction: null,
        is_forward_message: false,
        message_text_content: messageTextContent,
        open_graph_data: null,
        user_ids_pin_it: null,
        user_ids_star_it: null,
        deleted: false,
        user_id_delete_it: null,
        edited: false,
        user_id_edit_it: null,
        created_at: now,
        updated_at: now,
        contact: null,
    });

    if (normalizedMessageKeys.length > 0) {
        for (const key of normalizedMessageKeys) {
            await db
                .insert(messageRecipientKeys)
                .values({
                    id: crypto.randomUUID(),
                    message_id: finalMessageId,
                    recipient_user_id: key.recipient_user_id,
                    encrypted_aes_key: key.encrypted_aes_key,
                    algorithm: key.algorithm,
                    created_at: now,
                    updated_at: now,
                })
                .onConflictDoUpdate({
                    target: [
                        messageRecipientKeys.message_id,
                        messageRecipientKeys.recipient_user_id,
                    ],
                    set: {
                        encrypted_aes_key: key.encrypted_aes_key,
                        algorithm: key.algorithm,
                        updated_at: now,
                    },
                });
        }
    }

    if (normalizedChatPreviewKeys.length > 0) {
        for (const key of normalizedChatPreviewKeys) {
            await db
                .insert(chatRecipientKeys)
                .values({
                    id: crypto.randomUUID(),
                    chat_id: chatRoomId,
                    recipient_user_id: key.recipient_user_id,
                    encrypted_aes_key: key.encrypted_aes_key,
                    algorithm: key.algorithm,
                    created_at: now,
                    updated_at: now,
                })
                .onConflictDoUpdate({
                    target: [
                        chatRecipientKeys.chat_id,
                        chatRecipientKeys.recipient_user_id,
                    ],
                    set: {
                        encrypted_aes_key: key.encrypted_aes_key,
                        algorithm: key.algorithm,
                        updated_at: now,
                    },
                });
        }
    }

    return {
        message_id: finalMessageId,
        sender_user_id: senderUserId,
        chat_room_id: chatRoomId,
        encrypted_content_ciphertext: encryptedContent?.ciphertext ?? null,
        encrypted_content_iv: encryptedContent?.iv ?? null,
        encrypted_content_algorithm: encryptedContent?.algorithm ?? null,
        message_recipient_keys:
            normalizedMessageKeys.length > 0 ? normalizedMessageKeys : null,
        attached_media: attachedMedia,
        event: null,
        poll: null,
        reply_message: null,
        location: null,
        media_url: mediaUrl,
        video_thumbnail: videoThumbnail,
        message_raction: null,
        is_forward_message: false,
        message_text_content: messageTextContent,
        open_graph_data: null,
        user_ids_pin_it: null,
        user_ids_star_it: null,
        deleted: false,
        user_id_delete_it: null,
        edited: false,
        user_id_edit_it: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        contact: null,
    };
}

function normalizeRecipientKeys(
    keys: RecipientEncryptedAesKeyInput[] | null
): RecipientEncryptedAesKey[] {
    return (keys ?? [])
        .filter((key) => key.recipientUserId && key.encryptedAesKey)
        .map((key) => ({
            recipient_user_id: key.recipientUserId,
            encrypted_aes_key: key.encryptedAesKey,
            algorithm: key.algorithm ?? "aes-256-gcm+rsa-oaep-sha256",
        }));
}

function validateEncryptedAttachmentPayload({
    attachedMedia,
    mediaUrl,
    videoThumbnail,
}: {
    attachedMedia: Message["attached_media"];
    mediaUrl: string | null;
    videoThumbnail: string | null;
}): string | null {
    const mediaTypesRequiringBinaryPayload: Message["attached_media"][] = [
        "photo",
        "video",
        "voice",
        "file",
    ];

    if (
        attachedMedia &&
        mediaTypesRequiringBinaryPayload.includes(attachedMedia) &&
        !mediaUrl
    ) {
        return "Attached media messages must reference encrypted uploaded media.";
    }

    if (mediaUrl && !parseManagedMessageMediaUrl(mediaUrl)) {
        return "Attached media must use an encrypted /api/message-media URL.";
    }

    if (videoThumbnail && !parseManagedMessageMediaUrl(videoThumbnail)) {
        return "Video thumbnails must use an encrypted /api/message-media URL.";
    }

    return null;
}
