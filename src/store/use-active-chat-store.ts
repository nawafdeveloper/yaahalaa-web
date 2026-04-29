import { create } from "zustand";
import { buildDirectChatId } from "@/lib/chat-e2ee";
import { sortChatsByRecent, sortMessagesChronologically } from "@/lib/chat-utils";
import type { ChatItemType } from "@/types/chats.type";
import type { Contact } from "@/types/contacts.type";
import type { Message } from "@/types/messages.type";

type PresenceState = {
    activeUsers: string[];
    activeUsersCount: number;
};

interface ActiveChatState {
    chats: ChatItemType[];
    chatsLoading: boolean;
    chatsError: string | null;
    selectedChatId: string | null;
    recipientPhone: string | null;
    draftsByChatId: Record<string, string>;
    messagesByChatId: Record<string, Message[]>;
    messagesLoadingByChatId: Record<string, boolean>;
    presenceByChatId: Record<string, PresenceState>;
    setChats: (chats: ChatItemType[]) => void;
    upsertChat: (chat: ChatItemType) => void;
    setChatsLoading: (loading: boolean) => void;
    setChatsError: (error: string | null) => void;
    setSelectedChatId: (chatId: string | null) => void;
    setRecipientPhone: (phone: string | null) => void;
    setDraft: (chatId: string, draft: string) => void;
    setMessages: (chatId: string, messages: Message[]) => void;
    appendMessage: (chatId: string, message: Message) => void;
    updateMessage: (
        chatId: string,
        messageId: string,
        updater: (message: Message) => Message
    ) => void;
    setMessagesLoading: (chatId: string, loading: boolean) => void;
    setPresence: (chatId: string, presence: PresenceState) => void;
    markChatRead: (chatId: string) => void;
    openDirectContactChat: (params: {
        contact: Contact;
        currentPhone: string;
        currentUserId: string;
    }) => string;
    reset: () => void;
}

export const useActiveChatStore = create<ActiveChatState>((set) => ({
    chats: [],
    chatsLoading: false,
    chatsError: null,
    selectedChatId: null,
    recipientPhone: null,
    draftsByChatId: {},
    messagesByChatId: {},
    messagesLoadingByChatId: {},
    presenceByChatId: {},
    setChats: (chats) =>
        set(() => ({
            chats: sortChatsByRecent(chats),
        })),
    upsertChat: (chat) =>
        set((state) => {
            const existingWithoutChat = state.chats.filter(
                (item) => item.chat_id !== chat.chat_id
            );

            return {
                chats: sortChatsByRecent([...existingWithoutChat, chat]),
            };
        }),
    setChatsLoading: (loading) => set({ chatsLoading: loading }),
    setChatsError: (error) => set({ chatsError: error }),
    setSelectedChatId: (chatId) =>
        set((state) =>
            state.selectedChatId === chatId
                ? state
                : { selectedChatId: chatId }
        ),
    setRecipientPhone: (phone) =>
        set((state) =>
            state.recipientPhone === phone
                ? state
                : { recipientPhone: phone }
        ),
    setDraft: (chatId, draft) =>
        set((state) => ({
            draftsByChatId: {
                ...state.draftsByChatId,
                [chatId]: draft,
            },
        })),
    setMessages: (chatId, messages) =>
        set((state) => {
            const existingMessages = state.messagesByChatId[chatId] ?? [];
            const mergedById = new Map<string, Message>();

            for (const existingMessage of existingMessages) {
                mergedById.set(existingMessage.message_id, existingMessage);
            }

            for (const incomingMessage of messages) {
                const existingMessage = mergedById.get(incomingMessage.message_id);

                mergedById.set(
                    incomingMessage.message_id,
                    existingMessage
                        ? {
                              ...existingMessage,
                              ...incomingMessage,
                              client_status: "sent",
                              client_error: null,
                          }
                        : incomingMessage
                );
            }

            return {
                messagesByChatId: {
                    ...state.messagesByChatId,
                    [chatId]: sortMessagesChronologically([...mergedById.values()]),
                },
            };
        }),
    appendMessage: (chatId, message) =>
        set((state) => {
            const existingMessages = state.messagesByChatId[chatId] ?? [];
            const nextMessages = existingMessages.some(
                (item) => item.message_id === message.message_id
            )
                ? existingMessages.map((item) =>
                      item.message_id === message.message_id ? message : item
                  )
                : [...existingMessages, message];

            return {
                messagesByChatId: {
                    ...state.messagesByChatId,
                    [chatId]: sortMessagesChronologically(nextMessages),
                },
            };
        }),
    updateMessage: (chatId, messageId, updater) =>
        set((state) => ({
            messagesByChatId: {
                ...state.messagesByChatId,
                [chatId]: (state.messagesByChatId[chatId] ?? []).map((message) =>
                    message.message_id === messageId ? updater(message) : message
                ),
            },
        })),
    setMessagesLoading: (chatId, loading) =>
        set((state) => ({
            messagesLoadingByChatId: {
                ...state.messagesLoadingByChatId,
                [chatId]: loading,
            },
        })),
    setPresence: (chatId, presence) =>
        set((state) => ({
            presenceByChatId: {
                ...state.presenceByChatId,
                [chatId]: presence,
            },
        })),
    markChatRead: (chatId) =>
        set((state) => {
            let didChange = false;

            const chats = state.chats.map((chat) => {
                if (chat.chat_id !== chatId) {
                    return chat;
                }

                if (!chat.is_unreaded_chat && chat.unreaded_messages_length === 0) {
                    return chat;
                }

                didChange = true;

                return {
                    ...chat,
                    is_unreaded_chat: false,
                    unreaded_messages_length: 0,
                };
            });

            return didChange ? { chats } : state;
        }),
    openDirectContactChat: ({ contact, currentPhone, currentUserId }) => {
        const chatId = buildDirectChatId(currentPhone, contact.contact_number);

        set((state) => {
            const existingChat = state.chats.find((chat) => chat.chat_id === chatId);

            const nextChat: ChatItemType = {
                chat_id: chatId,
                chat_type: "single",
                avatar: contact.contact_avatar ?? existingChat?.avatar ?? "",
                display_name:
                    `${contact.contact_first_name ?? ""} ${contact.contact_second_name ?? ""}`
                        .trim() || contact.contact_number,
                recipient_user_id: contact.linked_user_id,
                recipient_public_key: contact.linked_user_public_key ?? null,
                contact_phone: contact.contact_number,
                is_provisional: !existingChat,
                last_message_id: existingChat?.last_message_id ?? null,
                encrypted_preview_ciphertext:
                    existingChat?.encrypted_preview_ciphertext ?? null,
                encrypted_preview_iv: existingChat?.encrypted_preview_iv ?? null,
                encrypted_preview_algorithm:
                    existingChat?.encrypted_preview_algorithm ?? null,
                chat_recipient_keys: existingChat?.chat_recipient_keys ?? null,
                last_message_context: existingChat?.last_message_context ?? "",
                last_message_media: existingChat?.last_message_media ?? null,
                last_message_sender_is_me:
                    existingChat?.last_message_sender_is_me ?? false,
                last_message_sender_nickname:
                    existingChat?.last_message_sender_nickname ?? currentUserId,
                is_unreaded_chat: existingChat?.is_unreaded_chat ?? false,
                unreaded_messages_length:
                    existingChat?.unreaded_messages_length ?? 0,
                is_archived_chat: existingChat?.is_archived_chat ?? false,
                is_muted_chat_notifications:
                    existingChat?.is_muted_chat_notifications ?? false,
                is_pinned_chat: existingChat?.is_pinned_chat ?? false,
                is_favourite_chat: existingChat?.is_favourite_chat ?? false,
                is_blocked_chat: existingChat?.is_blocked_chat ?? false,
                created_at: existingChat?.created_at ?? new Date(),
                updated_at: existingChat?.updated_at ?? new Date(),
            };

            return {
                chats: sortChatsByRecent([
                    ...state.chats.filter((chat) => chat.chat_id !== chatId),
                    nextChat,
                ]),
                selectedChatId: chatId,
                recipientPhone: contact.contact_number,
            };
        });

        return chatId;
    },
    reset: () =>
        set({
            chats: [],
            chatsLoading: false,
            chatsError: null,
            selectedChatId: null,
            recipientPhone: null,
            draftsByChatId: {},
            messagesByChatId: {},
            messagesLoadingByChatId: {},
            presenceByChatId: {},
        }),
}));
