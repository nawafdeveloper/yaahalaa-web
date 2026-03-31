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

export default function ChatRoomContent() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <Box
            ref={containerRef}
            sx={(theme) => ({
                height: "100%",
                width: "100%",
                position: "relative",
                display: "flex",
                overflow: 'hidden',
                backgroundImage:
                    theme.palette.mode === "dark"
                        ? "url('/chat-background-dark.svg')"
                        : "url('/chat-background-light.svg')",
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
