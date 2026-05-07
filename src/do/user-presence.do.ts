import db from "@/db";
import {
    getUnreadCountForRecipient,
    markConversationRead,
} from "@/lib/chat-read-state";
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
import type { Message, ReplyMessage } from "@/types/messages.type";
import { applyMessageReactionToDb } from "@/lib/message-reactions";
import { logMediaDebug } from "@/lib/message-media-debug";
import { DurableObject } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { parseManagedMessageMediaUrl } from "@/lib/message-media-url";
import { normalizeReplyMessage } from "@/lib/message-reply";
import { normalizeOpenGraphData } from "@/lib/open-graph-data";
import { sendMessagePushNotifications } from "@/lib/expo-push-notifications";

type ClientPlatform = "web" | "mobile";

type SessionState = {
    userId: string;
    phoneNumber: string | null;
    platform: ClientPlatform;
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
          type: "REACT_MESSAGE";
          conversationId: string;
          conversationType: "direct" | "group";
          messageId: string;
          reactionEmoji: string;
      }
    | {
          type: "MARK_READ";
          conversationId: string;
          messageId?: string;
      }
    | {
          type: "MARK_DELIVERED";
          conversationId: string;
          messageId?: string;
      }
    | {
          type: "START_TYPING";
          conversationId: string;
      }
    | {
          type: "STOP_TYPING";
          conversationId: string;
      };

type SendMessagePayload = {
          type: "SEND_MESSAGE";
          debugTraceId?: string;
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
          mediaPreviewUrl?: string | null;
          mediaSizeBytes?: number | null;
          mediaWidth?: number | null;
          mediaHeight?: number | null;
          mediaFileName?: string | null;
          videoThumbnail?: string | null;
          isForwardMessage?: boolean;
          encryptedContent?: EncryptedContentEnvelope | null;
          recipientEncryptionKeys?: RecipientEncryptedAesKeyInput[] | null;
          encryptedChatPreview?: EncryptedContentEnvelope | null;
          chatPreviewRecipientKeys?: RecipientEncryptedAesKeyInput[] | null;
          replyMessage?: ReplyMessage | null;
          openGraphData?: Message["open_graph_data"];
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
    reply_message: Message["reply_message"];
    location: null;
    media_url: string | null;
    media_preview_url: string | null;
    media_size_bytes: number | null;
    media_width: number | null;
    media_height: number | null;
    media_file_name: string | null;
    video_thumbnail: string | null;
    message_raction: null;
    is_forward_message: boolean;
    message_text_content: string | null;
    open_graph_data: Message["open_graph_data"];
    user_ids_pin_it: string[] | null;
    user_ids_star_it: string[] | null;
    deleted: boolean;
    user_id_delete_it: string | null;
    edited: boolean;
    user_id_edit_it: string | null;
    created_at: string;
    updated_at: string;
    contact: null;
    is_read_by_recipient: boolean;
    read_by_user_ids: string[];
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
        const platform = normalizeClientPlatform(url.searchParams.get("platform"));

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];

        this.sessions.set(server, {
            userId,
            phoneNumber,
            platform,
            activeConversationId: null,
        });
        this.ctx.acceptWebSocket(server);

        if (platform === "mobile") {
            await this.flushQueuedMobileMessageEvents(server);
        }

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

                case "REACT_MESSAGE": {
                    await this.handleReactMessage(session, data);
                    break;
                }

                case "START_TYPING": {
                    await this.updateTypingState(
                        session,
                        data.conversationId,
                        "start"
                    );
                    break;
                }

                case "STOP_TYPING": {
                    await this.updateTypingState(
                        session,
                        data.conversationId,
                        "stop"
                    );
                    break;
                }

                case "MARK_DELIVERED":
                case "MARK_READ": {
                    const readAt = new Date();
                    if (data.type === "MARK_READ") {
                        await markConversationRead({
                            chatId: data.conversationId,
                            userId: session.userId,
                            readAt,
                        });
                    }

                    const event = {
                        type: data.type,
                        conversationId: data.conversationId,
                        messageId: data.messageId ?? null,
                        userId: session.userId,
                        ...(data.type === "MARK_READ"
                            ? { readAt: readAt.toISOString() }
                            : {}),
                    };

                    if (data.type === "MARK_READ") {
                        await this.broadcastRoomEvent(data.conversationId, event);
                    } else {
                        await this.receiveEvent(event);
                    }
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
        if (shouldQueueMobileMessageEvent(event) && !this.hasMobileSession()) {
            await this.queueMobileMessageEvent(event);
        }

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
        const isMediaMessage = Boolean(data.attachedMedia);
        if (data.senderUserId && data.senderUserId !== session.userId) {
            throw new Error("senderUserId must match the active session.");
        }

        if (isMediaMessage) {
            logMediaDebug("server.realtime.send-message.received", {
                debugTraceId: data.debugTraceId ?? null,
                senderUserId,
                recipientUserId: data.recipientUserId ?? null,
                conversationId: data.conversationId ?? null,
                attachedMedia: data.attachedMedia ?? null,
                mediaUrl: data.mediaUrl ?? null,
                mediaPreviewUrl: data.mediaPreviewUrl ?? null,
                mediaSizeBytes: data.mediaSizeBytes ?? null,
                mediaWidth: data.mediaWidth ?? null,
                mediaHeight: data.mediaHeight ?? null,
                mediaFileName: data.mediaFileName ?? null,
                recipientEncryptionKeyCount:
                    data.recipientEncryptionKeys?.length ?? 0,
            });
        }

        const encryptionValidationError = validateEncryptedMessagePayload({
            content: data.content ?? null,
            messageTextContent: data.messageTextContent ?? null,
            attachedMedia: data.attachedMedia ?? null,
            encryptedContent: data.encryptedContent ?? null,
            recipientEncryptionKeys: data.recipientEncryptionKeys ?? null,
            encryptedChatPreview: data.encryptedChatPreview ?? null,
            chatPreviewRecipientKeys: data.chatPreviewRecipientKeys ?? null,
        });

        if (!data.attachedMedia && !data.encryptedContent?.ciphertext) {
            throw new Error(
                "A message must include encrypted content or attached media."
            );
        }

        const attachmentValidationError = validateEncryptedAttachmentPayload({
            attachedMedia: data.attachedMedia ?? null,
            mediaUrl: data.mediaUrl ?? null,
            mediaPreviewUrl: data.mediaPreviewUrl ?? null,
            videoThumbnail: data.videoThumbnail ?? null,
        });
        if (attachmentValidationError) {
            throw new Error(attachmentValidationError);
        }

        if (encryptionValidationError) {
            throw new Error(encryptionValidationError);
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
        const groupParticipantIds =
            data.conversationType === "group"
                ? await getGroupParticipantIds(conversationId)
                : [];

        if (
            data.conversationType === "group" &&
            !groupParticipantIds.includes(senderUserId)
        ) {
            throw new Error("You are not a member of this group.");
        }

        if (
            data.conversationType === "group" &&
            !recipientKeysCoverParticipants(
                normalizeRecipientKeys(data.recipientEncryptionKeys ?? null),
                groupParticipantIds
            )
        ) {
            throw new Error("Group messages must be encrypted for every member.");
        }

        if (
            data.conversationType === "group" &&
            data.chatPreviewRecipientKeys?.length &&
            !recipientKeysCoverParticipants(
                normalizeRecipientKeys(data.chatPreviewRecipientKeys),
                groupParticipantIds
            )
        ) {
            throw new Error("Group previews must be encrypted for every member.");
        }

        const savedMessage = await saveMessageToDb({
            debugTraceId: data.debugTraceId,
            messageId: data.clientMessageId,
            senderUserId,
            chatRoomId: conversationId,
            chatType:
                data.conversationType === "group" ? "group" : "single",
            attachedMedia: data.attachedMedia ?? null,
            mediaUrl: data.mediaUrl ?? null,
            mediaPreviewUrl: data.mediaPreviewUrl ?? null,
            mediaSizeBytes: data.mediaSizeBytes ?? null,
            mediaWidth: data.mediaWidth ?? null,
            mediaHeight: data.mediaHeight ?? null,
            mediaFileName: data.mediaFileName ?? null,
            videoThumbnail: data.videoThumbnail ?? null,
            isForwardMessage: data.isForwardMessage,
            encryptedContent: data.encryptedContent ?? null,
            recipientEncryptionKeys: data.recipientEncryptionKeys ?? null,
            encryptedChatPreview: data.encryptedChatPreview ?? null,
            chatPreviewRecipientKeys: data.chatPreviewRecipientKeys ?? null,
            replyMessage: data.replyMessage ?? null,
            openGraphData: data.openGraphData ?? null,
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

        if (isMediaMessage) {
            logMediaDebug("server.realtime.send-message.saved", {
                debugTraceId: data.debugTraceId ?? null,
                messageId: savedMessage.message_id,
                conversationId,
                attachedMedia: savedMessage.attached_media,
                mediaUrl: savedMessage.media_url,
                mediaPreviewUrl: savedMessage.media_preview_url,
                mediaSizeBytes: savedMessage.media_size_bytes,
                messageRecipientKeyCount:
                    savedMessage.message_recipient_keys?.length ?? 0,
            });
        }
        await this.updateTypingState(session, conversationId, "stop");
        await markConversationRead({
            chatId: conversationId,
            userId: senderUserId,
        });

        const recipients =
            data.conversationType === "group"
                ? groupParticipantIds
                : directRecipientId
                  ? [directRecipientId]
                  : [];
        if (recipients.length > 0) {
            const unreadCountsByRecipient = new Map<string, number>();

            await Promise.all(
                [...new Set(recipients)]
                    .filter(
                        (participantId) =>
                            participantId && participantId !== senderUserId
                    )
                    .map(async (participantId) => {
                        unreadCountsByRecipient.set(
                            participantId,
                            await getUnreadCountForRecipient({
                                chatId: conversationId,
                                userId: participantId,
                            })
                        );
                    })
            );

            await this.notifyParticipants(recipients, senderUserId, {
                type: "CONVERSATION_UPDATED",
                conversationId,
                conversationType: data.conversationType,
                lastMessage: savedMessage,
                unreadCountByRecipient: Object.fromEntries(
                    unreadCountsByRecipient
                ),
            });
        }

        try {
            await sendMessagePushNotifications({
                conversationId,
                conversationType: data.conversationType,
                message: savedMessage,
                recipientUserIds: (savedMessage.message_recipient_keys ?? [])
                    .map((key) => key.recipient_user_id)
                    .filter(
                        (recipientUserId) =>
                            recipientUserId !== senderUserId
                    ),
                senderDisplayName: data.senderNickname ?? senderUserId,
            });
        } catch {
            // Expo push is best-effort; the encrypted message is already saved.
        }
    }

    private async handleReactMessage(
        session: SessionState,
        data: Extract<PresenceIncomingMessage, { type: "REACT_MESSAGE" }>
    ) {
        const appliedReaction = await applyMessageReactionToDb({
            chatRoomId: data.conversationId,
            messageId: data.messageId,
            reactorUserId: session.userId,
            reactionEmoji: data.reactionEmoji,
        });
        const event = {
            type: "MESSAGE_REACTION_UPDATED",
            conversationId: appliedReaction.conversationId,
            conversationType: appliedReaction.conversationType,
            messageId: appliedReaction.messageId,
            targetSenderUserId: appliedReaction.targetSenderUserId,
            reaction: appliedReaction.reaction,
            updatedAt: appliedReaction.updatedAt.toISOString(),
        };

        await this.broadcastRoomEvent(appliedReaction.conversationId, event);

        await Promise.all(
            appliedReaction.participantUserIds
                .filter(
                    (participantId) =>
                        participantId && participantId !== session.userId
                )
                .map(async (participantId) => {
                    const userDO = this.env.USER_PRESENCE_DO.get(
                        this.env.USER_PRESENCE_DO.idFromName(participantId)
                    );
                    const unreadCount = await getUnreadCountForRecipient({
                        chatId: appliedReaction.conversationId,
                        userId: participantId,
                    });

                    await userDO.fetch("https://do/event", {
                        method: "POST",
                        headers: {
                            "content-type": "application/json",
                        },
                        body: JSON.stringify({
                            ...event,
                            unreadCount,
                        }),
                    });
                })
        );
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
                    body: JSON.stringify({
                        ...event,
                        unreadCount:
                            typeof event.unreadCountByRecipient === "object" &&
                            event.unreadCountByRecipient !== null
                                ? (event.unreadCountByRecipient as Record<
                                      string,
                                      number
                                  >)[participantId] ?? event.unreadCount ?? 0
                                : event.unreadCount,
                    }),
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

        await this.updateTypingState(session, conversationId, "stop");
        await this.notifyRoom("/user-left", conversationId, session.userId);
        if (session.activeConversationId === conversationId) {
            session.activeConversationId = null;
        }
    }

    private async notifyRoom(
        pathname:
            | "/user-joined"
            | "/user-left"
            | "/typing-start"
            | "/typing-stop",
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

    private async broadcastRoomEvent(roomId: string, event: ChatEvent) {
        const roomDO = this.env.CHAT_ROOM_DO.get(
            this.env.CHAT_ROOM_DO.idFromName(roomId)
        );

        await roomDO.fetch("https://do/broadcast", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(event),
        });
    }

    private async updateTypingState(
        session: SessionState,
        conversationId: string,
        action: "start" | "stop"
    ) {
        if (!conversationId) {
            return;
        }

        if (
            action === "start" &&
            session.activeConversationId &&
            session.activeConversationId !== conversationId
        ) {
            throw new Error("Cannot start typing in an inactive conversation.");
        }

        if (
            action === "start" &&
            session.activeConversationId !== conversationId
        ) {
            session.activeConversationId = conversationId;
        }

        await this.notifyRoom(
            action === "start" ? "/typing-start" : "/typing-stop",
            conversationId,
            session.userId
        );
    }

    private hasMobileSession() {
        return this.ctx
            .getWebSockets()
            .some((ws) => this.sessions.get(ws)?.platform === "mobile");
    }

    private async queueMobileMessageEvent(event: ChatEvent) {
        const messageId = getQueuedMessageId(event);
        if (!messageId) {
            return;
        }

        const queuedEvents = await this.getQueuedMobileMessageEvents();
        if (
            queuedEvents.some(
                (queuedEvent) => getQueuedMessageId(queuedEvent) === messageId
            )
        ) {
            return;
        }

        queuedEvents.push(event);
        await this.ctx.storage.put("mobileMessageQueue", queuedEvents);
    }

    private async flushQueuedMobileMessageEvents(ws: WebSocket) {
        const queuedEvents = await this.getQueuedMobileMessageEvents();
        if (queuedEvents.length === 0) {
            return;
        }

        const undeliveredEvents: ChatEvent[] = [];

        for (const event of queuedEvents) {
            try {
                ws.send(JSON.stringify(event));
            } catch {
                undeliveredEvents.push(event);
            }
        }

        if (undeliveredEvents.length > 0) {
            await this.ctx.storage.put("mobileMessageQueue", undeliveredEvents);
            return;
        }

        await this.ctx.storage.delete("mobileMessageQueue");
    }

    private async getQueuedMobileMessageEvents() {
        return (
            (await this.ctx.storage.get<ChatEvent[]>("mobileMessageQueue")) ?? []
        );
    }
}

function buildDirectRoomId(senderParticipant: string, recipientParticipant: string) {
    return [senderParticipant, recipientParticipant]
        .filter(Boolean)
        .sort()
        .join("::");
}

function normalizeClientPlatform(platform: string | null): ClientPlatform {
    return platform === "mobile" ? "mobile" : "web";
}

function shouldQueueMobileMessageEvent(event: ChatEvent) {
    return (
        event.type === "CONVERSATION_UPDATED" &&
        typeof event.conversationId === "string" &&
        typeof event.conversationType === "string" &&
        typeof event.lastMessage === "object" &&
        event.lastMessage !== null
    );
}

function getQueuedMessageId(event: ChatEvent) {
    if (!shouldQueueMobileMessageEvent(event)) {
        return null;
    }

    const message = event.lastMessage as { message_id?: unknown };
    return typeof message.message_id === "string" ? message.message_id : null;
}

async function saveMessageToDb({
    debugTraceId,
    messageId,
    senderUserId,
    chatRoomId,
    chatType,
    attachedMedia,
    mediaUrl,
    mediaPreviewUrl,
    mediaSizeBytes,
    mediaWidth,
    mediaHeight,
    mediaFileName,
    videoThumbnail,
    isForwardMessage,
    encryptedContent,
    recipientEncryptionKeys,
    encryptedChatPreview,
    chatPreviewRecipientKeys,
    replyMessage,
    openGraphData,
}: {
    debugTraceId?: string;
    messageId?: string;
    senderUserId: string;
    chatRoomId: string;
    chatType: "single" | "group";
    attachedMedia: Message["attached_media"];
    mediaUrl: string | null;
    mediaPreviewUrl: string | null;
    mediaSizeBytes: number | null;
    mediaWidth: number | null;
    mediaHeight: number | null;
    mediaFileName: string | null;
    videoThumbnail: string | null;
    isForwardMessage?: boolean;
    encryptedContent: EncryptedContentEnvelope | null;
    recipientEncryptionKeys: RecipientEncryptedAesKeyInput[] | null;
    encryptedChatPreview: EncryptedContentEnvelope | null;
    chatPreviewRecipientKeys: RecipientEncryptedAesKeyInput[] | null;
    replyMessage: ReplyMessage | null;
    openGraphData: Message["open_graph_data"];
}): Promise<StoredMessage> {
    const finalMessageId = messageId ?? crypto.randomUUID();
    const now = new Date();
    const normalizedMessageKeys = normalizeRecipientKeys(
        recipientEncryptionKeys
    );
    const normalizedChatPreviewKeys = normalizeRecipientKeys(
        chatPreviewRecipientKeys
    );
    const normalizedReplyMessage = normalizeReplyMessage(replyMessage);
    const normalizedOpenGraphData = normalizeOpenGraphData(openGraphData);
    const isMediaMessage = Boolean(attachedMedia);

    if (isMediaMessage) {
        logMediaDebug("server.realtime.db-save.start", {
            debugTraceId: debugTraceId ?? null,
            messageId: finalMessageId,
            chatRoomId,
            chatType,
            attachedMedia,
            mediaUrl,
            mediaPreviewUrl,
            mediaSizeBytes,
            mediaWidth,
            mediaHeight,
            mediaFileName,
            recipientEncryptionKeyCount: normalizedMessageKeys.length,
        });
    }

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
            last_message_context: "",
            last_message_media: attachedMedia,
            last_message_sender_is_me: false,
            last_message_sender_nickname: senderUserId,
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
                last_message_context: "",
                last_message_media: attachedMedia,
                last_message_sender_is_me: false,
                last_message_sender_nickname: senderUserId,
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
        reply_message: normalizedReplyMessage,
        location: null,
        media_url: mediaUrl,
        media_preview_url: mediaPreviewUrl,
        media_size_bytes: mediaSizeBytes,
        media_width: mediaWidth,
        media_height: mediaHeight,
        media_file_name: mediaFileName,
        video_thumbnail: videoThumbnail,
        message_raction: null,
        is_forward_message: Boolean(isForwardMessage),
        message_text_content: null,
        open_graph_data: normalizedOpenGraphData,
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

    if (isMediaMessage) {
        logMediaDebug("server.realtime.db-save.complete", {
            debugTraceId: debugTraceId ?? null,
            messageId: finalMessageId,
            chatRoomId,
            attachedMedia,
            mediaUrl,
            mediaPreviewUrl,
            mediaSizeBytes,
            mediaWidth,
            mediaHeight,
            mediaFileName,
            recipientEncryptionKeyCount: normalizedMessageKeys.length,
        });
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
        reply_message: normalizedReplyMessage,
        location: null,
        media_url: mediaUrl,
        media_preview_url: mediaPreviewUrl,
        media_size_bytes: mediaSizeBytes,
        media_width: mediaWidth,
        media_height: mediaHeight,
        media_file_name: mediaFileName,
        video_thumbnail: videoThumbnail,
        message_raction: null,
        is_forward_message: Boolean(isForwardMessage),
        message_text_content: null,
        open_graph_data: normalizedOpenGraphData,
        user_ids_pin_it: null,
        user_ids_star_it: null,
        deleted: false,
        user_id_delete_it: null,
        edited: false,
        user_id_edit_it: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        contact: null,
        is_read_by_recipient: false,
        read_by_user_ids: [],
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

async function getGroupParticipantIds(chatId: string) {
    const rows = await db
        .select({
            userId: chatRecipientKeys.recipient_user_id,
        })
        .from(chatRecipientKeys)
        .where(eq(chatRecipientKeys.chat_id, chatId));

    return [...new Set(rows.map((row) => row.userId).filter(Boolean))];
}

function recipientKeysCoverParticipants(
    keys: RecipientEncryptedAesKey[],
    participantIds: string[]
) {
    if (participantIds.length === 0) {
        return false;
    }

    const recipientIds = new Set(
        keys.map((key) => key.recipient_user_id).filter(Boolean)
    );

    return participantIds.every((participantId) =>
        recipientIds.has(participantId)
    );
}

function validateEncryptedAttachmentPayload({
    attachedMedia,
    mediaUrl,
    mediaPreviewUrl,
    videoThumbnail,
}: {
    attachedMedia: Message["attached_media"];
    mediaUrl: string | null;
    mediaPreviewUrl: string | null;
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

    if (
        mediaPreviewUrl &&
        !mediaPreviewUrl.startsWith("/api/message-media-preview/")
    ) {
        return "Media previews must use the managed preview route.";
    }

    if (videoThumbnail && !parseManagedMessageMediaUrl(videoThumbnail)) {
        return "Video thumbnails must use an encrypted /api/message-media URL.";
    }

    return null;
}

function validateEncryptedMessagePayload({
    content,
    messageTextContent,
    attachedMedia,
    encryptedContent,
    recipientEncryptionKeys,
    encryptedChatPreview,
    chatPreviewRecipientKeys,
}: {
    content: string | null;
    messageTextContent: string | null;
    attachedMedia: Message["attached_media"];
    encryptedContent: EncryptedContentEnvelope | null;
    recipientEncryptionKeys: RecipientEncryptedAesKeyInput[] | null;
    encryptedChatPreview: EncryptedContentEnvelope | null;
    chatPreviewRecipientKeys: RecipientEncryptedAesKeyInput[] | null;
}): string | null {
    if (content?.trim() || messageTextContent?.trim()) {
        return "Plaintext message payloads are not allowed. Send encryptedContent instead.";
    }

    if (encryptedContent?.ciphertext) {
        if (!recipientEncryptionKeys?.length) {
            return "Encrypted messages must include recipientEncryptionKeys.";
        }

        if (!encryptedChatPreview?.ciphertext || !chatPreviewRecipientKeys?.length) {
            return "Encrypted text messages must include an encrypted chat preview and recipient keys.";
        }
    }

    if (!encryptedContent?.ciphertext && !attachedMedia) {
        return "Messages must include encrypted content or attached media.";
    }

    return null;
}
