"use client";

import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import {
    ArchiveOutlined,
    BlockOutlined,
    DeleteForeverOutlined,
    FavoriteBorderOutlined,
    LogoutOutlined,
    MarkChatReadOutlined,
    MoreVertOutlined,
    NotificationsOffOutlined,
    NotificationsOutlined,
    PushPinOutlined,
} from "@mui/icons-material";
import { Divider, Tooltip } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React from "react";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { useChatMenuActions } from "@/hooks/use-chat-menu-actions";

interface Props {
    chat_type: "group" | "single";
}

type PreferenceKey =
    | "is_archived_chat"
    | "is_pinned_chat"
    | "is_favourite_chat"
    | "is_blocked_chat";

const menuItemSx = (theme: Theme) => ({
    "&:hover": {
        backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
    },
    borderRadius: 2,
    paddingY: 1,
    paddingX: 1,
});

const iconSx = (theme: Theme) => ({
    color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
});

const textSx = (theme: Theme) => ({
    color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
    fontWeight: 500,
    fontSize: "15px",
});

export default function ChatRoomMoreActionButton({ chat_type }: Props) {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const selectedChat = useActiveChatStore((state) =>
        state.chats.find((chat) => chat.chat_id === state.selectedChatId)
    );
    const {
        isUpdating,
        setChatPreference,
        deleteChatForCurrentUser,
        markChatAsRead,
    } = useChatMenuActions();

    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const isDisabled = isUpdating || !selectedChatId || !selectedChat;

    const closeMenu = () => setAnchorEl(null);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.preventDefault();
        setAnchorEl(event.currentTarget);
    };
    const handleClose = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.preventDefault();
        closeMenu();
    };
    const handlePreferenceAction =
        (key: PreferenceKey, value: boolean) =>
        async (event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            event.preventDefault();
            closeMenu();

            if (!selectedChatId) {
                return;
            }

            await setChatPreference(selectedChatId, key, value);
        };
    const handleToggleNotifications = async (
        event: React.MouseEvent<HTMLElement>
    ) => {
        event.stopPropagation();
        event.preventDefault();
        closeMenu();

        if (!selectedChatId || !selectedChat) {
            return;
        }

        await setChatPreference(
            selectedChatId,
            "is_muted_chat_notifications",
            !selectedChat.is_muted_chat_notifications
        );
    };
    const handleMarkRead = async (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.preventDefault();
        closeMenu();

        if (!selectedChatId) {
            return;
        }

        await markChatAsRead(selectedChatId);
    };
    const handleDeleteChat = async (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.preventDefault();
        closeMenu();

        if (!selectedChatId) {
            return;
        }

        await deleteChatForCurrentUser(selectedChatId);
    };

    const labels = {
        archive: selectedChat?.is_archived_chat
            ? isRTL
                ? "إخراج من الأرشيف"
                : "Unarchive chat"
            : isRTL
              ? "أرشفة المحادثة"
              : "Archive chat",
        mute: selectedChat?.is_muted_chat_notifications
            ? isRTL
                ? "إلغاء كتم الإشعارات"
                : "Unmute notifications"
            : isRTL
              ? "كتم الإشعارات"
              : "Mute notifications",
        pin: selectedChat?.is_pinned_chat
            ? isRTL
                ? "إلغاء تثبيت المحادثة"
                : "Unpin chat"
            : isRTL
              ? "تثبيت المحادثة"
              : "Pin chat",
        read: isRTL ? "تحديد كمقروءة" : "Mark as read",
        favourite: selectedChat?.is_favourite_chat
            ? isRTL
                ? "إزالة من المفضلة"
                : "Remove from favourites"
            : isRTL
              ? "إضافة للمفضلة"
              : "Add to favourites",
        exit: isRTL ? "الخروج من المجموعة" : "Exit group",
        block: selectedChat?.is_blocked_chat
            ? isRTL
                ? "إلغاء الحظر"
                : "Unblock"
            : isRTL
              ? "حظر"
              : "Block",
        delete: isRTL ? "حذف المحادثة" : "Delete chat",
    };

    return (
        <Tooltip
            title={isRTL ? "المزيد" : "More"}
            placement="bottom"
            slotProps={{
                tooltip: {
                    sx: (theme) => ({
                        backgroundColor:
                            theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                        color:
                            theme.palette.mode === "dark" ? "#000000" : "#ffffff",
                    }),
                },
            }}
        >
            <div>
                <IconButton
                    type="button"
                    id="more-button"
                    size="medium"
                    className="chat-hover-action"
                    aria-controls={open ? "basic-menu" : undefined}
                    aria-haspopup="true"
                    aria-expanded={open ? "true" : undefined}
                    onClick={handleClick}
                >
                    <MoreVertOutlined
                        sx={(theme) => ({
                            color:
                                theme.palette.mode === "dark"
                                    ? "#ffffff"
                                    : "#000000",
                        })}
                    />
                </IconButton>
                <Menu
                    id="basic-menu"
                    anchorEl={anchorEl}
                    open={open}
                    onClose={handleClose}
                    PaperProps={{
                        sx: (theme) => ({
                            backgroundColor:
                                theme.palette.mode === "dark"
                                    ? "#222424"
                                    : "#ffffff",
                            borderRadius: 3,
                            boxShadow: "0px 4px 20px rgba(0,0,0,0.1)",
                        }),
                    }}
                    slotProps={{
                        list: {
                            "aria-labelledby": "basic-button",
                            sx: {
                                padding: 1,
                            },
                        },
                    }}
                >
                    <MenuItem
                        onClick={handlePreferenceAction(
                            "is_archived_chat",
                            !(selectedChat?.is_archived_chat ?? false)
                        )}
                        disabled={isDisabled}
                        sx={menuItemSx}
                    >
                        <ListItemIcon>
                            <ArchiveOutlined fontSize="medium" sx={iconSx} />
                        </ListItemIcon>
                        <ListItemText primaryTypographyProps={{ sx: textSx }}>
                            {labels.archive}
                        </ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={handleToggleNotifications}
                        disabled={isDisabled}
                        sx={menuItemSx}
                    >
                        <ListItemIcon>
                            {selectedChat?.is_muted_chat_notifications ? (
                                <NotificationsOutlined
                                    fontSize="medium"
                                    sx={iconSx}
                                />
                            ) : (
                                <NotificationsOffOutlined
                                    fontSize="medium"
                                    sx={iconSx}
                                />
                            )}
                        </ListItemIcon>
                        <ListItemText
                            primary={labels.mute}
                            primaryTypographyProps={{ sx: textSx }}
                        />
                    </MenuItem>
                    <MenuItem
                        onClick={handlePreferenceAction(
                            "is_pinned_chat",
                            !(selectedChat?.is_pinned_chat ?? false)
                        )}
                        disabled={isDisabled}
                        sx={menuItemSx}
                    >
                        <ListItemIcon>
                            <PushPinOutlined fontSize="medium" sx={iconSx} />
                        </ListItemIcon>
                        <ListItemText primaryTypographyProps={{ sx: textSx }}>
                            {labels.pin}
                        </ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={handleMarkRead}
                        disabled={isDisabled}
                        sx={menuItemSx}
                    >
                        <ListItemIcon>
                            <MarkChatReadOutlined fontSize="medium" sx={iconSx} />
                        </ListItemIcon>
                        <ListItemText primaryTypographyProps={{ sx: textSx }}>
                            {labels.read}
                        </ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={handlePreferenceAction(
                            "is_favourite_chat",
                            !(selectedChat?.is_favourite_chat ?? false)
                        )}
                        disabled={isDisabled}
                        sx={menuItemSx}
                    >
                        <ListItemIcon>
                            <FavoriteBorderOutlined
                                fontSize="medium"
                                sx={iconSx}
                            />
                        </ListItemIcon>
                        <ListItemText primaryTypographyProps={{ sx: textSx }}>
                            {labels.favourite}
                        </ListItemText>
                    </MenuItem>
                    <Divider />
                    {chat_type === "group" ? (
                        <MenuItem
                            onClick={handleDeleteChat}
                            disabled={isDisabled}
                            sx={menuItemSx}
                        >
                            <ListItemIcon>
                                <LogoutOutlined fontSize="medium" sx={iconSx} />
                            </ListItemIcon>
                            <ListItemText primaryTypographyProps={{ sx: textSx }}>
                                {labels.exit}
                            </ListItemText>
                        </MenuItem>
                    ) : (
                        <div>
                            <MenuItem
                                onClick={handlePreferenceAction(
                                    "is_blocked_chat",
                                    !(selectedChat?.is_blocked_chat ?? false)
                                )}
                                disabled={isDisabled}
                                sx={menuItemSx}
                            >
                                <ListItemIcon>
                                    <BlockOutlined
                                        fontSize="medium"
                                        sx={iconSx}
                                    />
                                </ListItemIcon>
                                <ListItemText
                                    primaryTypographyProps={{ sx: textSx }}
                                >
                                    {labels.block}
                                </ListItemText>
                            </MenuItem>
                            <MenuItem
                                onClick={handleDeleteChat}
                                disabled={isDisabled}
                                sx={menuItemSx}
                            >
                                <ListItemIcon>
                                    <DeleteForeverOutlined
                                        fontSize="medium"
                                        sx={iconSx}
                                    />
                                </ListItemIcon>
                                <ListItemText
                                    primaryTypographyProps={{ sx: textSx }}
                                >
                                    {labels.delete}
                                </ListItemText>
                            </MenuItem>
                        </div>
                    )}
                </Menu>
            </div>
        </Tooltip>
    );
}
