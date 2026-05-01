"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { ArchiveOutlined, BlockOutlined, DeleteForeverOutlined, ExpandMoreOutlined, FavoriteBorderOutlined, LogoutOutlined, MarkChatReadOutlined, NotificationsOffOutlined, NotificationsOutlined, PushPinOutlined } from '@mui/icons-material';
import { Divider } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import React from 'react'
import { useToggleChatNotifications } from '@/hooks/use-toggle-chat-notifications';

interface Props {
    chat_id: string;
    chat_type: 'group' | 'single';
    is_muted_chat_notifications: boolean;
}

export default function ChatItemMoreButtonMenu({
    chat_id,
    chat_type,
    is_muted_chat_notifications,
}: Props) {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const { isToggling, setChatNotificationsMuted } = useToggleChatNotifications();

    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.preventDefault();
        setAnchorEl(event.currentTarget);
    };
    const handleClose = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.preventDefault();
        setAnchorEl(null);
    };
    const handleToggleNotifications = async (
        event: React.MouseEvent<HTMLElement>
    ) => {
        event.stopPropagation();
        event.preventDefault();
        setAnchorEl(null);
        await setChatNotificationsMuted(
            chat_id,
            !is_muted_chat_notifications
        );
    };

    return (
        <div>
            <IconButton
                type="button"
                id="more-button"
                size="medium"
                className="chat-hover-action"
                aria-controls={open ? 'basic-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={(e) => handleClick(e)}
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(8px, -50%)",
                    opacity: 0,
                    transition: "all 100ms ease",
                    pointerEvents: "none",
                    "&:hover": {
                        backgroundColor: "transparent"
                    },
                }}
            >
                <ExpandMoreOutlined
                    sx={(theme) => ({
                        color: theme.palette.mode === "dark" ? "#ffffff" : "#000000"
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
                        backgroundColor: theme.palette.mode === "dark" ? "#222424" : "#ffffff",
                        borderRadius: 3,
                        boxShadow: "0px 4px 20px rgba(0,0,0,0.1)",
                    }),
                }}
                slotProps={{
                    list: {
                        'aria-labelledby': 'basic-button',
                        sx: {
                            padding: 1,
                        },
                    },
                }}
            >
                <MenuItem
                    onClick={handleClose}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1
                    })}
                >
                    <ListItemIcon>
                        <ArchiveOutlined
                            fontSize="medium"
                            sx={(theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? "أرشفة المحادثة" : "Archive chat"}
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={handleToggleNotifications}
                    disabled={isToggling}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1
                    })}
                >
                    <ListItemIcon>
                        {is_muted_chat_notifications ? (
                            <NotificationsOutlined
                                fontSize="medium"
                                sx={(theme) => ({
                                    color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                                })}
                            />
                        ) : (
                            <NotificationsOffOutlined
                                fontSize="medium"
                                sx={(theme) => ({
                                    color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                                })}
                            />
                        )}
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            is_muted_chat_notifications
                                ? isRTL
                                    ? "Ø¥Ù„ØºØ§Ø¡ ÙƒØªÙ… Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª"
                                    : "Unmute notifications"
                                : isRTL
                                  ? "ÙƒØªÙ… Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª"
                                  : "Mute notifications"
                        }
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? "كتم الإشعارات" : "Mute notifications"}
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={handleClose}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1
                    })}
                >
                    <ListItemIcon>
                        <PushPinOutlined
                            fontSize="medium"
                            sx={(theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? "تثبيت المحادثة" : "Pin chat"}
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={handleClose}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1
                    })}
                >
                    <ListItemIcon>
                        <MarkChatReadOutlined
                            fontSize="medium"
                            sx={(theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? "تحديد كمقروءة" : "Mark as read"}
                        </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={handleClose}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1
                    })}
                >
                    <ListItemIcon>
                        <FavoriteBorderOutlined
                            fontSize="medium"
                            sx={(theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? "إضافة للمفضلة" : "Add to favourites"}
                        </ListItemText>
                </MenuItem>
                <Divider />
                {chat_type === 'group' ? (
                    <MenuItem
                        onClick={handleClose}
                        sx={(theme) => ({
                            "&:hover": {
                                backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                            },
                            borderRadius: 2,
                            paddingY: 1,
                            paddingX: 1
                        })}
                    >
                        <ListItemIcon>
                            <LogoutOutlined
                                fontSize="medium"
                                sx={(theme) => ({
                                    color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                                })}
                            />
                        </ListItemIcon>
                        <ListItemText
                            primaryTypographyProps={{
                                sx: (theme) => ({
                                    color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                    fontWeight: 500,
                                    fontSize: "15px",
                                }),
                            }}
                        >
                            {isRTL ? "الخروج من المجموعة" : "Exit group"}
                        </ListItemText>
                    </MenuItem>
                ) : (
                    <div>
                        <MenuItem
                            onClick={handleClose}
                            sx={(theme) => ({
                                "&:hover": {
                                    backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                                },
                                borderRadius: 2,
                                paddingY: 1,
                                paddingX: 1
                            })}
                        >
                            <ListItemIcon>
                                <BlockOutlined
                                    fontSize="medium"
                                    sx={(theme) => ({
                                        color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                                    })}
                                />
                            </ListItemIcon>
                            <ListItemText
                                primaryTypographyProps={{
                                    sx: (theme) => ({
                                        color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                        fontWeight: 500,
                                        fontSize: "15px",
                                    }),
                                }}
                            >
                                {isRTL ? "حظر" : "Block"}
                            </ListItemText>
                        </MenuItem>
                        <MenuItem
                            onClick={handleClose}
                            sx={(theme) => ({
                                "&:hover": {
                                    backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                                },
                                borderRadius: 2,
                                paddingY: 1,
                                paddingX: 1
                            })}
                        >
                            <ListItemIcon>
                                <DeleteForeverOutlined
                                    fontSize="medium"
                                    sx={(theme) => ({
                                        color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                                    })}
                                />
                            </ListItemIcon>
                            <ListItemText
                                primaryTypographyProps={{
                                    sx: (theme) => ({
                                        color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                        fontWeight: 500,
                                        fontSize: "15px",
                                    }),
                                }}
                            >
                                {isRTL ? "حذف المحادثة" : "Delete chat"}
                            </ListItemText>
                        </MenuItem>
                    </div>
                )}
            </Menu>
        </div>
    )
}
