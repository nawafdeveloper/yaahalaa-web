"use client";

import { ArrowBack, Search } from "@mui/icons-material";
import Person from "@mui/icons-material/Person";
import { Avatar, Box, IconButton, Tooltip, Typography } from "@mui/material";
import React from "react";
import ChatRoomMoreActionButton from "./chat-room-more-action-button";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { authClient } from "@/lib/auth-client";
import { getChatDisplayName } from "@/lib/chat-utils";
import { useDecryptedContacts } from "@/hooks/use-decrypted-contacts";
import {
    getContactDisplayName,
    resolveDirectChatContact,
} from "@/lib/contact-display";

export default function ChatRoomHeader() {
    const { data: session } = authClient.useSession();
    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const chats = useActiveChatStore((state) => state.chats);
    const presenceByChatId = useActiveChatStore((state) => state.presenceByChatId);
    const setSelectedChatId = useActiveChatStore((state) => state.setSelectedChatId);
    const { contacts } = useDecryptedContacts();
    const selectedChat = chats.find((chat) => chat.chat_id === selectedChatId) ?? null;
    const currentPhone = (session?.user as { phoneNumber?: string | null } | undefined)
        ?.phoneNumber ?? null;
    const directContact = selectedChat
        ? resolveDirectChatContact(selectedChat, contacts, currentPhone)
        : null;
    const headerTitle =
        selectedChat?.chat_type === "single" && directContact
            ? getContactDisplayName(directContact)
            : selectedChat
              ? getChatDisplayName(selectedChat, currentPhone)
              : "Chat";
    const headerAvatar =
        selectedChat?.chat_type === "single"
            ? directContact?.contact_avatar ?? selectedChat?.avatar ?? ""
            : selectedChat?.avatar ?? "";
    const activePresence = selectedChatId ? presenceByChatId[selectedChatId] : undefined;
    const subtitle =
        activePresence && activePresence.activeUsersCount > 0
            ? `${activePresence.activeUsersCount} active`
            : selectedChat?.chat_type === "group"
              ? "Group chat"
              : "Direct chat";

    return (
        <Box
            component="header"
            sx={(theme) => ({
                height: 64,
                width: "100%",
                px: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 0,
                boxShadow: "0px 2px 2px rgba(0,0,0,0.08)",
                backgroundColor: theme.palette.mode === "dark" ? "#161717" : "#FFFFFF",
                color: theme.palette.mode === "dark" ? "#FFFFFF" : "#000000",
                "&:hover": {
                    backgroundColor: theme.palette.mode === "dark" ? "#161717" : "#FFFFFF"
                }
            })}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <IconButton
                    type="button"
                    className="md:hidden"
                    onClick={() => setSelectedChatId(null)}
                    size="small"
                    sx={(theme) => ({
                        color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                    })}
                >
                    <ArrowBack />
                </IconButton>
                <Avatar
                    src={headerAvatar}
                    sx={(theme) => ({
                        width: 40,
                        height: 40,
                        backgroundColor:
                            theme.palette.mode === "dark" ? "#1d1f1f" : "#f7f5f3",
                        border: "1px solid",
                        borderColor:
                            theme.palette.mode === "dark" ? "#404040" : "#d4d4d4",
                        color: theme.palette.mode === "dark" ? "#fff" : "#000",
                    })}
                >
                    <Person />
                </Avatar>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <Typography
                        variant="body1"
                        sx={{
                            fontWeight: "600",
                            direction: 'ltr'
                        }}
                    >
                        {headerTitle}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", textAlign: "left" }}>
                        {subtitle}
                    </Typography>
                </Box>
            </Box>
            <div className="flex flex-row items-center gap-x-2">
                <Tooltip
                    title="Search"
                    placement="bottom"
                    slotProps={{
                        tooltip: {
                            sx: (theme) => ({
                                backgroundColor:
                                    theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                                color: theme.palette.mode === "dark" ? "#000000" : "#ffffff",
                            }),
                        },
                    }}
                >
                    <IconButton
                        type="button"
                        size="medium"
                        sx={(theme) => ({
                            color: theme.palette.mode === "dark" ? "#ffffff" : "#000000"
                        })}
                    >
                        <Search />
                    </IconButton>
                </Tooltip>
                <ChatRoomMoreActionButton
                    chat_type={selectedChat?.chat_type ?? "single"}
                />
            </div>
        </Box>
    );
}
