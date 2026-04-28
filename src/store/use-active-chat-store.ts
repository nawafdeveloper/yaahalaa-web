import { create } from "zustand";
import type { ChatItemType } from "@/types/chats.type";
import type { Message } from "@/types/messages.type";
import { sortChatsByRecent, sortMessagesChronologically } from "@/lib/chat-utils";

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
    messagesByChatId: Record<string, Message[]>;
    messagesLoadingByChatId: Record<string, boolean>;
    presenceByChatId: Record<string, PresenceState>;
    setChats: (chats: ChatItemType[]) => void;
    upsertChat: (chat: ChatItemType) => void;
    setChatsLoading: (loading: boolean) => void;
    setChatsError: (error: string | null) => void;
    setSelectedChatId: (chatId: string | null) => void;
    setRecipientPhone: (phone: string | null) => void;
    setMessages: (chatId: string, messages: Message[]) => void;
    appendMessage: (chatId: string, message: Message) => void;
    setMessagesLoading: (chatId: string, loading: boolean) => void;
    setPresence: (chatId: string, presence: PresenceState) => void;
    markChatRead: (chatId: string) => void;
    reset: () => void;
}

export const useActiveChatStore = create<ActiveChatState>((set) => ({
    chats: [],
    chatsLoading: false,
    chatsError: null,
    selectedChatId: null,
    recipientPhone: null,
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
    setSelectedChatId: (chatId) => set({ selectedChatId: chatId }),
    setRecipientPhone: (phone) => set({ recipientPhone: phone }),
    setMessages: (chatId, messages) =>
        set((state) => ({
            messagesByChatId: {
                ...state.messagesByChatId,
                [chatId]: sortMessagesChronologically(messages),
            },
        })),
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
        set((state) => ({
            chats: state.chats.map((chat) =>
                chat.chat_id === chatId
                    ? {
                          ...chat,
                          is_unreaded_chat: false,
                          unreaded_messages_length: 0,
                      }
                    : chat
            ),
        })),
    reset: () =>
        set({
            chats: [],
            chatsLoading: false,
            chatsError: null,
            selectedChatId: null,
            recipientPhone: null,
            messagesByChatId: {},
            messagesLoadingByChatId: {},
            presenceByChatId: {},
        }),
}));
