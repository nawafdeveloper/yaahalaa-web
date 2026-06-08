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
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Tooltip, Typography } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React, { useState } from "react";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { useChatMenuActions } from "@/hooks/use-chat-menu-actions";

interface Props {
    chat_type: "group" | "single";
    chat_id: string;
}

type PreferenceKey =
    | "is_archived_chat"
    | "is_pinned_chat"
    | "is_favourite_chat"
    | "is_blocked_chat";

const menuItemSx = (theme: Theme) => ({
    "&:hover": {
        backgroundColor: theme.palette.mode === "dark" ? "#1d1f1f" : "#eee",
    },
    borderRadius: 4,
    paddingY: 1,
    paddingX: 1
});

const iconSx = (theme: Theme) => ({
    color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
});

const textSx = (theme: Theme) => ({
    color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
    fontWeight: 500,
    fontSize: "15px",
});

export default function ChatRoomMoreActionButton({ chat_type, chat_id }: Props) {
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

    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [groupError, setGroupError] = useState<string | null>(null);
    const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
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
    const handleDeleteChatClick = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.preventDefault();
        closeMenu();

        if (!selectedChatId) {
            return;
        }

        setDeleteConfirmOpen(true);
    };

    const handleCancelDeleteChat = () => {
        if (pendingAction === "delete") {
            return;
        }

        setDeleteConfirmOpen(false);
    };

    const handleConfirmDeleteChat = async () => {
        if (!selectedChatId) {
            return;
        }

        setPendingAction("delete");
        try {
            await deleteChatForCurrentUser(selectedChatId);
            setDeleteConfirmOpen(false);
        } finally {
            setPendingAction(null);
        }
    };

    const handleExitGroupClick = (chatId: string, isGroup: boolean) => {
        if (!chatId || !isGroup || pendingAction === "exit") {
            return;
        }

        setExitConfirmOpen(true);
    };

    const handleCancelExitGroup = () => {
        if (pendingAction === "exit") {
            return;
        }

        setExitConfirmOpen(false);
    };

    const handleConfirmExitGroup = async (chatId: string, isGroup: boolean, event: React.MouseEvent<HTMLElement>) => {
        if (!chatId || !isGroup) {
            return;
        }

        setPendingAction("exit");
        setGroupError(null);

        try {
            const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(payload?.error ?? "Failed to exit group.");
            }

            await deleteChatForCurrentUser(chatId);
            setExitConfirmOpen(false);
        } catch (error) {
            setGroupError(error instanceof Error ? error.message : "Failed to exit group.");
        } finally {
            setPendingAction(null);
        }
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
        <>
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
                        size="small"
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
                                backgroundColor: theme.palette.mode === "dark" ? "#161717" : "#ffffff",
                                borderRadius: 5,
                                boxShadow: "0px 4px 20px rgba(0,0,0,0.1)",
                                width: "250px"
                            }),
                        }}
                        slotProps={{
                            list: {
                                "aria-labelledby": "basic-button",
                                sx: {
                                    padding: 0.5,
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
                                <ArchiveOutlined fontSize="small" sx={iconSx} />
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
                                        fontSize="small"
                                        sx={iconSx}
                                    />
                                ) : (
                                    <NotificationsOffOutlined
                                        fontSize="small"
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
                                <PushPinOutlined fontSize="small" sx={iconSx} />
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
                            <ListItemIcon sx={iconSx}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5.83203 8.33333C5.83203 7.8731 6.20512 7.5 6.66536 7.5H14.1654C14.6256 7.5 14.9987 7.8731 14.9987 8.33333C14.9987 8.79358 14.6256 9.16667 14.1654 9.16667H6.66536C6.20512 9.16667 5.83203 8.79358 5.83203 8.33333Z" fill="currentColor" />
                                    <path d="M5.83203 11.6693C5.83203 11.209 6.20512 10.8359 6.66536 10.8359H11.6654C12.1256 10.8359 12.4987 11.209 12.4987 11.6693C12.4987 12.1295 12.1256 12.5026 11.6654 12.5026H6.66536C6.20512 12.5026 5.83203 12.1295 5.83203 11.6693Z" fill="currentColor" />
                                    <path fillRule="evenodd" clipRule="evenodd" d="M13.3351 4.16927C13.3351 3.70904 12.962 3.33594 12.5018 3.33594H1.49342C0.845677 3.33594 0.451805 4.0555 0.785067 4.61094L2.50176 7.5026V14.447C2.50176 15.6744 3.49668 16.6693 4.72398 16.6693H16.1129C17.3401 16.6693 18.3351 15.6744 18.3351 14.447V9.16927C18.3351 8.70902 17.962 8.33594 17.5018 8.33594C17.0415 8.33594 16.6685 8.70902 16.6685 9.16927V14.447C16.6685 14.7539 16.4197 15.0026 16.1129 15.0026H4.72398C4.41715 15.0026 4.16843 14.7539 4.16843 14.447V7.04096L2.94541 5.0026H12.5018C12.962 5.0026 13.3351 4.6295 13.3351 4.16927Z" fill="currentColor" />
                                    <path d="M17.5 6.66406C18.1667 6.66406 18.8 6.3974 19.2667 5.93073C19.7333 5.46406 20 4.8224 20 4.16406C20 3.50573 19.7333 2.86406 19.2667 2.3974C18.8 1.93073 18.1583 1.66406 17.5 1.66406C16.8417 1.66406 16.2 1.93073 15.7333 2.3974C15.2667 2.86406 15 3.50573 15 4.16406C15 4.8224 15.2667 5.46406 15.7333 5.93073C16.2 6.3974 16.8417 6.66406 17.5 6.66406Z" fill="currentColor" />
                                </svg>
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
                                    fontSize="small"
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
                                onClick={() => handleExitGroupClick(chat_id, chat_type === 'group')}
                                disabled={isDisabled}
                                sx={menuItemSx}
                            >
                                <ListItemIcon>
                                    <LogoutOutlined fontSize="small" sx={iconSx} />
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
                                            fontSize="small"
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
                                    onClick={handleDeleteChatClick}
                                    disabled={isDisabled}
                                    sx={menuItemSx}
                                >
                                    <ListItemIcon>
                                        <DeleteForeverOutlined
                                            fontSize="small"
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
            <Dialog
                open={exitConfirmOpen}
                onClose={handleCancelExitGroup}
                aria-labelledby="exit-group-confirm-title"
                aria-describedby="exit-group-confirm-description"
                PaperProps={{
                    sx: {
                        borderRadius: "16px",
                        minWidth: { xs: "calc(100vw - 32px)", sm: "450px" },
                        padding: "4px",
                        backgroundColor: (theme) =>
                            theme.palette.mode === "dark" ? "#1d1f1f" : "#ffffff",
                        boxShadow: "0px 12px 30px rgba(0, 0, 0, 0.08)",
                    },
                }}
            >
                <DialogTitle
                    id="exit-group-confirm-title"
                    sx={{
                        fontWeight: 700,
                        fontSize: "18px",
                        color: (theme) =>
                            theme.palette.mode === "dark" ? "#FFFFFF" : "#1C1C1C",
                        textAlign: isRTL ? "right" : "left",
                    }}
                >
                    Exit group?
                </DialogTitle>
                <DialogContent sx={{ paddingTop: "4px" }}>
                    <Typography
                        id="exit-group-confirm-description"
                        sx={{
                            color: (theme) =>
                                theme.palette.mode === "dark" ? "#CFCFCF" : "#5A5A5A",
                            fontSize: "14px",
                            textAlign: isRTL ? "right" : "left",
                        }}
                    >
                        You will leave this group and it will be removed from your chat list.
                    </Typography>
                </DialogContent>
                <DialogActions
                    sx={{
                        padding: "12px 16px 16px 16px",
                        gap: "8px",
                        ...(isRTL && { flexDirection: "row-reverse" }),
                    }}
                >
                    <Button
                        onClick={handleCancelExitGroup}
                        variant="outlined"
                        disabled={pendingAction === "exit"}
                        sx={{
                            borderRadius: "99px",
                            borderColor: (theme) =>
                                theme.palette.mode === "dark" ? "#3A3A3A" : "#DCDCDC",
                            color: (theme) =>
                                theme.palette.mode === "dark" ? "#D8D8D8" : "#5A5A5A",
                            textTransform: "none",
                            padding: "8px 16px",
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={(e) => void handleConfirmExitGroup(chat_id, chat_type === 'group', e)}
                        variant="contained"
                        disabled={pendingAction === "exit"}
                        sx={{
                            borderRadius: "99px",
                            backgroundColor: "#25D366",
                            color: "#0B1B12",
                            textTransform: "none",
                            padding: "8px 16px",
                            boxShadow: "0px 0px 0px rgba(0, 0, 0, 0.0)",
                            "&:hover": {
                                backgroundColor: "#1FB75A",
                            },
                            "&.Mui-disabled": {
                                backgroundColor: (theme) =>
                                    theme.palette.mode === "dark" ? "#2D4035" : "#CFEFDB",
                                color: (theme) =>
                                    theme.palette.mode === "dark" ? "#A1B6A8" : "#6B8F7A",
                            },
                        }}
                    >
                        {pendingAction === "exit" ? (
                            <CircularProgress size={18} />
                        ) : (
                            "Exit"
                        )}
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={deleteConfirmOpen}
                onClose={handleCancelDeleteChat}
                aria-labelledby="delete-chat-confirm-title"
                aria-describedby="delete-chat-confirm-description"
                PaperProps={{
                    sx: {
                        borderRadius: "16px",
                        minWidth: { xs: "calc(100vw - 32px)", sm: "450px" },
                        padding: "4px",
                        backgroundColor: (theme) =>
                            theme.palette.mode === "dark" ? "#1d1f1f" : "#ffffff",
                        boxShadow: "0px 12px 30px rgba(0, 0, 0, 0.08)",
                    },
                }}
            >
                <DialogTitle
                    id="delete-chat-confirm-title"
                    sx={{
                        fontWeight: 700,
                        fontSize: "18px",
                        color: (theme) =>
                            theme.palette.mode === "dark" ? "#FFFFFF" : "#1C1C1C",
                        textAlign: isRTL ? "right" : "left",
                    }}
                >
                    Delete chat?
                </DialogTitle>
                <DialogContent sx={{ paddingTop: "4px" }}>
                    <Typography
                        id="delete-chat-confirm-description"
                        sx={{
                            color: (theme) =>
                                theme.palette.mode === "dark" ? "#CFCFCF" : "#5A5A5A",
                            fontSize: "14px",
                            textAlign: isRTL ? "right" : "left",
                        }}
                    >
                        Messages will be deleted permanently for you. This will not delete the chat for the other person.
                    </Typography>
                </DialogContent>
                <DialogActions
                    sx={{
                        padding: "12px 16px 16px 16px",
                        gap: "8px",
                        ...(isRTL && { flexDirection: "row-reverse" }),
                    }}
                >
                    <Button
                        onClick={handleCancelDeleteChat}
                        variant="outlined"
                        disabled={pendingAction === "delete"}
                        sx={{
                            borderRadius: "99px",
                            borderColor: (theme) =>
                                theme.palette.mode === "dark" ? "#3A3A3A" : "#DCDCDC",
                            color: (theme) =>
                                theme.palette.mode === "dark" ? "#D8D8D8" : "#5A5A5A",
                            textTransform: "none",
                            padding: "8px 16px",
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleConfirmDeleteChat()}
                        variant="contained"
                        disabled={pendingAction === "delete"}
                        sx={{
                            borderRadius: "99px",
                            backgroundColor: "#25D366",
                            color: "#0B1B12",
                            textTransform: "none",
                            padding: "8px 16px",
                            boxShadow: "none",
                            "&:hover": {
                                backgroundColor: "#1FB75A",
                            },
                        }}
                    >
                        {pendingAction === "delete" ? (
                            <CircularProgress size={18} />
                        ) : (
                            "Delete"
                        )}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
