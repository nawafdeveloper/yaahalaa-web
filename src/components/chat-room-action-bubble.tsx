"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { DeleteForeverOutlined, ExpandMore, PushPinOutlined, ShortcutRounded, StarOutline, TurnLeftOutlined } from '@mui/icons-material';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import React, { useState } from 'react'

type Props = {
    onReply?: () => void;
    onForward?: () => void;
    onPin?: () => void;
    onStar?: () => void;
};

export default function ChatRoomActionBubble({
    onReply,
    onForward,
    onPin,
    onStar,
}: Props) {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };
    const handleReply = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        onReply?.();
        handleClose();
    };
    const handleForward = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        onForward?.();
        handleClose();
    };
    const handlePin = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        onPin?.();
        handleClose();
    };
    const handleStar = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        onStar?.();
        handleClose();
    };

    return (
        <div>
            <IconButton
                onClick={handleClick}
                aria-label="more"
                sx={(theme) => ({
                    pointerEvents: 'auto',
                    "&:hover": {
                        backgroundColor:
                            theme.palette.mode === "dark" ? "#1d1f1f" : "#ffffff",
                    },
                    padding: 0,
                    backgroundColor:
                        theme.palette.mode === "dark" ? "#1d1f1f" : "#ffffff",
                })}
            >
                <ExpandMore
                    fontSize="inherit"
                    sx={(theme) => ({
                        color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
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
                        width: '130px'
                    }),
                }}
                slotProps={{
                    list: {
                        'aria-labelledby': 'basic-button',
                        sx: {
                            padding: 0.5,
                        },
                    },
                }}
            >
                <MenuItem
                    onClick={handleReply}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#1d1f1f" : "#eee",
                        },
                        borderRadius: 4,
                        paddingY: 1,
                        paddingX: 1
                    })}
                >
                    <ListItemIcon sx={{ color: (theme) => theme.palette.mode === "dark" ? "#A5A5A5" : "#636261" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                            <path d="M760-200v-160q0-50-35-85t-85-35H273l144 144-57 56-240-240 240-240 57 56-144 144h367q83 0 141.5 58.5T840-360v160h-80Z" />
                        </svg>
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >{isRTL ? 'رد' : 'Reply'}</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={handleForward}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#1d1f1f" : "#eee",
                        },
                        borderRadius: 4,
                        paddingY: 1,
                        paddingX: 1
                    })}
                >
                    <ListItemIcon sx={{ color: (theme) => theme.palette.mode === "dark" ? "#A5A5A5" : "#636261" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                            <path d="m640-280-57-56 184-184-184-184 57-56 240 240-240 240ZM80-200v-160q0-83 58.5-141.5T280-560h247L383-704l57-56 240 240-240 240-57-56 144-144H280q-50 0-85 35t-35 85v160H80Z" />
                        </svg>
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >{isRTL ? 'إعادة توجيه' : 'Forward'}</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={handlePin}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#1d1f1f" : "#eee",
                        },
                        borderRadius: 4,
                        paddingY: 1,
                        paddingX: 1
                    })}
                >
                    <ListItemIcon>
                        <PushPinOutlined
                            fontSize="small"
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
                    >{isRTL ? 'تثبيت' : 'Pin'}</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={handleStar}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#1d1f1f" : "#eee",
                        },
                        borderRadius: 4,
                        paddingY: 1,
                        paddingX: 1
                    })}
                >
                    <ListItemIcon>
                        <StarOutline
                            fontSize="small"
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
                    >{isRTL ? 'نجمة' : 'Star'}</ListItemText>
                </MenuItem>
            </Menu>
        </div>
    )
}
