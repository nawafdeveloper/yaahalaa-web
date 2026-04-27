"use client";

import { ChatOutlined, CheckBoxOutlined, GroupAddOutlined, LogoutOutlined, MoreVertOutlined, StarBorderOutlined } from '@mui/icons-material';
import { Divider } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import React from 'react';
import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';

type Props = {
    logout: () => void;
};

export default function ChatsMoreButtonMenu({ logout }: Props) {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <div>
            <Tooltip
                title={isRTL ? 'القائمة' : 'Menu'}
                placement={isRTL ? "bottom-end" : "bottom"}
                slotProps={{
                    tooltip: {
                        sx: (theme) => ({
                            backgroundColor:
                                theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                            color: theme.palette.mode === "dark" ? "#000000" : "#ffffff",
                            direction: isRTL ? 'rtl' : 'ltr',
                            textAlign: isRTL ? 'right' : 'left',
                        }),
                    },
                }}
            >
                <IconButton
                    id="more-button"
                    aria-controls={open ? 'basic-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={open ? 'true' : undefined}
                    onClick={handleClick}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor:
                                theme.palette.mode === "dark"
                                    ? "#333333"
                                    : "#e5e5e5",
                        },
                    })}
                >
                    <MoreVertOutlined
                        sx={(theme) => ({
                            color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                            transform: isRTL ? 'scaleX(-1)' : 'scaleX(1)',
                        })}
                    />
                </IconButton>
            </Tooltip>
            <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: isRTL ? 'right' : 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: isRTL ? 'right' : 'left',
                }}
                PaperProps={{
                    sx: (theme) => ({
                        backgroundColor: theme.palette.mode === "dark" ? "#222424" : "#ffffff",
                        borderRadius: 3,
                        boxShadow: "0px 4px 20px rgba(0,0,0,0.1)",
                        direction: isRTL ? 'rtl' : 'ltr',
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
                        paddingX: 1,
                        direction: isRTL ? 'rtl' : 'ltr',
                    })}
                >
                    <ListItemIcon
                        sx={{
                            minWidth: 40,
                            marginRight: isRTL ? 0 : '16px',
                            marginLeft: isRTL ? '16px' : 0,
                        }}
                    >
                        <GroupAddOutlined
                            fontSize="small"
                            sx={(theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primary={isRTL ? 'مجموعة جديدة' : 'New Group'}
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                                textAlign: isRTL ? 'right' : 'left',
                            }),
                        }}
                    />
                </MenuItem>
                <MenuItem
                    onClick={handleClose}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                        direction: isRTL ? 'rtl' : 'ltr',
                    })}
                >
                    <ListItemIcon
                        sx={{
                            minWidth: 40,
                            marginRight: isRTL ? 0 : '16px',
                            marginLeft: isRTL ? '16px' : 0,
                        }}
                    >
                        <StarBorderOutlined
                            fontSize="small"
                            sx={(theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primary={isRTL ? 'الرسائل المميزة' : 'Starred messages'}
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                                textAlign: isRTL ? 'right' : 'left',
                            }),
                        }}
                    />
                </MenuItem>
                <MenuItem
                    onClick={handleClose}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                        direction: isRTL ? 'rtl' : 'ltr',
                    })}
                >
                    <ListItemIcon
                        sx={{
                            minWidth: 40,
                            marginRight: isRTL ? 0 : '16px',
                            marginLeft: isRTL ? '16px' : 0,
                        }}
                    >
                        <CheckBoxOutlined
                            fontSize="small"
                            sx={(theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primary={isRTL ? 'تحديد المحادثات' : 'Select chats'}
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                                textAlign: isRTL ? 'right' : 'left',
                            }),
                        }}
                    />
                </MenuItem>
                <MenuItem
                    onClick={handleClose}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                        direction: isRTL ? 'rtl' : 'ltr',
                    })}
                >
                    <ListItemIcon
                        sx={{
                            minWidth: 40,
                            marginRight: isRTL ? 0 : '16px',
                            marginLeft: isRTL ? '16px' : 0,
                        }}
                    >
                        <ChatOutlined
                            fontSize="small"
                            sx={(theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primary={isRTL ? 'تحديد الكل كمقروء' : 'Mark all as read'}
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                                textAlign: isRTL ? 'right' : 'left',
                            }),
                        }}
                    />
                </MenuItem>
                <Divider />
                <MenuItem
                    onClick={() => { logout(); handleClose(); }}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                        direction: isRTL ? 'rtl' : 'ltr',
                    })}
                >
                    <ListItemIcon
                        sx={{
                            minWidth: 40,
                            marginRight: isRTL ? 0 : '16px',
                            marginLeft: isRTL ? '16px' : 0,
                        }}
                    >
                        <LogoutOutlined
                            fontSize="small"
                            sx={(theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primary={isRTL ? 'تسجيل الخروج' : 'Log out'}
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                color: theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                fontWeight: 500,
                                fontSize: "15px",
                                textAlign: isRTL ? 'right' : 'left',
                            }),
                        }}
                    />
                </MenuItem>
            </Menu>
        </div>
    )
}