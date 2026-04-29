import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/lib/auth";
import db from "@/db";
import {
    chatRecipientKeys,
    chats,
    message,
    messageRecipientKeys,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import {
    areDirectChatIdsEquivalent,
    buildDirectChatIdVariants,
} from "@/lib/chat-utils";
import type {
    EncryptedContentEnvelope,
    RecipientEncryptedAesKey,
    RecipientEncryptedAesKeyInput,
} from "@/types/crypto";
import type { Message } from "@/types/messages.type";
import { parseManagedMessageMediaUrl } from "@/lib/message-media-url";

/**
 * The better-auth `phoneNumber` plugin adds `phoneNumber` at runtime
 * but the server-side types do not expose it automatically.
 */
interface UserWithPhone {
    id: string;
    name?: string | null;
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
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
        clientMessageId?: string;
        senderUserId?: string;
        senderNickname?: string;
        chatRoomId?: string;
        conversationType?: "direct" | "group";
        senderPhone?: string;
        recipientPhone?: string;
        content?: string | null;
        messageTextContent?: string | null;
        attachedMedia?: Message["attached_media"];
        mediaUrl?: string | null;
        videoThumbnail?: string | null;
        encryptedContent?: EncryptedContentEnvelope | null;
        recipientEncryptionKeys?: RecipientEncryptedAesKeyInput[] | null;
        encryptedChatPreview?: EncryptedContentEnvelope | null;
        chatPreviewRecipientKeys?: RecipientEncryptedAesKeyInput[] | null;
    };

    const sessionUser = session.user as unknown as UserWithPhone;
    const {
        senderUserId,
        clientMessageId,
        senderNickname,
        chatRoomId,
        conversationType,
        senderPhone,
        recipientPhone,
        content,
        messageTextContent,
        attachedMedia,
        mediaUrl,
        videoThumbnail,
        encryptedContent,
        recipientEncryptionKeys,
        encryptedChatPreview,
        chatPreviewRecipientKeys,
    } = body;
    const finalSenderUserId = senderUserId ?? sessionUser.id;
    const finalChatRoomId =
        chatRoomId ??
        (senderPhone && recipientPhone
            ? buildDirectChatRoomId(senderPhone, recipientPhone)
            : null);
    const finalMessageTextContent = messageTextContent ?? content ?? null;
    const attachmentValidationError = validateEncryptedAttachmentPayload({
        attachedMedia: attachedMedia ?? null,
        mediaUrl: mediaUrl ?? null,
        videoThumbnail: videoThumbnail ?? null,
    });

    if (
        !finalChatRoomId ||
        (!finalMessageTextContent &&
            !attachedMedia &&
            !encryptedContent?.ciphertext)
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

    if (finalSenderUserId !== sessionUser.id) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = clientMessageId ?? crypto.randomUUID();
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
            chat_id: finalChatRoomId,
            chat_type: conversationType === "group" ? "group" : "single",
            avatar: "",
            last_message_id: id,
            encrypted_preview_ciphertext:
                encryptedChatPreview?.ciphertext ?? null,
            encrypted_preview_iv: encryptedChatPreview?.iv ?? null,
            encrypted_preview_algorithm:
                encryptedChatPreview?.algorithm ?? null,
            last_message_context: finalMessageTextContent ?? "",
            last_message_media: attachedMedia ?? null,
            last_message_sender_is_me: false,
            last_message_sender_nickname:
                senderNickname ?? sessionUser.name ?? finalSenderUserId,
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
                last_message_context: finalMessageTextContent ?? "",
                last_message_media: attachedMedia ?? null,
                last_message_sender_is_me: false,
                last_message_sender_nickname:
                    senderNickname ?? sessionUser.name ?? finalSenderUserId,
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
        reply_message: null,
        location: null,
        media_url: mediaUrl ?? null,
        video_thumbnail: videoThumbnail ?? null,
        message_raction: null,
        is_forward_message: false,
        message_text_content: finalMessageTextContent,
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
        reply_message: null,
        location: null,
        media_url: mediaUrl ?? null,
        video_thumbnail: videoThumbnail ?? null,
        message_raction: null,
        is_forward_message: false,
        message_text_content: finalMessageTextContent,
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
    };

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

    return Response.json({
        success: true,
        id,
        chatRoomId: finalChatRoomId,
        message: responseMessage,
    });
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
            console.warn("[api/messages][GET] no session", {
                cookieHeaderPresent: Boolean(request.headers.get("cookie")),
            });
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

        if (!chatRoomId && !phone) {
            return Response.json(
                { error: "Missing chatRoomId or phone parameter" },
                { status: 400 },
            );
        }

        const sessionUser = session.user as unknown as UserWithPhone;
        console.log("[api/messages][GET] session", {
            sessionUserId: sessionUser.id,
            sessionUserPhone: sessionUser.phoneNumber ?? null,
            rawChatRoomId,
            chatRoomId,
            phone,
            limit,
        });
        if (phone && sessionUser.phoneNumber !== phone) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        const chatRoomIds = chatRoomId
            ? buildDirectChatIdVariants(chatRoomId)
            : [];

        const rows = chatRoomId && chatRoomId.includes("::")
            ? await getDirectChatMessages({
                  chatRoomId,
                  chatRoomIds,
                  limit,
                  sessionUserId: sessionUser.id,
              })
            : await db
                  .select()
                  .from(message)
                  .where(
                      chatRoomId
                          ? inArray(message.chat_room_id, chatRoomIds)
                          : eq(message.sender_user_id, sessionUser.id),
                  )
                  .orderBy(desc(message.created_at))
                  .limit(limit);
        console.log("[api/messages][GET] rows", {
            chatRoomId,
            chatRoomIds,
            sessionUserId: sessionUser.id,
            rowCount: rows.length,
            rowIds: rows.map((row) => row.message_id),
            rowChatIds: rows.map((row) => row.chat_room_id),
        });

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

        return Response.json({
            messages: rows.map((m) => ({
                message_id: m.message_id,
                sender_user_id: m.sender_user_id,
                chat_room_id: m.chat_room_id,
                encrypted_content_ciphertext: m.encrypted_content_ciphertext,
                encrypted_content_iv: m.encrypted_content_iv,
                encrypted_content_algorithm: m.encrypted_content_algorithm,
                message_recipient_keys:
                    keysByMessageId.get(m.message_id) ?? null,
                attached_media: m.attached_media,
                event: m.event,
                poll: m.poll,
                reply_message: m.reply_message,
                location: m.location,
                media_url: m.media_url,
                video_thumbnail: m.video_thumbnail,
                message_raction: m.message_raction,
                is_forward_message: m.is_forward_message,
                message_text_content: m.message_text_content,
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
            })),
        });
    } catch (error) {
        const url = new URL(request.url);
        console.error("[api/messages][GET] failed", {
            rawChatRoomId: url.searchParams.get("chatRoomId"),
            chatRoomId: normalizeRequestedChatRoomId(
                url.searchParams.get("chatRoomId")
            ),
            phone: url.searchParams.get("phone"),
            limit: url.searchParams.get("limit"),
            error:
                error instanceof Error
                    ? {
                          name: error.name,
                          message: error.message,
                          stack: error.stack,
                      }
                    : error,
        });

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

async function getDirectChatMessages({
    chatRoomId,
    chatRoomIds,
    limit,
    sessionUserId,
}: {
    chatRoomId: string;
    chatRoomIds: string[];
    limit: number;
    sessionUserId: string;
}) {
    const directRecipientMessageIds = await db
        .select({ messageId: messageRecipientKeys.message_id })
        .from(messageRecipientKeys)
        .where(eq(messageRecipientKeys.recipient_user_id, sessionUserId));

    const candidateRows = await db
        .select()
        .from(message)
        .where(
            directRecipientMessageIds.length > 0
                ? inArray(
                      message.message_id,
                      directRecipientMessageIds.map((row) => row.messageId)
                  )
                : eq(message.sender_user_id, sessionUserId)
        )
        .orderBy(desc(message.created_at))
        .limit(limit * 5);

    const sentRows = await db
        .select()
        .from(message)
        .where(eq(message.sender_user_id, sessionUserId))
        .orderBy(desc(message.created_at))
        .limit(limit * 5);

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
        .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())
        .slice(0, limit);

    console.log("[api/messages][GET][direct] debug", {
        chatRoomId,
        chatRoomIds,
        sessionUserId,
        directRecipientMessageIdsCount: directRecipientMessageIds.length,
        candidateRowsCount: candidateRows.length,
        sentRowsCount: sentRows.length,
        mergedRowsCount: mergedById.size,
        filteredRowsCount: filteredRows.length,
        filteredRowIds: filteredRows.map((row) => row.message_id),
        filteredRowChatIds: filteredRows.map((row) => row.chat_room_id),
    });

    return filteredRows;
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
                        unreadCount: 1,
                    }),
                });
            })
        );
    } catch {
        // Realtime fanout is best-effort here; the DB write already succeeded.
    }
}
