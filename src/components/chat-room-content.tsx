"use client";

import Box from "@mui/material/Box";
import React, { useRef, useState } from "react";
import ChatRoomInputForm from "./chat-room-input-form";
import ChatRoomMessageBubble from "./chat-room-message-bubble";
import List from "@mui/material/List";
import { messages } from "@/mocks/messages";
import ContextMenu from "@/context/menu";
import { CheckBoxOutlined, DeleteForeverOutlined, DoDisturbOnOutlined, DoNotDisturbOutlined, HighlightOffOutlined, InfoOutlined, NotificationsOffOutlined, ThumbDownOutlined } from "@mui/icons-material";
import ChatRoomInputSelectMode from "./chat-room-input-select-mode";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import { authClient } from "@/lib/auth-client";

export default function ChatRoomContent() {
    const { data: session } = authClient.useSession();
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    const getWallpaper = (mode: 'dark' | 'light') => {
        if (!session) {
            return mode === 'dark' ? "url('/chat-background-dark.svg')" : "url('/chat-background-light.svg')"
        }

        switch (session.user.chatWallpaper) {
            case "wallpaper-1":
                return mode === 'dark' ? "url('/dark-wallpaper-1.svg')" : "url('/light-wallpaper-1.svg')";
            case "wallpaper-2":
                return mode === 'dark' ? "url('/dark-wallpaper-2.svg')" : "url('/light-wallpaper-2.svg')";
            case "wallpaper-3":
                return mode === 'dark' ? "url('/dark-wallpaper-3.svg')" : "url('/light-wallpaper-3.svg')";
            case "wallpaper-4":
                return mode === 'dark' ? "url('/dark-wallpaper-4.svg')" : "url('/light-wallpaper-4.svg')";
            case "wallpaper-5":
                return mode === 'dark' ? "url('/dark-wallpaper-5.svg')" : "url('/light-wallpaper-5.svg')";
            case "wallpaper-6":
                return mode === 'dark' ? "url('/dark-wallpaper-6.svg')" : "url('/light-wallpaper-6.svg')";
            case "wallpaper-7":
                return mode === 'dark' ? "url('/dark-wallpaper-7.svg')" : "url('/light-wallpaper-7.svg')";
            case "wallpaper-8":
                return mode === 'dark' ? "url('/dark-wallpaper-8.svg')" : "url('/light-wallpaper-8.svg')";
            case "wallpaper-9":
                return mode === 'dark' ? "url('/dark-wallpaper-9.svg')" : "url('/light-wallpaper-9.svg')";
            case "wallpaper-10":
                return mode === 'dark' ? "url('/dark-wallpaper-10.svg')" : "url('/light-wallpaper-10.svg')";
            default:
                return mode === 'dark' ? "url('/chat-background-dark.svg')" : "url('/chat-background-light.svg')"
        };
    };

    return (
        <Box
            ref={containerRef}
            sx={(theme) => ({
                height: "100%",
                width: "100%",
                position: "relative",
                display: "flex",
                overflow: 'hidden',
                backgroundImage: getWallpaper(theme.palette.mode),
                backgroundRepeat: "repeat",
                backgroundSize: "110px",
                backgroundColor:
                    theme.palette.mode === "dark" ? "#161717" : "#f5f5f5",
            })}
        >
            <List
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    paddingBottom: 8,
                }}
            >
                {messages.map((item, index) => (
                    <ChatRoomMessageBubble
                        key={index}
                        message={item}
                        isSelectMode={isSelectMode}
                        selectedMessages={selectedMessages}
                        setSelectedMessages={setSelectedMessages}
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
                    { label: isRTL ? "معلومات جهة الإتصال" : "Contact Info", onClick: () => { }, icon: <InfoOutlined fontSize="medium" /> },
                    { label: isRTL ? "تحديد الرسائل" : "Select messages", onClick: () => setIsSelectMode(true), icon: <CheckBoxOutlined fontSize="medium" /> },
                    { label: isRTL ? "كتم الإشعارات" : "Mute notifications", onClick: () => { }, icon: <NotificationsOffOutlined fontSize="medium" /> },
                    { label: isRTL ? "إغلاق المحادثة" : "Close chat", onClick: () => { }, icon: <HighlightOffOutlined fontSize="medium" /> },
                    { label: isRTL ? "إبلاغ" : "Report", onClick: () => { }, icon: <ThumbDownOutlined fontSize="medium" /> },
                    { label: isRTL ? "حظر" : "Block", onClick: () => { }, icon: <DoNotDisturbOutlined fontSize="medium" /> },
                    { label: isRTL ? "حذف الرسائل" : "Clear chat", onClick: () => { }, icon: <DoDisturbOnOutlined fontSize="medium" /> },
                    { label: isRTL ? "حذف المحادثة" : "Delete chat", onClick: () => { }, icon: <DeleteForeverOutlined fontSize="medium" /> },
                ]}
            />
        </Box>
    );
}
