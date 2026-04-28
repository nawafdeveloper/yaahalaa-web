"use client";

import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import {
    buildChatFromMessage,
    normalizeChatItem,
    normalizeMessage,
    resolveDirectChatPartner,
} from "@/lib/chat-utils";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { useRealtimeStore } from "@/store/use-realtime-store";
import type { ChatItemType } from "@/types/chats.type";
import type { Message } from "@/types/messages.type";
import type { ServerRealtimeEvent } from "@/types/realtime-events";

export function useChatRealtime() {
    const { data: session } = authClient.useSession();
    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const chats = useActiveChatStore((state) => state.chats);
    const setChats = useActiveChatStore((state) => state.setChats);
    const upsertChat = useActiveChatStore((state) => state.upsertChat);
    const setChatsLoading = useActiveChatStore((state) => state.setChatsLoading);
    const setChatsError = useActiveChatStore((state) => state.setChatsError);
    const setMessages = useActiveChatStore((state) => state.setMessages);
    const appendMessage = useActiveChatStore((state) => state.appendMessage);
    const setMessagesLoading = useActiveChatStore(
        (state) => state.setMessagesLoading
    );
    const setPresence = useActiveChatStore((state) => state.setPresence);
    const markChatRead = useActiveChatStore((state) => state.markChatRead);
    const setRecipientPhone = useActiveChatStore((state) => state.setRecipientPhone);
    const setSocket = useRealtimeStore((state) => state.setSocket);
    const setStatus = useRealtimeStore((state) => state.setStatus);
    const sendEvent = useRealtimeStore((state) => state.sendEvent);

    const selectedChatIdRef = useRef<string | null>(selectedChatId);
    const joinedChatIdRef = useRef<string | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        selectedChatIdRef.current = selectedChatId;
    }, [selectedChatId]);

    useEffect(() => {
        if (!session?.user.id) {
            return;
        }

        let isCancelled = false;

        const fetchChats = async () => {
            try {
                setChatsLoading(true);
                setChatsError(null);

                const response = await fetch("/api/chats");
                if (!response.ok) {
                    throw new Error("Failed to fetch chats");
                }

                const payload = (await response.json()) as {
                    chats: ChatItemType[];
                };

                if (isCancelled) {
                    return;
                }

                setChats(payload.chats.map(normalizeChatItem));
            } catch (error) {
                if (isCancelled) {
                    return;
                }

                setChatsError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load chats"
                );
            } finally {
                if (!isCancelled) {
                    setChatsLoading(false);
                }
            }
        };

        void fetchChats();

        return () => {
            isCancelled = true;
        };
    }, [session?.user.id, setChats, setChatsError, setChatsLoading]);

    useEffect(() => {
        if (!selectedChatId) {
            setRecipientPhone(null);
            return;
        }

        const currentPhone = (session?.user as { phoneNumber?: string | null } | undefined)
            ?.phoneNumber;
        const selectedChat = chats.find((chat) => chat.chat_id === selectedChatId);

        if (selectedChat?.chat_type === "single") {
            setRecipientPhone(
                resolveDirectChatPartner(selectedChat.chat_id, currentPhone)
            );
            markChatRead(selectedChat.chat_id);
        } else {
            setRecipientPhone(null);
            markChatRead(selectedChatId);
        }
    }, [chats, markChatRead, selectedChatId, session?.user, setRecipientPhone]);

    useEffect(() => {
        if (!session?.user.id || !selectedChatId) {
            return;
        }

        let isCancelled = false;

        const fetchMessages = async () => {
            try {
                setMessagesLoading(selectedChatId, true);
                const response = await fetch(
                    `/api/messages?chatRoomId=${encodeURIComponent(selectedChatId)}`
                );
                if (!response.ok) {
                    throw new Error("Failed to fetch messages");
                }

                const payload = (await response.json()) as {
                    messages: (Omit<Message, "created_at" | "updated_at"> & {
                        created_at: string;
                        updated_at: string;
                    })[];
                };
                if (isCancelled) {
                    return;
                }

                setMessages(
                    selectedChatId,
                    payload.messages.map(normalizeMessage)
                );
            } catch (error) {
                if (!isCancelled) {
                    setChatsError(
                        error instanceof Error
                            ? error.message
                            : "Failed to load messages"
                    );
                }
            } finally {
                if (!isCancelled) {
                    setMessagesLoading(selectedChatId, false);
                }
            }
        };

        void fetchMessages();

        return () => {
            isCancelled = true;
        };
    }, [
        selectedChatId,
        session?.user.id,
        setChatsError,
        setMessages,
        setMessagesLoading,
    ]);

    useEffect(() => {
        if (!session?.user.id) {
            return;
        }

        let isDisposed = false;
        let socket: WebSocket | null = null;

        const handleServerEvent = (event: ServerRealtimeEvent) => {
            const currentUserId = session.user.id;

            switch (event.type) {
                case "NEW_MESSAGE": {
                    const nextMessage = normalizeMessage(event.message);
                    appendMessage(event.conversationId, nextMessage);

                    const existingChat = useActiveChatStore
                        .getState()
                        .chats.find((chat) => chat.chat_id === event.conversationId);
                    const isSelected =
                        useActiveChatStore.getState().selectedChatId ===
                        event.conversationId;
                    const unreadCount =
                        nextMessage.sender_user_id === currentUserId || isSelected
                            ? 0
                            : (existingChat?.unreaded_messages_length ?? 0) + 1;

                    upsertChat(
                        buildChatFromMessage({
                            conversationId: event.conversationId,
                            conversationType: event.conversationType,
                            message: nextMessage,
                            currentUserId,
                            unreadCount,
                            fallbackExistingChat: existingChat,
                        })
                    );
                    if (isSelected) {
                        markChatRead(event.conversationId);
                    }
                    break;
                }

                case "CONVERSATION_UPDATED": {
                    const nextMessage = normalizeMessage(event.lastMessage);
                    const existingChat = useActiveChatStore
                        .getState()
                        .chats.find((chat) => chat.chat_id === event.conversationId);
                    const isSelected =
                        useActiveChatStore.getState().selectedChatId ===
                        event.conversationId;

                    upsertChat(
                        buildChatFromMessage({
                            conversationId: event.conversationId,
                            conversationType: event.conversationType,
                            message: nextMessage,
                            currentUserId,
                            unreadCount: isSelected ? 0 : event.unreadCount,
                            fallbackExistingChat: existingChat,
                        })
                    );
                    break;
                }

                case "CONVERSATION_PRESENCE": {
                    setPresence(event.conversationId, {
                        activeUsers: event.activeUsers,
                        activeUsersCount: event.activeUsersCount,
                    });
                    break;
                }

                case "ERROR": {
                    setChatsError(event.message);
                    break;
                }

                default:
                    break;
            }
        };

        const connect = () => {
            setStatus("connecting");
            const protocol = window.location.protocol === "https:" ? "wss" : "ws";
            socket = new WebSocket(`${protocol}://${window.location.host}/api/realtime`);
            setSocket(socket);

            socket.addEventListener("open", () => {
                setStatus("connected");

                if (selectedChatIdRef.current) {
                    sendEvent({
                        type: "JOIN_CONVERSATION",
                        conversationId: selectedChatIdRef.current,
                    });
                }
            });

            socket.addEventListener("message", (messageEvent) => {
                try {
                    const payload = JSON.parse(
                        messageEvent.data as string
                    ) as ServerRealtimeEvent;
                    handleServerEvent(payload);
                } catch {
                    setChatsError("Received malformed realtime event");
                }
            });

            socket.addEventListener("error", () => {
                setStatus("error");
            });

            socket.addEventListener("close", () => {
                setSocket(null);
                if (isDisposed) {
                    return;
                }

                setStatus("error");
                reconnectTimeoutRef.current = window.setTimeout(connect, 1500);
            });
        };

        connect();

        return () => {
            isDisposed = true;
            if (reconnectTimeoutRef.current) {
                window.clearTimeout(reconnectTimeoutRef.current);
            }

            if (socket?.readyState === WebSocket.OPEN && selectedChatIdRef.current) {
                socket.send(
                    JSON.stringify({
                        type: "LEAVE_CONVERSATION",
                        conversationId: selectedChatIdRef.current,
                    })
                );
            }

            socket?.close();
            setSocket(null);
            setStatus("idle");
        };
    }, [
        appendMessage,
        markChatRead,
        sendEvent,
        session?.user.id,
        setChatsError,
        setPresence,
        setSocket,
        setStatus,
        upsertChat,
    ]);

    useEffect(() => {
        const previousSelectedChatId = joinedChatIdRef.current;

        if (previousSelectedChatId && previousSelectedChatId !== selectedChatId) {
            sendEvent({
                type: "LEAVE_CONVERSATION",
                conversationId: previousSelectedChatId,
            });
        }

        if (selectedChatId && previousSelectedChatId !== selectedChatId) {
            sendEvent({
                type: "JOIN_CONVERSATION",
                conversationId: selectedChatId,
            });
        }

        if (selectedChatId) {
            sendEvent({
                type: "MARK_READ",
                conversationId: selectedChatId,
            });
        }

        selectedChatIdRef.current = selectedChatId;
        joinedChatIdRef.current = selectedChatId;
    }, [selectedChatId, sendEvent]);
}
