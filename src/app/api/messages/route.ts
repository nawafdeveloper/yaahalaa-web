import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/lib/auth";
import db from "@/db";
import {
    getUnreadCountForRecipient,
    markConversationRead,
} from "@/lib/chat-read-state";
import {
    chatReadStates,
    chatRecipientKeys,
    chatUserSettings,
    chats,
    message,
    messageRecipientKeys,
} from "@/db/schema";
import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import {
    areDirectChatIdsEquivalent,
    buildDirectChatIdVariants,
} from "@/lib/chat-utils";
import type {
    EncryptedContentEnvelope,
    RecipientEncryptedAesKey,
    RecipientEncryptedAesKeyInput,
} from "@/types/crypto";
import type { Message, ReplyMessage } from "@/types/messages.type";
import {
    applyMessageReactionToDb,
    MessageReactionError,
    type AppliedMessageReaction,
} from "@/lib/message-reactions";
import { parseManagedMessageMediaUrl } from "@/lib/message-media-url";
import {
    logMediaDebug,
    readMediaDebugTraceId,
} from "@/lib/message-media-debug";
import { withMessageReadReceipt } from "@/lib/message-read-receipts";
import { normalizeReplyMessage } from "@/lib/message-reply";
import { normalizeOpenGraphData } from "@/lib/open-graph-data";
import { sendMessagePushNotifications } from "@/lib/expo-push-notifications";

/**
 * The better-auth `phoneNumber` plugin adds `phoneNumber` at runtime
 * but the server-side types do not expose it automatically.
 */
interface UserWithPhone {
    id: string;
    name?: string | null;
    image?: string | null;
    phoneNumber?: string | null;
}

type RealtimeBindings = {
    CHAT_ROOM_DO?: DurableObjectNamespace;
    USER_PRESENCE_DO?: DurableObjectNamespace;
};

// ---------------------------------------------------------------------------
// POST  /api/messages
// Store a new message.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
    const debugTraceId = readMediaDebugTraceId(request);
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
        debugTraceId?: string;
        clientMessageId?: string;
        senderUserId?: string;
        senderNickname?: string;
        senderAvatarUrl?: string | null;
        chatRoomId?: string;
        conversationType?: "direct" | "group";
        senderPhone?: string;
        recipientPhone?: string;
        notificationPlaintext?: string | null;
        content?: string | null;
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

    const sessionUser = session.user as unknown as UserWithPhone;
    const {
        debugTraceId: bodyDebugTraceId,
        senderUserId,
        clientMessageId,
        senderNickname,
        senderAvatarUrl,
        chatRoomId,
        conversationType,
        senderPhone,
        recipientPhone,
        notificationPlaintext,
        content,
        messageTextContent,
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
    } = body;
    const effectiveDebugTraceId = bodyDebugTraceId ?? debugTraceId ?? null;
    const finalSenderUserId = senderUserId ?? sessionUser.id;
    const finalChatRoomId =
        chatRoomId ??
        (senderPhone && recipientPhone
            ? buildDirectChatRoomId(senderPhone, recipientPhone)
            : null);
    const attachmentValidationError = validateEncryptedAttachmentPayload({
        attachedMedia: attachedMedia ?? null,
        mediaUrl: mediaUrl ?? null,
        mediaPreviewUrl: mediaPreviewUrl ?? null,
        videoThumbnail: videoThumbnail ?? null,
    });
    const encryptionValidationError = validateEncryptedMessagePayload({
        content: content ?? null,
        messageTextContent: messageTextContent ?? null,
        attachedMedia: attachedMedia ?? null,
        encryptedContent: encryptedContent ?? null,
        recipientEncryptionKeys: recipientEncryptionKeys ?? null,
        encryptedChatPreview: encryptedChatPreview ?? null,
        chatPreviewRecipientKeys: chatPreviewRecipientKeys ?? null,
    });

    if (
        !finalChatRoomId ||
        (!attachedMedia && !encryptedContent?.ciphertext)
    ) {
        return Response.json(
            { error: "Missing required message fields" },
            { status: 400 },
        );
    }

    if (attachmentValidationError) {
        return Response.json(
            { error: attachmentValidationError },
            { status: 400 },
        );
    }

    if (encryptionValidationError) {
        return Response.json(
            { error: encryptionValidationError },
            { status: 400 },
        );
    }

    if (finalSenderUserId !== sessionUser.id) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = clientMessageId ?? crypto.randomUUID();
    const now = new Date();
    let normalizedMessageKeys = normalizeRecipientKeys(
        recipientEncryptionKeys
    );
    let normalizedChatPreviewKeys = normalizeRecipientKeys(
        chatPreviewRecipientKeys
    );
    const normalizedReplyMessage = normalizeReplyMessage(replyMessage);
    const normalizedOpenGraphData = normalizeOpenGraphData(openGraphData);
    const isMediaMessage = Boolean(attachedMedia);
    let groupParticipantIds: string[] = [];

    if (conversationType === "group") {
        const participantRows = await db
            .select({
                userId: chatRecipientKeys.recipient_user_id,
            })
            .from(chatRecipientKeys)
            .where(eq(chatRecipientKeys.chat_id, finalChatRoomId));

        groupParticipantIds = [
            ...new Set(participantRows.map((row) => row.userId)),
        ];

        if (!groupParticipantIds.includes(finalSenderUserId)) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        if (
            !recipientKeysCoverParticipants(
                normalizedMessageKeys,
                groupParticipantIds
            )
        ) {
            return Response.json(
                { error: "Group messages must be encrypted for every member." },
                { status: 400 }
            );
        }

        if (
            normalizedChatPreviewKeys.length > 0 &&
            !recipientKeysCoverParticipants(
                normalizedChatPreviewKeys,
                groupParticipantIds
            )
        ) {
            return Response.json(
                { error: "Group previews must be encrypted for every member." },
                { status: 400 }
            );
        }
    } else {
        const blockedRecipientIds = await getBlockedDirectRecipientIds({
            chatId: finalChatRoomId,
            senderUserId: finalSenderUserId,
            recipientUserIds: normalizedMessageKeys
                .map((key) => key.recipient_user_id)
                .filter((recipientUserId) => recipientUserId !== finalSenderUserId),
        });

        if (blockedRecipientIds.size > 0) {
            normalizedMessageKeys = normalizedMessageKeys.filter(
                (key) => !blockedRecipientIds.has(key.recipient_user_id)
            );
            normalizedChatPreviewKeys = normalizedChatPreviewKeys.filter(
                (key) => !blockedRecipientIds.has(key.recipient_user_id)
            );
        }
    }

    if (isMediaMessage) {
        logMediaDebug("server.http.messages.post.start", {
            debugTraceId: effectiveDebugTraceId,
            senderUserId: finalSenderUserId,
            chatRoomId: finalChatRoomId,
            conversationType: conversationType ?? null,
            attachedMedia: attachedMedia ?? null,
            mediaUrl: mediaUrl ?? null,
            mediaPreviewUrl: mediaPreviewUrl ?? null,
            mediaSizeBytes: mediaSizeBytes ?? null,
            mediaWidth: mediaWidth ?? null,
            mediaHeight: mediaHeight ?? null,
            mediaFileName: mediaFileName ?? null,
            recipientEncryptionKeyCount: normalizedMessageKeys.length,
        });
    }

    await db
        .insert(chats)
        .values({
            chat_id: finalChatRoomId,
            chat_type: conversationType === "group" ? "group" : "single",
            avatar: "",
            last_message_id: id,
            encrypted_preview_ciphertext:
                encryptedChatPreview?.ciphertext ?? null,
            encrypted_preview_iv: encryptedChatPreview?.iv ?? null,
            encrypted_preview_algorithm:
                encryptedChatPreview?.algorithm ?? null,
            last_message_context: "",
            last_message_media: attachedMedia ?? null,
            last_message_sender_is_me: false,
            last_message_sender_nickname: finalSenderUserId,
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
                chat_type: conversationType === "group" ? "group" : "single",
                last_message_id: id,
                encrypted_preview_ciphertext:
                    encryptedChatPreview?.ciphertext ?? null,
                encrypted_preview_iv: encryptedChatPreview?.iv ?? null,
                encrypted_preview_algorithm:
                    encryptedChatPreview?.algorithm ?? null,
                last_message_context: "",
                last_message_media: attachedMedia ?? null,
                last_message_sender_is_me: false,
                last_message_sender_nickname: finalSenderUserId,
                updated_at: now,
            },
        });

    await db.insert(message).values({
        message_id: id,
        sender_user_id: finalSenderUserId,
        chat_room_id: finalChatRoomId,
        encrypted_content_ciphertext: encryptedContent?.ciphertext ?? null,
        encrypted_content_iv: encryptedContent?.iv ?? null,
        encrypted_content_algorithm: encryptedContent?.algorithm ?? null,
        attached_media: attachedMedia ?? null,
        event: null,
        poll: null,
        reply_message: normalizedReplyMessage,
        location: null,
        media_url: mediaUrl ?? null,
        media_preview_url: mediaPreviewUrl ?? null,
        media_size_bytes: mediaSizeBytes ?? null,
        media_width: mediaWidth ?? null,
        media_height: mediaHeight ?? null,
        media_file_name: mediaFileName ?? null,
        video_thumbnail: videoThumbnail ?? null,
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

    for (const key of normalizedMessageKeys) {
        await db
            .insert(messageRecipientKeys)
            .values({
                id: crypto.randomUUID(),
                message_id: id,
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

    for (const key of normalizedChatPreviewKeys) {
        await db
            .insert(chatRecipientKeys)
            .values({
                id: crypto.randomUUID(),
                chat_id: finalChatRoomId,
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

    const deliveredRecipientUserIds = [
        ...new Set(
            normalizedMessageKeys
                .map((key) => key.recipient_user_id)
                .filter((recipientUserId) => recipientUserId !== finalSenderUserId)
        ),
    ];

    await restoreDeletedChatForParticipants({
        chatId: finalChatRoomId,
        userIds: [finalSenderUserId, ...deliveredRecipientUserIds],
    });

    const responseMessage = {
        message_id: id,
        sender_user_id: finalSenderUserId,
        chat_room_id: finalChatRoomId,
        encrypted_content_ciphertext: encryptedContent?.ciphertext ?? null,
        encrypted_content_iv: encryptedContent?.iv ?? null,
        encrypted_content_algorithm: encryptedContent?.algorithm ?? null,
        message_recipient_keys:
            normalizedMessageKeys.length > 0 ? normalizedMessageKeys : null,
        attached_media: attachedMedia ?? null,
        event: null,
        poll: null,
        reply_message: normalizedReplyMessage,
        location: null,
        media_url: mediaUrl ?? null,
        media_preview_url: mediaPreviewUrl ?? null,
        media_size_bytes: mediaSizeBytes ?? null,
        media_width: mediaWidth ?? null,
        media_height: mediaHeight ?? null,
        media_file_name: mediaFileName ?? null,
        video_thumbnail: videoThumbnail ?? null,
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
        is_read_by_recipient: false,
        is_delivered_to_recipient: deliveredRecipientUserIds.length > 0,
        read_by_user_ids: [],
    };

    if (isMediaMessage) {
        logMediaDebug("server.http.messages.post.saved", {
            debugTraceId: effectiveDebugTraceId,
            messageId: id,
            chatRoomId: finalChatRoomId,
            attachedMedia: attachedMedia ?? null,
            mediaUrl: mediaUrl ?? null,
            mediaPreviewUrl: mediaPreviewUrl ?? null,
            mediaSizeBytes: mediaSizeBytes ?? null,
            mediaWidth: mediaWidth ?? null,
            mediaHeight: mediaHeight ?? null,
            mediaFileName: mediaFileName ?? null,
            messageRecipientKeyCount: normalizedMessageKeys.length,
        });
    }

    await markConversationRead({
        chatId: finalChatRoomId,
        userId: finalSenderUserId,
        readAt: now,
    });

    await broadcastRealtimeMessage({
        conversationId: finalChatRoomId,
        conversationType: conversationType === "group" ? "group" : "direct",
        message: {
            ...responseMessage,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        },
        recipientUserIds: normalizedMessageKeys
            .map((key) => key.recipient_user_id)
            .filter((recipientUserId) => recipientUserId !== finalSenderUserId),
    });

    try {
        await sendMessagePushNotifications({
            conversationId: finalChatRoomId,
            conversationType: conversationType === "group" ? "group" : "direct",
            message: responseMessage,
            notificationPlaintext: notificationPlaintext ?? null,
            recipientUserIds: normalizedMessageKeys
                .map((key) => key.recipient_user_id)
                .filter(
                    (recipientUserId) => recipientUserId !== finalSenderUserId
                ),
            senderAvatarUrl: senderAvatarUrl ?? sessionUser.image ?? null,
            senderDisplayName:
                senderNickname ?? sessionUser.name ?? finalSenderUserId,
        });
    } catch {
        // Expo push is best-effort; the encrypted message is already saved.
    }

    return Response.json({
        success: true,
        id,
        chatRoomId: finalChatRoomId,
        message: responseMessage,
    });
}

export async function PATCH(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
        action?: "reaction" | "star" | "pin";
        chatRoomId?: string;
        messageId?: string;
        reactionEmoji?: string;
        starred?: boolean;
        pinned?: boolean;
    };
    const sessionUser = session.user as unknown as UserWithPhone;

    if (body.action === "star" || body.action === "pin") {
        const result = await updateMessageUserFlag({
            chatRoomId: body.chatRoomId ?? "",
            messageId: body.messageId ?? "",
            userId: sessionUser.id,
            flag: body.action,
            enabled:
                body.action === "star"
                    ? Boolean(body.starred)
                    : Boolean(body.pinned),
        });

        if (!result) {
            return Response.json(
                { error: "Message not found." },
                { status: 404 }
            );
        }

        if (body.action === "pin") {
            await broadcastRealtimeMessageFlags({
                conversationId: result.chatRoomId,
                messageId: result.messageId,
                participantUserIds: result.participantUserIds,
                userIdsPinIt: result.userIdsPinIt,
                updatedAt: result.updatedAt,
            });
        }

        return Response.json({
            success: true,
            messageId: result.messageId,
            userIdsPinIt: result.userIdsPinIt,
            userIdsStarIt: result.userIdsStarIt,
            updatedAt: result.updatedAt.toISOString(),
        });
    }

    try {
        const appliedReaction = await applyMessageReactionToDb({
            chatRoomId: body.chatRoomId ?? "",
            messageId: body.messageId ?? "",
            reactorUserId: sessionUser.id,
            reactionEmoji: body.reactionEmoji ?? "",
        });

        await broadcastRealtimeReaction(appliedReaction);

        return Response.json({
            success: true,
            reaction: appliedReaction.reaction,
            updatedAt: appliedReaction.updatedAt.toISOString(),
        });
    } catch (error) {
        if (error instanceof MessageReactionError) {
            return Response.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return Response.json(
            { error: "Failed to react to message." },
            { status: 500 }
        );
    }
}

// ---------------------------------------------------------------------------
// GET  /api/messages?phone=...
// Retrieve all messages involving the given phone number.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: new Headers(request.headers),
        });

        if (!session) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const rawChatRoomId = url.searchParams.get("chatRoomId");
        const chatRoomId = normalizeRequestedChatRoomId(rawChatRoomId);
        const phone = url.searchParams.get("phone");
        const limit = Math.min(
            Math.max(Number(url.searchParams.get("limit") ?? "40") || 40, 1),
            100
        );
        const beforeCreatedAtParam = url.searchParams.get("beforeCreatedAt");
        const beforeCreatedAt = beforeCreatedAtParam
            ? new Date(beforeCreatedAtParam)
            : null;
        const pinnedOnly = url.searchParams.get("pinnedOnly") === "true";
        const starredOnly = url.searchParams.get("starredOnly") === "true";

        if (beforeCreatedAt && Number.isNaN(beforeCreatedAt.getTime())) {
            return Response.json(
                { error: "Invalid beforeCreatedAt parameter" },
                { status: 400 }
            );
        }

        if (!chatRoomId && !phone) {
            return Response.json(
                { error: "Missing chatRoomId or phone parameter" },
                { status: 400 },
            );
        }

        const sessionUser = session.user as unknown as UserWithPhone;
        if (phone && sessionUser.phoneNumber !== phone) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        if (chatRoomId && !chatRoomId.includes("::")) {
            const canAccessStoredChat = await canUserAccessStoredChat({
                chatId: chatRoomId,
                userId: sessionUser.id,
            });

            if (!canAccessStoredChat) {
                return Response.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const chatRoomIds = chatRoomId
            ? buildDirectChatIdVariants(chatRoomId)
            : [];

        const rows =
            (pinnedOnly || starredOnly) && chatRoomId
                ? await getFlaggedChatMessages({
                      chatRoomId,
                      chatRoomIds,
                      limit,
                      sessionUserId: sessionUser.id,
                      pinnedOnly,
                      starredOnly,
                  })
                : chatRoomId && chatRoomId.includes("::")
                  ? await getDirectChatMessages({
                        chatRoomId,
                        chatRoomIds,
                        limit,
                        sessionUserId: sessionUser.id,
                        beforeCreatedAt,
                    })
                  : await db
                        .select()
                        .from(message)
                        .where(
                            chatRoomId
                                ? beforeCreatedAt
                                    ? and(
                                          inArray(message.chat_room_id, chatRoomIds),
                                          lt(message.created_at, beforeCreatedAt)
                                      )
                                    : inArray(message.chat_room_id, chatRoomIds)
                                : beforeCreatedAt
                                  ? and(
                                        eq(message.sender_user_id, sessionUser.id),
                                        lt(message.created_at, beforeCreatedAt)
                                    )
                                  : eq(message.sender_user_id, sessionUser.id),
                        )
                        .orderBy(desc(message.created_at))
                        .limit(limit + 1);

        const rowIds = rows.map((row) => row.message_id);
        const recipientKeys =
            rowIds.length > 0
                ? await db
                      .select()
                      .from(messageRecipientKeys)
                      .where(inArray(messageRecipientKeys.message_id, rowIds))
                : [];
        const keysByMessageId = new Map<string, RecipientEncryptedAesKey[]>();
        for (const key of recipientKeys) {
            const existing = keysByMessageId.get(key.message_id) ?? [];
            existing.push({
                recipient_user_id: key.recipient_user_id,
                encrypted_aes_key: key.encrypted_aes_key,
                algorithm: key.algorithm,
            });
            keysByMessageId.set(key.message_id, existing);
        }

        const rowChatIds = [...new Set(rows.map((row) => row.chat_room_id))];
        const readStates =
            rowChatIds.length > 0
                ? await db
                      .select({
                          chatId: chatReadStates.chat_id,
                          userId: chatReadStates.user_id,
                          lastReadAt: chatReadStates.last_read_at,
                      })
                      .from(chatReadStates)
                      .where(inArray(chatReadStates.chat_id, rowChatIds))
                : [];
        const readStatesByChatId = new Map<
            string,
            { userId: string; lastReadAt: Date }[]
        >();
        for (const readState of readStates) {
            const existing = readStatesByChatId.get(readState.chatId) ?? [];
            existing.push({
                userId: readState.userId,
                lastReadAt: readState.lastReadAt,
            });
            readStatesByChatId.set(readState.chatId, existing);
        }

        const mediaRows = rows.filter((row) => Boolean(row.attached_media));
        if (mediaRows.length > 0) {
            logMediaDebug("server.http.messages.get.media-rows", {
                requesterUserId: sessionUser.id,
                chatRoomId,
                requestedPhone: phone,
                count: mediaRows.length,
                messages: mediaRows.map((row) => ({
                    messageId: row.message_id,
                    senderUserId: row.sender_user_id,
                    attachedMedia: row.attached_media,
                    mediaUrl: row.media_url,
                    mediaPreviewUrl: row.media_preview_url,
                    mediaSizeBytes: row.media_size_bytes,
                    mediaWidth: row.media_width,
                    mediaHeight: row.media_height,
                    mediaFileName: row.media_file_name,
                    recipientKeyCount:
                        keysByMessageId.get(row.message_id)?.length ?? 0,
                })),
            });
        }

        const hasMore = rows.length > limit;
        const slicedRows = rows.slice(0, limit);

        return Response.json({
            messages: slicedRows.map((m) => {
                const messageRecipientKeys = keysByMessageId.get(m.message_id) ?? [];
                const recipientUserIds = [
                    ...new Set(
                        messageRecipientKeys
                            .map((key) => key.recipient_user_id)
                            .filter((userId) => userId !== m.sender_user_id)
                    ),
                ];
                const readStatesForChat =
                    readStatesByChatId.get(m.chat_room_id) ?? [];
                const readByUserIds = recipientUserIds.filter((userId) =>
                    readStatesForChat.some(
                        (readState) =>
                            readState.userId === userId &&
                            readState.lastReadAt >= m.created_at
                    )
                );
                const responseMessage: Message = {
                    message_id: m.message_id,
                    sender_user_id: m.sender_user_id,
                    chat_room_id: m.chat_room_id,
                    encrypted_content_ciphertext: m.encrypted_content_ciphertext,
                    encrypted_content_iv: m.encrypted_content_iv,
                    encrypted_content_algorithm: m.encrypted_content_algorithm,
                    message_recipient_keys:
                        messageRecipientKeys.length > 0
                            ? messageRecipientKeys
                            : null,
                    attached_media: m.attached_media,
                    event: m.event,
                    poll: m.poll,
                    reply_message: m.reply_message,
                    location: m.location,
                    media_url: m.media_url,
                    media_preview_url: m.media_preview_url,
                    media_size_bytes: m.media_size_bytes,
                    media_width: m.media_width,
                    media_height: m.media_height,
                    media_file_name: m.media_file_name,
                    video_thumbnail: m.video_thumbnail,
                    message_raction: m.message_raction,
                    is_forward_message: m.is_forward_message,
                    message_text_content: null,
                    open_graph_data: m.open_graph_data,
                    user_ids_pin_it: m.user_ids_pin_it,
                    user_ids_star_it: m.user_ids_star_it,
                    deleted: m.deleted,
                    user_id_delete_it: m.user_id_delete_it,
                    edited: m.edited,
                    user_id_edit_it: m.user_id_edit_it,
                    created_at: m.created_at,
                    updated_at: m.updated_at,
                    contact: m.contact,
                    is_delivered_to_recipient: recipientUserIds.length > 0,
                };

                return withMessageReadReceipt(responseMessage, readByUserIds);
            }),
            hasMore,
        });
    } catch {
        return Response.json(
            { error: "Failed to load messages." },
            { status: 500 }
        );
    }
}

function normalizeRequestedChatRoomId(chatRoomId: string | null): string | null {
    if (!chatRoomId) {
        return null;
    }

    if (!chatRoomId.includes("::")) {
        return chatRoomId.trim();
    }

    return chatRoomId
        .split("::")
        .map((participant) => {
            const trimmedParticipant = participant.trim();

            if (!trimmedParticipant) {
                return trimmedParticipant;
            }

            return participant.startsWith(" ") &&
                !trimmedParticipant.startsWith("+")
                ? `+${trimmedParticipant}`
                : trimmedParticipant;
        })
        .filter(Boolean)
        .sort()
        .join("::");
}

function buildDirectChatRoomId(senderPhone: string, recipientPhone: string) {
    return [senderPhone, recipientPhone].sort().join("::");
}

function normalizeRecipientKeys(
    keys: RecipientEncryptedAesKeyInput[] | null | undefined
): RecipientEncryptedAesKey[] {
    return (keys ?? [])
        .filter((key) => key.recipientUserId && key.encryptedAesKey)
        .map((key) => ({
            recipient_user_id: key.recipientUserId,
            encrypted_aes_key: key.encryptedAesKey,
            algorithm: key.algorithm ?? "aes-256-gcm+rsa-oaep-sha256",
        }));
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

async function getDirectChatMessages({
    chatRoomId,
    chatRoomIds,
    limit,
    sessionUserId,
    beforeCreatedAt,
}: {
    chatRoomId: string;
    chatRoomIds: string[];
    limit: number;
    sessionUserId: string;
    beforeCreatedAt: Date | null;
}) {
    const [userSetting] = await db
        .select()
        .from(chatUserSettings)
        .where(
            and(
                eq(chatUserSettings.user_id, sessionUserId),
                inArray(chatUserSettings.chat_id, chatRoomIds)
            )
        )
        .limit(1);
    const directRecipientMessageIds = await db
        .select({ messageId: messageRecipientKeys.message_id })
        .from(messageRecipientKeys)
        .where(eq(messageRecipientKeys.recipient_user_id, sessionUserId));

    const candidateRows = await db
        .select()
        .from(message)
        .where(
            directRecipientMessageIds.length > 0
                ? beforeCreatedAt
                    ? and(
                          inArray(
                              message.message_id,
                              directRecipientMessageIds.map((row) => row.messageId)
                          ),
                          lt(message.created_at, beforeCreatedAt)
                      )
                    : inArray(
                          message.message_id,
                          directRecipientMessageIds.map((row) => row.messageId)
                      )
                : beforeCreatedAt
                  ? and(
                        eq(message.sender_user_id, sessionUserId),
                        lt(message.created_at, beforeCreatedAt)
                    )
                  : eq(message.sender_user_id, sessionUserId)
        )
        .orderBy(desc(message.created_at))
        .limit((limit + 1) * 5);

    const sentRows = await db
        .select()
        .from(message)
        .where(
            beforeCreatedAt
                ? and(
                      eq(message.sender_user_id, sessionUserId),
                      lt(message.created_at, beforeCreatedAt)
                  )
                : eq(message.sender_user_id, sessionUserId)
        )
        .orderBy(desc(message.created_at))
        .limit((limit + 1) * 5);

    const mergedById = new Map<string, (typeof candidateRows)[number]>();
    for (const row of [...candidateRows, ...sentRows]) {
        mergedById.set(row.message_id, row);
    }

    const filteredRows = [...mergedById.values()]
        .filter(
            (row) =>
                chatRoomIds.includes(row.chat_room_id) ||
                areDirectChatIdsEquivalent(row.chat_room_id, chatRoomId)
        )
        .filter((row) => isMessageVisibleForUserSetting(row, sessionUserId, userSetting))
        .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())
        .slice(0, limit + 1);

    return filteredRows;
}

function isMessageVisibleForUserSetting(
    row: typeof message.$inferSelect,
    sessionUserId: string,
    userSetting?: typeof chatUserSettings.$inferSelect
) {
    if (!userSetting) {
        return true;
    }

    if (
        userSetting.deleted_at &&
        row.created_at <= userSetting.deleted_at
    ) {
        return false;
    }

    if (
        userSetting.is_blocked_chat &&
        row.sender_user_id !== sessionUserId &&
        (!userSetting.blocked_at || row.created_at >= userSetting.blocked_at)
    ) {
        return false;
    }

    return true;
}

async function getFlaggedChatMessages({
    chatRoomId,
    chatRoomIds,
    limit,
    sessionUserId,
    pinnedOnly,
    starredOnly,
}: {
    chatRoomId: string;
    chatRoomIds: string[];
    limit: number;
    sessionUserId: string;
    pinnedOnly: boolean;
    starredOnly: boolean;
}) {
    const candidateLimit = Math.max(limit + 1, 100);
    const matchesRequestedFlags = (row: typeof message.$inferSelect) => {
        const matchesPin = !pinnedOnly || Boolean(row.user_ids_pin_it?.length);
        const matchesStar =
            !starredOnly || Boolean(row.user_ids_star_it?.includes(sessionUserId));

        return matchesPin && matchesStar;
    };

    if (chatRoomId.includes("::")) {
        const rows = await getDirectChatMessages({
            chatRoomId,
            chatRoomIds,
            limit: candidateLimit,
            sessionUserId,
            beforeCreatedAt: null,
        });

        return rows.filter(matchesRequestedFlags).slice(0, limit + 1);
    }

    const conditions = [
        inArray(message.chat_room_id, chatRoomIds),
        pinnedOnly ? isNotNull(message.user_ids_pin_it) : undefined,
        starredOnly
            ? sql`${message.user_ids_star_it} @> ${JSON.stringify([sessionUserId])}::jsonb`
            : undefined,
    ].filter(Boolean);

    return db
        .select()
        .from(message)
        .where(and(...conditions))
        .orderBy(desc(message.created_at))
        .limit(limit + 1);
}

async function canUserAccessStoredChat({
    chatId,
    userId,
}: {
    chatId: string;
    userId: string;
}) {
    const [membership] = await db
        .select({
            chatId: chatRecipientKeys.chat_id,
        })
        .from(chatRecipientKeys)
        .where(
            and(
                eq(chatRecipientKeys.chat_id, chatId),
                eq(chatRecipientKeys.recipient_user_id, userId)
            )
        )
        .limit(1);

    return Boolean(membership);
}

async function getBlockedDirectRecipientIds({
    chatId,
    senderUserId,
    recipientUserIds,
}: {
    chatId: string;
    senderUserId: string;
    recipientUserIds: string[];
}) {
    const uniqueRecipientIds = [...new Set(recipientUserIds)].filter(Boolean);

    if (uniqueRecipientIds.length === 0) {
        return new Set<string>();
    }

    const blockedSettings = await db
        .select({
            userId: chatUserSettings.user_id,
        })
        .from(chatUserSettings)
        .where(
            and(
                eq(chatUserSettings.chat_id, chatId),
                inArray(chatUserSettings.user_id, uniqueRecipientIds),
                eq(chatUserSettings.is_blocked_chat, true)
            )
        );

    return new Set(
        blockedSettings
            .map((setting) => setting.userId)
            .filter((userId) => userId !== senderUserId)
    );
}

async function restoreDeletedChatForParticipants({
    chatId,
    userIds,
}: {
    chatId: string;
    userIds: string[];
}) {
    const uniqueUserIds = [...new Set(userIds)].filter(Boolean);

    if (uniqueUserIds.length === 0) {
        return;
    }

    await db
        .update(chatUserSettings)
        .set({
            is_deleted_chat: false,
            updated_at: new Date(),
        })
        .where(
            and(
                eq(chatUserSettings.chat_id, chatId),
                inArray(chatUserSettings.user_id, uniqueUserIds)
            )
        );
}

async function broadcastRealtimeMessage({
    conversationId,
    conversationType,
    message,
    recipientUserIds,
}: {
    conversationId: string;
    conversationType: "direct" | "group";
    message: Omit<Message, "created_at" | "updated_at"> & {
        created_at: string;
        updated_at: string;
    };
    recipientUserIds: string[];
}) {
    try {
        const { env } = await getCloudflareContext({ async: true });
        const bindings = env as unknown as RealtimeBindings;
        const roomNamespace = bindings.CHAT_ROOM_DO;
        const presenceNamespace = bindings.USER_PRESENCE_DO;

        if (!roomNamespace || !presenceNamespace) {
            return;
        }

        const roomDO = roomNamespace.get(roomNamespace.idFromName(conversationId));
        await roomDO.fetch("https://do/broadcast", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                type: "NEW_MESSAGE",
                conversationId,
                conversationType,
                message,
            }),
        });

        const uniqueRecipientIds = [...new Set(recipientUserIds)].filter(Boolean);

        await Promise.all(
            uniqueRecipientIds.map(async (recipientUserId) => {
                const unreadCount = await getUnreadCountForRecipient({
                    chatId: conversationId,
                    userId: recipientUserId,
                });
                const userDO = presenceNamespace.get(
                    presenceNamespace.idFromName(recipientUserId)
                );

                await userDO.fetch("https://do/event", {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify({
                        type: "CONVERSATION_UPDATED",
                        conversationId,
                        conversationType,
                        lastMessage: message,
                        unreadCount,
                    }),
                });
            })
        );
    } catch {
        // Realtime fanout is best-effort here; the DB write already succeeded.
    }
}

async function broadcastRealtimeReaction(appliedReaction: AppliedMessageReaction) {
    try {
        const { env } = await getCloudflareContext({ async: true });
        const bindings = env as unknown as RealtimeBindings;
        const roomNamespace = bindings.CHAT_ROOM_DO;
        const presenceNamespace = bindings.USER_PRESENCE_DO;

        if (!roomNamespace || !presenceNamespace) {
            return;
        }

        const event = {
            type: "MESSAGE_REACTION_UPDATED",
            conversationId: appliedReaction.conversationId,
            conversationType: appliedReaction.conversationType,
            messageId: appliedReaction.messageId,
            targetSenderUserId: appliedReaction.targetSenderUserId,
            reaction: appliedReaction.reaction,
            updatedAt: appliedReaction.updatedAt.toISOString(),
        };
        const roomDO = roomNamespace.get(
            roomNamespace.idFromName(appliedReaction.conversationId)
        );
        await roomDO.fetch("https://do/broadcast", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(event),
        });

        await Promise.all(
            appliedReaction.participantUserIds
                .filter(
                    (participantUserId) =>
                        participantUserId &&
                        participantUserId !== appliedReaction.reaction.user_id
                )
                .map(async (participantUserId) => {
                    const unreadCount = await getUnreadCountForRecipient({
                        chatId: appliedReaction.conversationId,
                        userId: participantUserId,
                    });
                    const userDO = presenceNamespace.get(
                        presenceNamespace.idFromName(participantUserId)
                    );

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
    } catch {
        // Realtime fanout is best-effort here; the DB write already succeeded.
    }
}

type MessageFlagUpdateResult = {
    chatRoomId: string;
    messageId: string;
    participantUserIds: string[];
    userIdsPinIt: string[] | null;
    userIdsStarIt: string[] | null;
    updatedAt: Date;
};

async function updateMessageUserFlag({
    chatRoomId,
    messageId,
    userId,
    flag,
    enabled,
}: {
    chatRoomId: string;
    messageId: string;
    userId: string;
    flag: "star" | "pin";
    enabled: boolean;
}): Promise<MessageFlagUpdateResult | null> {
    if (!chatRoomId || !messageId || !userId) {
        return null;
    }

    const [targetMessage] = await db
        .select({
            messageId: message.message_id,
            chatRoomId: message.chat_room_id,
            senderUserId: message.sender_user_id,
            userIdsPinIt: message.user_ids_pin_it,
            userIdsStarIt: message.user_ids_star_it,
        })
        .from(message)
        .where(
            and(
                eq(message.message_id, messageId),
                eq(message.chat_room_id, chatRoomId)
            )
        )
        .limit(1);

    if (!targetMessage) {
        return null;
    }

    const participantUserIds = await getMessageParticipantUserIds({
        chatRoomId: targetMessage.chatRoomId,
        messageId: targetMessage.messageId,
        senderUserId: targetMessage.senderUserId,
    });

    if (!participantUserIds.includes(userId)) {
        return null;
    }

    const now = new Date();
    const nextUserIdsPinIt =
        flag === "pin"
            ? applyUserFlag(targetMessage.userIdsPinIt, userId, enabled)
            : targetMessage.userIdsPinIt ?? null;
    const nextUserIdsStarIt =
        flag === "star"
            ? applyUserFlag(targetMessage.userIdsStarIt, userId, enabled)
            : targetMessage.userIdsStarIt ?? null;

    await db
        .update(message)
        .set({
            user_ids_pin_it: nextUserIdsPinIt,
            user_ids_star_it: nextUserIdsStarIt,
            updated_at: now,
        })
        .where(eq(message.message_id, targetMessage.messageId));

    return {
        chatRoomId: targetMessage.chatRoomId,
        messageId: targetMessage.messageId,
        participantUserIds,
        userIdsPinIt: nextUserIdsPinIt,
        userIdsStarIt: nextUserIdsStarIt,
        updatedAt: now,
    };
}

function applyUserFlag(
    userIds: string[] | null,
    userId: string,
    enabled: boolean
) {
    const nextUserIds = new Set((userIds ?? []).filter(Boolean));

    if (enabled) {
        nextUserIds.add(userId);
    } else {
        nextUserIds.delete(userId);
    }

    return nextUserIds.size > 0 ? [...nextUserIds] : null;
}

async function getMessageParticipantUserIds({
    chatRoomId,
    messageId,
    senderUserId,
}: {
    chatRoomId: string;
    messageId: string;
    senderUserId: string;
}) {
    const [keyRows, groupRows] = await Promise.all([
        db
            .select({
                recipientUserId: messageRecipientKeys.recipient_user_id,
            })
            .from(messageRecipientKeys)
            .where(eq(messageRecipientKeys.message_id, messageId)),
        chatRoomId.includes("::")
            ? Promise.resolve([])
            : db
                  .select({
                      recipientUserId: chatRecipientKeys.recipient_user_id,
                  })
                  .from(chatRecipientKeys)
                  .where(eq(chatRecipientKeys.chat_id, chatRoomId)),
    ]);

    return [
        ...new Set([
            senderUserId,
            ...keyRows.map((row) => row.recipientUserId),
            ...groupRows.map((row) => row.recipientUserId),
        ]),
    ].filter(Boolean);
}

async function broadcastRealtimeMessageFlags({
    conversationId,
    messageId,
    participantUserIds,
    userIdsPinIt,
    updatedAt,
}: {
    conversationId: string;
    messageId: string;
    participantUserIds: string[];
    userIdsPinIt: string[] | null;
    updatedAt: Date;
}) {
    try {
        const { env } = await getCloudflareContext({ async: true });
        const bindings = env as unknown as RealtimeBindings;
        const roomNamespace = bindings.CHAT_ROOM_DO;
        const presenceNamespace = bindings.USER_PRESENCE_DO;

        if (!roomNamespace || !presenceNamespace) {
            return;
        }

        const event = {
            type: "MESSAGE_FLAGS_UPDATED",
            conversationId,
            messageId,
            userIdsPinIt,
            updatedAt: updatedAt.toISOString(),
        };
        const roomDO = roomNamespace.get(roomNamespace.idFromName(conversationId));
        await roomDO.fetch("https://do/broadcast", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(event),
        });

        await Promise.all(
            participantUserIds.map(async (participantUserId) => {
                const userDO = presenceNamespace.get(
                    presenceNamespace.idFromName(participantUserId)
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
    } catch {
        // Realtime fanout is best-effort; the database already has the flags.
    }
}
