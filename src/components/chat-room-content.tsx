"use client";

import ContextMenu from "@/context/menu";
import { authClient } from "@/lib/auth-client";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { Message } from "@/types/messages.type";
import {
    CheckBoxOutlined,
    DeleteForeverOutlined,
    DoDisturbOnOutlined,
    DoNotDisturbOutlined,
    HighlightOffOutlined,
    InfoOutlined,
    LockOutlined,
    NotificationsOffOutlined,
    ThumbDownOutlined,
} from "@mui/icons-material";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import React, { useRef, useState } from "react";
import { useSendChatMessage } from "@/hooks/use-send-chat-message";
import ChatRoomInputForm from "./chat-room-input-form";
import ChatRoomInputSelectMode from "./chat-room-input-select-mode";
import ChatRoomMessageBubble from "./chat-room-message-bubble";

const EMPTY_MESSAGES: Message[] = [];

export default function ChatRoomContent() {
    const { data: session } = authClient.useSession();
    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const messagesByChatId = useActiveChatStore((state) => state.messagesByChatId);
    const messagesLoadingByChatId = useActiveChatStore((state) => state.messagesLoadingByChatId);
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const { sendMessage } = useSendChatMessage();

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    const messages = selectedChatId
        ? messagesByChatId[selectedChatId] ?? EMPTY_MESSAGES
        : EMPTY_MESSAGES;
    const messagesLoading = selectedChatId
        ? messagesLoadingByChatId[selectedChatId] ?? false
        : false;

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
            <List
                sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                    paddingBottom: 8,
                }}
            >
                {messagesLoading ? (
                    <Typography sx={{ px: 3, py: 3, color: "text.secondary" }}>
                        Loading messages...
                    </Typography>
                ) : messages.length === 0 ? (
                    <Box
                        sx={{
                            mx: "auto",
                            my: "auto",
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
                        <LockOutlined sx={{ fontSize: 16, color: "#25D366" }} />
                        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                            {isRTL
                                ? "\u0631\u0633\u0627\u0626\u0644\u0643 \u0645\u062d\u0645\u064a\u0629 \u0628\u0627\u0644\u062a\u0634\u0641\u064a\u0631 \u0645\u0646 \u0637\u0631\u0641\u064a\u0646."
                                : "Your messages are end-to-end encrypted."}
                        </Typography>
                    </Box>
                ) : messages.map((item) => (
                    <ChatRoomMessageBubble
                        key={item.message_id}
                        message={item}
                        isSelectMode={isSelectMode}
                        selectedMessages={selectedMessages}
                        setSelectedMessages={setSelectedMessages}
                        onRetry={() =>
                            void sendMessage({
                                text: item.message_text_content ?? "",
                                chatId: item.chat_room_id,
                                clearDraft: false,
                                existingMessageId: item.message_id,
                            })
                        }
                    />
                ))}
            </List>
            {isSelectMode ? (
                <ChatRoomInputSelectMode
                    setSelectMode={setIsSelectMode}
                    selectedCount={selectedMessages.length}
                    setSelectedMessages={setSelectedMessages}
                />
            ) : (
                <ChatRoomInputForm />
            )}
            <ContextMenu
                containerRef={containerRef}
                items={[
                    { label: isRTL ? "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u062c\u0647\u0629 \u0627\u0644\u0627\u062a\u0635\u0627\u0644" : "Contact Info", onClick: () => { }, icon: <InfoOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0631\u0633\u0627\u0626\u0644" : "Select messages", onClick: () => setIsSelectMode(true), icon: <CheckBoxOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u0643\u062a\u0645 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a" : "Mute notifications", onClick: () => { }, icon: <NotificationsOffOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629" : "Close chat", onClick: () => { }, icon: <HighlightOffOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u0625\u0628\u0644\u0627\u063a" : "Report", onClick: () => { }, icon: <ThumbDownOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u062d\u0638\u0631" : "Block", onClick: () => { }, icon: <DoNotDisturbOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u062d\u0630\u0641 \u0627\u0644\u0631\u0633\u0627\u0626\u0644" : "Clear chat", onClick: () => { }, icon: <DoDisturbOnOutlined fontSize="medium" /> },
                    { label: isRTL ? "\u062d\u0630\u0641 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629" : "Delete chat", onClick: () => { }, icon: <DeleteForeverOutlined fontSize="medium" /> },
                ]}
            />
        </Box>
    );
}
