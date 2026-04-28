import type { ChatItemType } from "@/types/chats.type";
import type { Message } from "@/types/messages.type";

type RawChatItem = Omit<ChatItemType, "created_at" | "updated_at"> & {
    created_at: string | Date;
    updated_at: string | Date;
};

type RawMessage = Omit<Message, "created_at" | "updated_at"> & {
    created_at: string | Date;
    updated_at: string | Date;
};

export function normalizeChatItem(chat: RawChatItem): ChatItemType {
    return {
        ...chat,
        created_at: new Date(chat.created_at),
        updated_at: new Date(chat.updated_at),
    };
}

export function normalizeMessage(message: RawMessage): Message {
    return {
        ...message,
        created_at: new Date(message.created_at),
        updated_at: new Date(message.updated_at),
    };
}

export function sortChatsByRecent(chats: ChatItemType[]): ChatItemType[] {
    return [...chats].sort(
        (left, right) => right.updated_at.getTime() - left.updated_at.getTime()
    );
}

export function sortMessagesChronologically(messages: Message[]): Message[] {
    return [...messages].sort(
        (left, right) => left.created_at.getTime() - right.created_at.getTime()
    );
}

export function resolveDirectChatPartner(
    chatId: string,
    currentPhone?: string | null
): string | null {
    if (!chatId.includes("::")) {
        return null;
    }

    const participants = chatId.split("::").filter(Boolean);
    if (participants.length === 0) {
        return null;
    }

    if (!currentPhone) {
        return participants[0] ?? null;
    }

    return participants.find((participant) => participant !== currentPhone) ?? null;
}

export function getChatDisplayName(
    chat: ChatItemType,
    currentPhone?: string | null
): string {
    if (chat.chat_type === "single") {
        return resolveDirectChatPartner(chat.chat_id, currentPhone) ?? chat.chat_id;
    }

    return chat.chat_id || "Group chat";
}

export function buildChatFromMessage({
    conversationId,
    conversationType,
    message,
    currentUserId,
    unreadCount,
    fallbackExistingChat,
}: {
    conversationId: string;
    conversationType: "direct" | "group";
    message: Message;
    currentUserId: string;
    unreadCount: number;
    fallbackExistingChat?: ChatItemType | null;
}): ChatItemType {
    return {
        chat_id: conversationId,
        chat_type: conversationType === "group" ? "group" : "single",
        avatar: fallbackExistingChat?.avatar ?? "",
        last_message_id: message.message_id,
        encrypted_preview_ciphertext:
            fallbackExistingChat?.encrypted_preview_ciphertext ?? null,
        encrypted_preview_iv: fallbackExistingChat?.encrypted_preview_iv ?? null,
        encrypted_preview_algorithm:
            fallbackExistingChat?.encrypted_preview_algorithm ?? null,
        chat_recipient_keys: fallbackExistingChat?.chat_recipient_keys ?? null,
        last_message_context: message.message_text_content ?? "",
        last_message_media: message.attached_media ?? null,
        last_message_sender_is_me: message.sender_user_id === currentUserId,
        last_message_sender_nickname:
            fallbackExistingChat?.last_message_sender_nickname ??
            message.sender_user_id,
        is_unreaded_chat: unreadCount > 0,
        unreaded_messages_length: unreadCount,
        is_archived_chat: fallbackExistingChat?.is_archived_chat ?? false,
        is_muted_chat_notifications:
            fallbackExistingChat?.is_muted_chat_notifications ?? false,
        is_pinned_chat: fallbackExistingChat?.is_pinned_chat ?? false,
        is_favourite_chat: fallbackExistingChat?.is_favourite_chat ?? false,
        is_blocked_chat: fallbackExistingChat?.is_blocked_chat ?? false,
        created_at: fallbackExistingChat?.created_at ?? message.created_at,
        updated_at: message.updated_at,
    };
}
