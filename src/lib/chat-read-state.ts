import db from "@/db";
import { chatReadStates, message, messageRecipientKeys } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function markConversationRead(params: {
    chatId: string;
    userId: string;
    readAt?: Date;
}) {
    const now = params.readAt ?? new Date();

    await db
        .insert(chatReadStates)
        .values({
            id: crypto.randomUUID(),
            chat_id: params.chatId,
            user_id: params.userId,
            last_read_at: now,
            created_at: now,
            updated_at: now,
        })
        .onConflictDoUpdate({
            target: [chatReadStates.chat_id, chatReadStates.user_id],
            set: {
                last_read_at: now,
                updated_at: now,
            },
        });
}

export async function getUnreadCountForRecipient(params: {
    chatId: string;
    userId: string;
}) {
    const [readState, unreadCandidates] = await Promise.all([
        db.query.chatReadStates.findFirst({
            where: and(
                eq(chatReadStates.chat_id, params.chatId),
                eq(chatReadStates.user_id, params.userId)
            ),
        }),
        db
            .select({
                createdAt: message.created_at,
            })
            .from(message)
            .innerJoin(
                messageRecipientKeys,
                eq(messageRecipientKeys.message_id, message.message_id)
            )
            .where(
                and(
                    eq(message.chat_room_id, params.chatId),
                    eq(messageRecipientKeys.recipient_user_id, params.userId)
                )
            ),
    ]);

    if (!readState) {
        return unreadCandidates.length;
    }

    return unreadCandidates.reduce((count, candidate) => {
        return candidate.createdAt > readState.last_read_at ? count + 1 : count;
    }, 0);
}

export async function getUnreadCountsByChatId(params: {
    chatIds: string[];
    userId: string;
}) {
    if (params.chatIds.length === 0) {
        return new Map<string, number>();
    }

    const [readStates, unreadCandidates] = await Promise.all([
        db
            .select()
            .from(chatReadStates)
            .where(
                and(
                    eq(chatReadStates.user_id, params.userId),
                    inArray(chatReadStates.chat_id, params.chatIds)
                )
            ),
        db
            .select({
                chatId: message.chat_room_id,
                createdAt: message.created_at,
            })
            .from(message)
            .innerJoin(
                messageRecipientKeys,
                eq(messageRecipientKeys.message_id, message.message_id)
            )
            .where(
                and(
                    eq(messageRecipientKeys.recipient_user_id, params.userId),
                    inArray(message.chat_room_id, params.chatIds)
                )
            ),
    ]);

    const lastReadAtByChatId = new Map(
        readStates.map((state) => [state.chat_id, state.last_read_at])
    );
    const unreadCountByChatId = new Map<string, number>();

    for (const chatId of params.chatIds) {
        unreadCountByChatId.set(chatId, 0);
    }

    for (const candidate of unreadCandidates) {
        const lastReadAt = lastReadAtByChatId.get(candidate.chatId);
        if (!lastReadAt || candidate.createdAt > lastReadAt) {
            unreadCountByChatId.set(
                candidate.chatId,
                (unreadCountByChatId.get(candidate.chatId) ?? 0) + 1
            );
        }
    }

    return unreadCountByChatId;
}
