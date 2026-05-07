"use client";

import ContextMenu from "@/context/menu";
import { useCryptoKeys } from "@/context/crypto";
import { authClient } from "@/lib/auth-client";
import { decryptMessageBatch } from "@/lib/chat-e2ee";
import { normalizeMessage } from "@/lib/chat-utils";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { Message } from "@/types/messages.type";
import {
    CheckBoxOutlined,
    DeleteForeverOutlined,
    DoDisturbOnOutlined,
    DoNotDisturbOutlined,
    ExpandMore,
    HighlightOffOutlined,
    InfoOutlined,
    NotificationsOffOutlined,
    ThumbDownOutlined,
} from "@mui/icons-material";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSendChatMessage } from "@/hooks/use-send-chat-message";
import { useForwardMessages } from "@/hooks/use-forward-messages";
import ChatRoomForwardButton from "./chat-room-forward-button";
import ChatRoomInputForm from "./chat-room-input-form";
import ChatRoomInputSelectMode from "./chat-room-input-select-mode";
import ChatRoomMessageBubble from "./chat-room-message-bubble";
import ChatRoomTypingBubble from "./chat-room-typing-bubble";
import { CircularProgress } from "@mui/material";
import { useDetailedSidebarStore } from "@/store/use-detailed-sidebar-store";
import { useChatMenuActions } from "@/hooks/use-chat-menu-actions";

const EMPTY_MESSAGES: Message[] = [];
const BLOCKING_MEDIA_TYPES = new Set(["photo", "video", "voice", "file"]);
const PAGE_SIZE = 20;

type MediaStatusMap = Record<string, boolean>;
type RenderableMessageItem =
    | {
        type: "date";
        id: string;
        label: string;
    }
    | {
        type: "message";
        message: Message;
        isFirstInGroup: boolean;
    }
    | {
        type: "system";
        message: Message;
        label: string;
    };

function ChatRoomCenterBadge({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                px: 2,
                py: 1,
            }}
        >
            <Box
                sx={(theme) => ({
                    maxWidth: "min(78%, 520px)",
                    px: 1.5,
                    py: 0.25,
                    borderRadius: 1.5,
                    backgroundColor:
                        theme.palette.mode === "dark"
                            ? "rgba(29,31,31,1)"
                            : "rgba(247,245,243,1)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    color: "text.secondary",
                    textAlign: "center",
                })}
            >
                <Typography
                    component="span"
                    sx={{
                        fontSize: 12,
                        lineHeight: 1.35,
                        fontWeight: 500,
                        overflowWrap: "anywhere",
                    }}
                >
                    {children}
                </Typography>
            </Box>
        </Box>
    );
}

function FloatingDateBadge({ label }: { label: string | null }) {
    if (!label) return null;

    return (
        <Box
            sx={{
                position: "absolute",
                top: 8,
                left: 0,
                right: 0,
                zIndex: 20,
                display: "flex",
                justifyContent: "center",
                pointerEvents: "none",
            }}
        >
            <Box
                sx={(theme) => ({
                    maxWidth: "min(78%, 520px)",
                    px: 1.5,
                    py: 0.25,
                    borderRadius: 1.5,
                    backgroundColor:
                        theme.palette.mode === "dark"
                            ? "rgba(29,31,31,1)"
                            : "rgba(247,245,243,1)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    color: "text.secondary",
                    textAlign: "center",
                })}
            >
                <Typography
                    component="span"
                    sx={{
                        fontSize: 12,
                        lineHeight: 1.35,
                        fontWeight: 500,
                        overflowWrap: "anywhere",
                    }}
                >
                    {label}
                </Typography>
            </Box>
        </Box>
    );
}

function getMessageDayKey(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

function isSameDay(left: Date, right: Date) {
    return getMessageDayKey(left) === getMessageDayKey(right);
}

function formatDateBadge(date: Date, locale: string | null) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (isSameDay(date, today)) {
        return "Today";
    }

    if (isSameDay(date, yesterday)) {
        return "Yesterday";
    }

    return date.toLocaleDateString(locale ?? "en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    });
}

function isGroupSystemMessage(message: Message) {
    return Boolean(
        message.event &&
        "kind" in message.event &&
        message.event.kind === "group-system"
    );
}

function formatSystemMessage(message: Message) {
    const event = message.event;

    if (!event || !("kind" in event) || event.kind !== "group-system") {
        return message.message_text_content ?? "";
    }

    const actor = event.actor_name?.trim() || "Someone";
    const targetNames = (event.target_names ?? []).filter(Boolean);
    const targetLabel =
        targetNames.length > 0
            ? targetNames.join(", ")
            : event.target_user_ids?.join(", ") || "a member";

    switch (event.action) {
        case "member-left":
            return `${targetLabel} left the group`;
        case "member-added":
            return `${actor} added ${targetLabel}`;
        case "name-changed":
            return event.next_name
                ? `${actor} changed the group name to ${event.next_name}`
                : `${actor} changed the group name`;
        case "image-changed":
            return `${actor} changed the group image`;
        default:
            return message.message_text_content ?? "Group updated";
    }
}

function buildRenderableMessageItems(
    messages: Message[],
    locale: string | null
): RenderableMessageItem[] {
    const items: RenderableMessageItem[] = [];
    let previousDayKey: string | null = null;
    let previousBubbleMessage: Message | null = null;

    for (const message of messages) {
        const dayKey = getMessageDayKey(message.created_at);

        if (dayKey !== previousDayKey) {
            items.push({
                type: "date",
                id: dayKey,
                label: formatDateBadge(message.created_at, locale),
            });
            previousDayKey = dayKey;
            previousBubbleMessage = null;
        }

        if (isGroupSystemMessage(message)) {
            items.push({
                type: "system",
                message,
                label: formatSystemMessage(message),
            });
            previousBubbleMessage = null;
            continue;
        }

        const isFirstInGroup =
            !previousBubbleMessage ||
            previousBubbleMessage.sender_user_id !== message.sender_user_id ||
            !isSameDay(previousBubbleMessage.created_at, message.created_at) ||
            Boolean(previousBubbleMessage.message_raction?.reaction_emoji);

        items.push({
            type: "message",
            message,
            isFirstInGroup,
        });
        previousBubbleMessage = message;
    }

    return items;
}

async function preloadImageAsset(src: string) {
    await new Promise<void>((resolve, reject) => {
        const image = new window.Image();

        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Failed to preload image asset"));
        image.src = src;
    });
}

function ChatRoomMessageMediaPreloader({
    message,
    onStatusChange,
}: {
    message: Message;
    onStatusChange: (messageId: string, ready: boolean) => void;
}) {
    useEffect(() => {
        let isActive = true;

        const markReady = (ready: boolean) => {
            if (isActive) {
                onStatusChange(message.message_id, ready);
            }
        };

        const prepare = async () => {
            const attachedMedia = message.attached_media;
            const shouldBlock =
                Boolean(message.client_received_via_realtime) &&
                attachedMedia !== null &&
                BLOCKING_MEDIA_TYPES.has(attachedMedia);

            if (!shouldBlock) {
                markReady(true);
                return;
            }

            if (!message.media_url) {
                markReady(false);
                return;
            }

            if (
                (message.attached_media === "photo" ||
                    message.attached_media === "video") &&
                message.media_preview_url
            ) {
                try {
                    await preloadImageAsset(message.media_preview_url);
                } catch {
                    // Avoid blocking the bubble forever on a failed preview decode.
                }
            }

            markReady(true);
        };

        void prepare();

        return () => {
            isActive = false;
        };
    }, [
        message.attached_media,
        message.client_received_via_realtime,
        message.media_preview_url,
        message.media_url,
        message.message_id,
        onStatusChange,
    ]);

    return null;
}

export default function ChatRoomContent() {
    const { isReady } = useCryptoKeys();
    const { data: session } = authClient.useSession();
    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const messagesByChatId = useActiveChatStore((state) => state.messagesByChatId);
    const messagesLoadingByChatId = useActiveChatStore((state) => state.messagesLoadingByChatId);
    const olderMessagesLoadingByChatId = useActiveChatStore(
        (state) => state.olderMessagesLoadingByChatId
    );
    const chats = useActiveChatStore((state) => state.chats);
    const openDetailedSidebar = useDetailedSidebarStore((state) => state.open);
    const hasOlderMessagesByChatId = useActiveChatStore(
        (state) => state.hasOlderMessagesByChatId
    );
    const setSelectedChatId = useActiveChatStore((state) => state.setSelectedChatId);
    const setMessages = useActiveChatStore((state) => state.setMessages);
    const setOlderMessagesLoading = useActiveChatStore(
        (state) => state.setOlderMessagesLoading
    );
    const setHasOlderMessages = useActiveChatStore(
        (state) => state.setHasOlderMessages
    );
    const {
        isUpdating,
        setChatPreference,
    } = useChatMenuActions();
    const typingByChatId = useActiveChatStore((state) => state.typingByChatId);
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const { sendMessage } = useSendChatMessage();
    const { forwardMessages, isForwarding } = useForwardMessages();
    const selectedChat = chats.find((chat) => chat.chat_id === selectedChatId) ?? null;

    const [floatingDateLabel, setFloatingDateLabel] = useState<string | null>(null);
    const dateBadgeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
    const [forwardDialogMessages, setForwardDialogMessages] = useState<Message[]>([]);
    const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
    const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
    const [mediaReadyByMessageId, setMediaReadyByMessageId] = useState<MediaStatusMap>(
        {}
    );
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const prependScrollStateRef = useRef<{
        chatId: string;
        previousScrollHeight: number;
        previousScrollTop: number;
    } | null>(null);
    const previousSelectedChatIdRef = useRef<string | null>(null);
    const previousLastMessageIdRef = useRef<string | null>(null);

    const isDisabled = isUpdating || !selectedChatId || !selectedChat;
    const messages = selectedChatId
        ? messagesByChatId[selectedChatId] ?? EMPTY_MESSAGES
        : EMPTY_MESSAGES;
    const messagesLoading = selectedChatId
        ? messagesLoadingByChatId[selectedChatId] ?? false
        : false;
    const olderMessagesLoading = selectedChatId
        ? olderMessagesLoadingByChatId[selectedChatId] ?? false
        : false;
    const hasOlderMessages = selectedChatId
        ? hasOlderMessagesByChatId[selectedChatId] ?? false
        : false;
    const activeTypingUsers = selectedChatId
        ? typingByChatId[selectedChatId]?.activeTypingUsers ?? []
        : [];
    const currentUserId = session?.user.id ?? null;
    const shouldDelayRealtimeMediaBubble = React.useCallback(
        (message: Message) => {
            if (
                !currentUserId ||
                !message.client_received_via_realtime ||
                message.sender_user_id === currentUserId ||
                !message.attached_media
            ) {
                return false;
            }

            return BLOCKING_MEDIA_TYPES.has(message.attached_media);
        },
        [currentUserId]
    );
    const blockingMediaMessages = messages.filter((message) => {
        return shouldDelayRealtimeMediaBubble(message);
    });
    const visibleMessages = messages.filter((message) => {
        if (!shouldDelayRealtimeMediaBubble(message)) {
            return true;
        }

        return mediaReadyByMessageId[message.message_id] === true;
    });
    const renderableMessageItems = React.useMemo(
        () => buildRenderableMessageItems(visibleMessages, locale),
        [locale, visibleMessages]
    );
    const isMediaReady =
        blockingMediaMessages.length === 0 ||
        blockingMediaMessages.every(
            (message) => mediaReadyByMessageId[message.message_id] === true
        );
    const shouldShowInitialLoader =
        (messagesLoading && visibleMessages.length === 0) ||
        (!isMediaReady && visibleMessages.length === 0);
    const handleMediaReadyChange = React.useCallback(
        (messageId: string, ready: boolean) => {
            setMediaReadyByMessageId((current) => {
                if (current[messageId] === ready) {
                    return current;
                }

                return {
                    ...current,
                    [messageId]: ready,
                };
            });
        },
        []
    );

    const scrollToBottom = (behavior: ScrollBehavior) => {
        bottomRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom("instant");
        }
    }, []);

    useEffect(() => {
        const listElement = listRef.current;
        if (!listElement) return;

        const observers: IntersectionObserver[] = [];

        dateBadgeRefs.current.forEach((element, dayKey) => {
            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry && !entry.isIntersecting && entry.boundingClientRect.top < 0) {
                        const item = renderableMessageItems.find(
                            (i) => i.type === "date" && i.id === dayKey
                        );
                        if (item && item.type === "date") {
                            setFloatingDateLabel(item.label);
                        }
                    }
                },
                {
                    root: listElement,
                    threshold: 0,
                    rootMargin: "0px 0px -100% 0px",
                }
            );
            observer.observe(element);
            observers.push(observer);
        });

        const firstDateItem = renderableMessageItems.find((i) => i.type === "date");
        if (firstDateItem && firstDateItem.type === "date") {
            const firstEl = dateBadgeRefs.current.get(firstDateItem.id);
            if (firstEl) {
                const observer = new IntersectionObserver(
                    ([entry]) => {
                        if (entry?.isIntersecting) {
                            setFloatingDateLabel(null);
                        }
                    },
                    { root: listElement, threshold: 0.1 }
                );
                observer.observe(firstEl);
                observers.push(observer);
            }
        }

        return () => observers.forEach((o) => o.disconnect());
    }, [renderableMessageItems]);

    useEffect(() => {
        if (activeTypingUsers.length > 0) {
            scrollToBottom("smooth");
        }
    }, [activeTypingUsers.length]);

    const loadOlderMessages = React.useCallback(async () => {
        if (
            !selectedChatId ||
            !currentUserId ||
            !isReady ||
            messagesLoading ||
            olderMessagesLoading ||
            !hasOlderMessages ||
            messages.length === 0
        ) {
            return;
        }

        const oldestMessage = messages[0];
        if (!oldestMessage) {
            return;
        }

        const listElement = listRef.current;
        if (listElement) {
            prependScrollStateRef.current = {
                chatId: selectedChatId,
                previousScrollHeight: listElement.scrollHeight,
                previousScrollTop: listElement.scrollTop,
            };
        }

        try {
            setOlderMessagesLoading(selectedChatId, true);
            const response = await fetch(
                `/api/messages?chatRoomId=${encodeURIComponent(selectedChatId)}&limit=${PAGE_SIZE}&beforeCreatedAt=${encodeURIComponent(oldestMessage.created_at.toISOString())}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch older messages");
            }

            const payload = (await response.json()) as {
                messages: (Omit<Message, "created_at" | "updated_at"> & {
                    created_at: string;
                    updated_at: string;
                })[];
                hasMore?: boolean;
            };

            const normalizedMessages = payload.messages.map(normalizeMessage);
            const decryptedMessages = await decryptMessageBatch({
                currentUserId,
                messages: normalizedMessages,
            });

            setMessages(selectedChatId, decryptedMessages);
            setHasOlderMessages(
                selectedChatId,
                payload.hasMore ?? normalizedMessages.length === PAGE_SIZE
            );
        } catch {
            prependScrollStateRef.current = null;
        } finally {
            if (selectedChatId) {
                setOlderMessagesLoading(selectedChatId, false);
            }
        }
    }, [
        currentUserId,
        hasOlderMessages,
        isReady,
        messages,
        messagesLoading,
        olderMessagesLoading,
        selectedChatId,
        setHasOlderMessages,
        setMessages,
        setOlderMessagesLoading,
    ]);

    const scrollToMessageById = React.useCallback(
        async (messageId: string) => {
            if (!selectedChatId || !currentUserId || !isReady) {
                return;
            }

            const findMessageElement = () => {
                const listElement = listRef.current;

                if (!listElement) {
                    return null;
                }

                return Array.from(
                    listElement.querySelectorAll<HTMLElement>("[data-message-id]")
                ).find(
                    (element) => element.dataset.messageId === messageId
                ) ?? null;
            };

            let targetElement = findMessageElement();

            for (let attempt = 0; !targetElement && attempt < 60; attempt += 1) {
                const state = useActiveChatStore.getState();
                const chatMessages = state.messagesByChatId[selectedChatId] ?? [];
                const canLoadOlder =
                    state.hasOlderMessagesByChatId[selectedChatId] ?? false;
                const oldestMessage = chatMessages[0];

                if (!canLoadOlder || !oldestMessage) {
                    break;
                }

                try {
                    setOlderMessagesLoading(selectedChatId, true);
                    const response = await fetch(
                        `/api/messages?chatRoomId=${encodeURIComponent(selectedChatId)}&limit=${PAGE_SIZE}&beforeCreatedAt=${encodeURIComponent(oldestMessage.created_at.toISOString())}`,
                        { cache: "no-store" }
                    );

                    if (!response.ok) {
                        break;
                    }

                    const payload = (await response.json()) as {
                        messages: (Omit<Message, "created_at" | "updated_at"> & {
                            created_at: string;
                            updated_at: string;
                        })[];
                        hasMore?: boolean;
                    };
                    const normalizedMessages = payload.messages.map(normalizeMessage);
                    const decryptedMessages = await decryptMessageBatch({
                        currentUserId,
                        messages: normalizedMessages,
                    });

                    setMessages(selectedChatId, decryptedMessages);
                    setHasOlderMessages(
                        selectedChatId,
                        payload.hasMore ?? normalizedMessages.length === PAGE_SIZE
                    );

                    await new Promise((resolve) => window.setTimeout(resolve, 0));
                    targetElement = findMessageElement();
                } finally {
                    setOlderMessagesLoading(selectedChatId, false);
                }
            }

            window.requestAnimationFrame(() => {
                const element = targetElement ?? findMessageElement();

                if (!element) {
                    return;
                }

                element.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                });

                window.setTimeout(() => {
                    window.dispatchEvent(
                        new CustomEvent("chat-room:pinned-message-visible", {
                            detail: {
                                chatId: selectedChatId,
                                messageId,
                            },
                        })
                    );
                }, 450);
            });
        },
        [
            currentUserId,
            isReady,
            selectedChatId,
            setHasOlderMessages,
            setMessages,
            setOlderMessagesLoading,
        ]
    );

    useEffect(() => {
        const handleScrollToMessage = (event: Event) => {
            const detail = (
                event as CustomEvent<{ chatId?: string; messageId?: string }>
            ).detail;

            if (
                !detail?.messageId ||
                !selectedChatId ||
                detail.chatId !== selectedChatId
            ) {
                return;
            }

            void scrollToMessageById(detail.messageId);
        };

        window.addEventListener("chat-room:scroll-to-message", handleScrollToMessage);

        return () => {
            window.removeEventListener(
                "chat-room:scroll-to-message",
                handleScrollToMessage
            );
        };
    }, [scrollToMessageById, selectedChatId]);

    useEffect(() => {
        const listElement = listRef.current;
        if (!listElement) {
            return;
        }

        const handleScroll = () => {
            setShowScrollToBottomButton(listElement.scrollTop < -1 ? false : listElement.scrollHeight - listElement.clientHeight - listElement.scrollTop > 220);

            if (listElement.scrollTop <= 96) {
                void loadOlderMessages();
            }
        };

        handleScroll();

        listElement.addEventListener("scroll", handleScroll);

        return () => {
            listElement.removeEventListener("scroll", handleScroll);
        };
    }, [loadOlderMessages]);

    useLayoutEffect(() => {
        const listElement = listRef.current;
        const pendingPrepend = prependScrollStateRef.current;
        const currentLastMessageId = messages[messages.length - 1]?.message_id ?? null;
        const previousSelectedChatId = previousSelectedChatIdRef.current;
        const previousLastMessageId = previousLastMessageIdRef.current;

        if (
            listElement &&
            pendingPrepend &&
            pendingPrepend.chatId === selectedChatId
        ) {
            const scrollDelta =
                listElement.scrollHeight - pendingPrepend.previousScrollHeight;
            listElement.scrollTop =
                pendingPrepend.previousScrollTop + scrollDelta;
            prependScrollStateRef.current = null;
        } else if (
            messages.length > 0 &&
            (previousSelectedChatId !== selectedChatId ||
                (previousLastMessageId !== currentLastMessageId &&
                    previousLastMessageId !== null))
        ) {
            scrollToBottom(
                previousSelectedChatId !== selectedChatId ? "instant" : "smooth"
            );
        }

        previousSelectedChatIdRef.current = selectedChatId;
        previousLastMessageIdRef.current = currentLastMessageId;
    }, [messages, selectedChatId]);

    useEffect(() => {
        setShowScrollToBottomButton(false);
    }, [selectedChatId]);

    useEffect(() => {
        const nextStatuses = blockingMediaMessages.reduce<MediaStatusMap>(
            (accumulator, message) => {
                accumulator[message.message_id] =
                    mediaReadyByMessageId[message.message_id] ?? false;
                return accumulator;
            },
            {}
        );

        setMediaReadyByMessageId((current) => {
            const currentKeys = Object.keys(current);
            const nextKeys = Object.keys(nextStatuses);

            if (
                currentKeys.length === nextKeys.length &&
                nextKeys.every((key) => current[key] === nextStatuses[key])
            ) {
                return current;
            }

            return nextStatuses;
        });
    }, [blockingMediaMessages, mediaReadyByMessageId]);

    const getWallpaper = (mode: "dark" | "light") => {
        if (!session) {
            return mode === "dark"
                ? "url('/chat-background-dark.svg')"
                : "url('/chat-background-light.svg')";
        }

        switch (session.user.chatWallpaper) {
            case "wallpaper-1":
                return mode === "dark" ? "url('/dark-wallpaper-1.svg')" : "url('/light-wallpaper-1.svg')";
            case "wallpaper-2":
                return mode === "dark" ? "url('/dark-wallpaper-2.svg')" : "url('/light-wallpaper-2.svg')";
            case "wallpaper-3":
                return mode === "dark" ? "url('/dark-wallpaper-3.svg')" : "url('/light-wallpaper-3.svg')";
            case "wallpaper-4":
                return mode === "dark" ? "url('/dark-wallpaper-4.svg')" : "url('/light-wallpaper-4.svg')";
            case "wallpaper-5":
                return mode === "dark" ? "url('/dark-wallpaper-5.svg')" : "url('/light-wallpaper-5.svg')";
            case "wallpaper-6":
                return mode === "dark" ? "url('/dark-wallpaper-6.svg')" : "url('/light-wallpaper-6.svg')";
            case "wallpaper-7":
                return mode === "dark" ? "url('/dark-wallpaper-7.svg')" : "url('/light-wallpaper-7.svg')";
            case "wallpaper-8":
                return mode === "dark" ? "url('/dark-wallpaper-8.svg')" : "url('/light-wallpaper-8.svg')";
            case "wallpaper-9":
                return mode === "dark" ? "url('/dark-wallpaper-9.svg')" : "url('/light-wallpaper-9.svg')";
            case "wallpaper-10":
                return mode === "dark" ? "url('/dark-wallpaper-10.svg')" : "url('/light-wallpaper-10.svg')";
            default:
                return mode === "dark"
                    ? "url('/chat-background-dark.svg')"
                    : "url('/chat-background-light.svg')";
        }
    };

    const handleOpenDetails = () => {
        if (!selectedChat) {
            return;
        }

        openDetailedSidebar({
            type: "chat",
            chatId: selectedChat.chat_id,
        });
    };

    const openForwardDialog = React.useCallback((messagesToForward: Message[]) => {
        if (messagesToForward.length === 0) {
            return;
        }

        setForwardDialogMessages(messagesToForward);
        setForwardDialogOpen(true);
    }, []);

    const handleForwardSelectedMessages = React.useCallback(() => {
        const selectedMessageSet = new Set(selectedMessages);
        openForwardDialog(
            visibleMessages.filter((message) =>
                selectedMessageSet.has(message.message_id)
            )
        );
    }, [openForwardDialog, selectedMessages, visibleMessages]);

    const handleForwardToChats = React.useCallback(
        async (chatIds: string[]) => {
            const didForward = await forwardMessages({
                messages: forwardDialogMessages,
                targetChatIds: chatIds,
            });

            if (!didForward) {
                return;
            }

            setForwardDialogOpen(false);
            setForwardDialogMessages([]);
            setIsSelectMode(false);
            setSelectedMessages([]);
        },
        [forwardDialogMessages, forwardMessages]
    );

    const handleToggleNotifications = async (
    ) => {
        if (!selectedChatId || !selectedChat) {
            return;
        }

        await setChatPreference(
            selectedChatId,
            "is_muted_chat_notifications",
            !selectedChat.is_muted_chat_notifications
        );
    };

    return (
        <Box
            ref={containerRef}
            sx={(theme) => ({
                height: "100%",
                width: "100%",
                position: "relative",
                display: "flex",
                overflow: "hidden",
                backgroundImage: getWallpaper(theme.palette.mode),
                backgroundRepeat: "repeat",
                backgroundSize: "110px",
                backgroundColor: theme.palette.mode === "dark" ? "#161717" : "#f5f5f5",
            })}
        >
            <FloatingDateBadge label={floatingDateLabel} />
            <List
                ref={listRef}
                sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                    paddingBottom: 8,
                }}
            >
                {blockingMediaMessages.map((message) => (
                    <ChatRoomMessageMediaPreloader
                        key={`preload-${message.message_id}`}
                        message={message}
                        onStatusChange={handleMediaReadyChange}
                    />
                ))}
                {!shouldShowInitialLoader &&
                    olderMessagesLoading &&
                    messages.length > 0 && (
                        <div className="sticky top-0 z-10 flex justify-center py-3">
                            <div className="rounded-full border border-neutral-300 bg-[#f7f5f3] px-3 py-2 shadow-sm dark:border-neutral-700 dark:bg-[#1d1f1f]">
                                <CircularProgress
                                    size={18}
                                    aria-label="Loading older messages"
                                />
                            </div>
                        </div>
                    )}
                {shouldShowInitialLoader ? (
                    <div className="flex justify-center items-end h-full w-full">
                        <CircularProgress aria-label="Loading…" className="p-2 rounded-full shadow-sm dark:bg-[#1d1f1f] bg-[#f7f5f3] border dark:border-neutral-700 border-neutral-300" />
                    </div>
                ) : visibleMessages.length === 0 ? (
                    <Box
                        sx={{
                            mx: "auto",
                            mt: "auto",
                            px: 2.5,
                            py: 1.5,
                            borderRadius: 3,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            backgroundColor: (theme) =>
                                theme.palette.mode === "dark"
                                    ? "rgba(22,23,23,0.82)"
                                    : "rgba(255,255,255,0.92)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                        }}
                    >
                        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                            {isRTL
                                ? "جميع محادثاتك مشفرة من طرف إلى طرف"
                                : "Your messages are end-to-end encrypted."}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <ChatRoomCenterBadge>
                            Your messages are end-to-end encrypted.
                        </ChatRoomCenterBadge>
                        {renderableMessageItems.map((item) => {
                            if (item.type === "date") {
                                return (
                                    <div
                                        key={`date-${item.id}`}
                                        ref={(el) => {
                                            if (el) dateBadgeRefs.current.set(item.id, el);
                                            else dateBadgeRefs.current.delete(item.id);
                                        }}
                                    >
                                        <ChatRoomCenterBadge>
                                            {item.label}
                                        </ChatRoomCenterBadge>
                                    </div>
                                );
                            }

                            if (item.type === "system") {
                                return (
                                    <ChatRoomCenterBadge
                                        key={item.message.message_id}
                                    >
                                        {item.label}
                                    </ChatRoomCenterBadge>
                                );
                            }

                            return (
                                <ChatRoomMessageBubble
                                    key={item.message.message_id}
                                    message={item.message}
                                    isFirstInGroup={item.isFirstInGroup}
                                    isSelectMode={isSelectMode}
                                    selectedMessages={selectedMessages}
                                    setSelectedMessages={setSelectedMessages}
                                    onRetry={() =>
                                        void sendMessage({
                                            text:
                                                item.message
                                                    .message_text_content ?? "",
                                            chatId: item.message.chat_room_id,
                                            clearDraft: false,
                                            existingMessageId:
                                                item.message.message_id,
                                        })
                                    }
                                    onForward={(message) =>
                                        openForwardDialog([message])
                                    }
                                />
                            );
                        })}
                    </>
                )}
                <ChatRoomTypingBubble />
                <div ref={bottomRef} />
            </List>
            {isSelectMode ? (
                <ChatRoomInputSelectMode
                    setSelectMode={setIsSelectMode}
                    selectedCount={selectedMessages.length}
                    setSelectedMessages={setSelectedMessages}
                    onForwardSelected={handleForwardSelectedMessages}
                />
            ) : (
                <ChatRoomInputForm />
            )}
            <ChatRoomForwardButton
                open={forwardDialogOpen}
                onClose={() => {
                    if (!isForwarding) {
                        setForwardDialogOpen(false);
                        setForwardDialogMessages([]);
                    }
                }}
                onForward={handleForwardToChats}
                loading={isForwarding}
                sourceCount={forwardDialogMessages.length}
            />
            {showScrollToBottomButton ? (
                <div className={`absolute bottom-18 ${isRTL ? 'left-4' : 'right-4'} z-50`}>
                    <button
                        type="button"
                        onClick={() => scrollToBottom("smooth")}
                        className="flex items-center justify-center rounded-full bg-[#ffffff] p-2 shadow-sm transition hover:scale-[1.03] dark:bg-[#222424]"
                    >
                        <ExpandMore className="size-4" />
                    </button>
                </div>
            ) : null}
            <ContextMenu
                containerRef={containerRef}
                items={[
                    { label: isRTL ? "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u062c\u0647\u0629 \u0627\u0644\u0627\u062a\u0635\u0627\u0644" : "Contact Info", onClick: handleOpenDetails, icon: <InfoOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0631\u0633\u0627\u0626\u0644" : "Select messages", onClick: () => setIsSelectMode(true), icon: <CheckBoxOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u0643\u062a\u0645 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a" : "Mute notifications", onClick: () => handleToggleNotifications(), icon: <NotificationsOffOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629" : "Close chat", onClick: () => setSelectedChatId(null), icon: <HighlightOffOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u062d\u0638\u0631" : "Block", onClick: () => { }, icon: <DoNotDisturbOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u062d\u0630\u0641 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629" : "Delete chat", onClick: () => { }, icon: <DeleteForeverOutlined fontSize="medium" /> },
                ]}
            />
        </Box>
    );
}
