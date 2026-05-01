import { and, eq } from "drizzle-orm";
import db from "@/db";
import { chats, message, messageRecipientKeys } from "@/db/schema";
import type { MessageReaction } from "@/types/messages.type";

export class MessageReactionError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "MessageReactionError";
        this.status = status;
    }
}

export type AppliedMessageReaction = {
    conversationId: string;
    conversationType: "direct" | "group";
    messageId: string;
    targetSenderUserId: string;
    participantUserIds: string[];
    reaction: MessageReaction;
    updatedAt: Date;
};

export async function applyMessageReactionToDb({
    chatRoomId,
    messageId,
    reactorUserId,
    reactionEmoji,
}: {
    chatRoomId: string;
    messageId: string;
    reactorUserId: string;
    reactionEmoji: string;
}): Promise<AppliedMessageReaction> {
    const normalizedReactionEmoji = reactionEmoji.trim();

    if (!chatRoomId || !messageId || !normalizedReactionEmoji) {
        throw new MessageReactionError("Missing reaction fields", 400);
    }

    if (normalizedReactionEmoji.length > 16) {
        throw new MessageReactionError("Reaction is too long", 400);
    }

    const [targetMessage] = await db
        .select({
            messageId: message.message_id,
            chatRoomId: message.chat_room_id,
            senderUserId: message.sender_user_id,
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
        throw new MessageReactionError("Message not found", 404);
    }

    const [chat] = await db
        .select({
            chatId: chats.chat_id,
            chatType: chats.chat_type,
        })
        .from(chats)
        .where(eq(chats.chat_id, targetMessage.chatRoomId))
        .limit(1);

    if (!chat) {
        throw new MessageReactionError("Chat not found", 404);
    }

    const keyRows = await db
        .select({
            recipientUserId: messageRecipientKeys.recipient_user_id,
        })
        .from(messageRecipientKeys)
        .where(eq(messageRecipientKeys.message_id, targetMessage.messageId));
    const participantUserIds = [
        ...new Set([
            targetMessage.senderUserId,
            ...keyRows.map((row) => row.recipientUserId),
        ]),
    ].filter(Boolean);

    if (!participantUserIds.includes(reactorUserId)) {
        throw new MessageReactionError("Forbidden", 403);
    }

    const now = new Date();
    const reaction: MessageReaction = {
        id: crypto.randomUUID(),
        user_id: reactorUserId,
        reaction_emoji: normalizedReactionEmoji,
    };

    await db
        .update(message)
        .set({
            message_raction: reaction,
            updated_at: now,
        })
        .where(eq(message.message_id, targetMessage.messageId));

    await db
        .update(chats)
        .set({
            last_message_id: targetMessage.messageId,
            encrypted_preview_ciphertext: null,
            encrypted_preview_iv: null,
            encrypted_preview_algorithm: null,
            last_message_context: normalizedReactionEmoji,
            last_message_media: "reaction",
            last_message_sender_is_me: false,
            last_message_sender_nickname: reactorUserId,
            updated_at: now,
        })
        .where(eq(chats.chat_id, targetMessage.chatRoomId));

    return {
        conversationId: targetMessage.chatRoomId,
        conversationType: chat.chatType === "group" ? "group" : "direct",
        messageId: targetMessage.messageId,
        targetSenderUserId: targetMessage.senderUserId,
        participantUserIds,
        reaction,
        updatedAt: now,
    };
}
