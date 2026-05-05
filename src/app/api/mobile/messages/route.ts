import { auth } from "@/lib/auth";
import db from "@/db";
import {
    chatReadStates,
    chatRecipientKeys,
    chats,
    message,
    messageRecipientKeys,
} from "@/db/schema";
import { desc, eq, inArray, like } from "drizzle-orm";
import type { RecipientEncryptedAesKey } from "@/types/crypto";
import type { Message } from "@/types/messages.type";
import { withMessageReadReceipt } from "@/lib/message-read-receipts";

interface UserWithPhone {
    id: string;
    phoneNumber?: string | null;
}

export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: new Headers(request.headers),
        });

        if (!session) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const sessionUser = session.user as unknown as UserWithPhone;
        const chatIds = await getAccessibleChatIdsForUser({
            userId: sessionUser.id,
            phoneNumber: sessionUser.phoneNumber ?? null,
        });

        if (chatIds.length === 0) {
            return Response.json({ messages: [] });
        }

        const rows = await db
            .select()
            .from(message)
            .where(inArray(message.chat_room_id, chatIds))
            .orderBy(desc(message.created_at));
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

        const readStates = await db
            .select({
                chatId: chatReadStates.chat_id,
                userId: chatReadStates.user_id,
                lastReadAt: chatReadStates.last_read_at,
            })
            .from(chatReadStates)
            .where(inArray(chatReadStates.chat_id, chatIds));
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

        return Response.json({
            messages: rows.map((m) => {
                const messageRecipientKeys =
                    keysByMessageId.get(m.message_id) ?? [];
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
                };

                return withMessageReadReceipt(responseMessage, readByUserIds);
            }),
        });
    } catch {
        return Response.json(
            { error: "Failed to load mobile messages." },
            { status: 500 }
        );
    }
}

async function getAccessibleChatIdsForUser({
    userId,
    phoneNumber,
}: {
    userId: string;
    phoneNumber: string | null;
}) {
    const participantChatIds = new Set<string>();
    const [sentChats, chatKeyRows, receivedMessageKeys, phoneChats] =
        await Promise.all([
            db
                .selectDistinct({ chatId: message.chat_room_id })
                .from(message)
                .where(eq(message.sender_user_id, userId)),
            db
                .select({ chatId: chatRecipientKeys.chat_id })
                .from(chatRecipientKeys)
                .where(eq(chatRecipientKeys.recipient_user_id, userId)),
            db
                .select({ messageId: messageRecipientKeys.message_id })
                .from(messageRecipientKeys)
                .where(eq(messageRecipientKeys.recipient_user_id, userId)),
            phoneNumber
                ? db
                      .select({ chatId: chats.chat_id })
                      .from(chats)
                      .where(like(chats.chat_id, `%${phoneNumber}%`))
                : Promise.resolve([]),
        ]);

    for (const row of sentChats) {
        participantChatIds.add(row.chatId);
    }

    for (const row of chatKeyRows) {
        participantChatIds.add(row.chatId);
    }

    for (const row of phoneChats) {
        participantChatIds.add(row.chatId);
    }

    if (receivedMessageKeys.length > 0) {
        const receivedChats = await db
            .selectDistinct({ chatId: message.chat_room_id })
            .from(message)
            .where(
                inArray(
                    message.message_id,
                    receivedMessageKeys.map((row) => row.messageId)
                )
            );

        for (const row of receivedChats) {
            participantChatIds.add(row.chatId);
        }
    }

    return [...participantChatIds];
}
