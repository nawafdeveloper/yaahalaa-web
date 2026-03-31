"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { AddOutlined, CalendarMonth, CameraAlt, Collections, Description, Headphones, Person, Poll } from '@mui/icons-material';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import React, { useState } from 'react'

export default function ChatRoomInputAttachButton() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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

    return (
        <div>
            <IconButton
                id="more-button"
                component="span"
                size="medium"
                className="chat-hover-action"
                aria-controls={open ? 'basic-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={(e) => handleClick(e)}
            >
                <AddOutlined />
            </IconButton>
            <Menu
                id="attachment-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: "top",
                    horizontal: "center",
                }}
                transformOrigin={{
                    vertical: "bottom",
                    horizontal: "center",
                }}
                PaperProps={{
                    sx: (theme) => ({
                        backgroundColor: theme.palette.mode === "dark" ? "rgba(2, 5, 5, 1)" : "#ffffff",
                        borderRadius: 3,
                        boxShadow: "0px 4px 20px rgba(0,0,0,0.1)",
                        mt: -4
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
                        <Description
                            fontSize="medium"
                            sx={(theme) => ({
                                color: "#7F66FF",
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? 'مستند' : 'Document'}
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
                        <Collections
                            fontSize="medium"
                            sx={(theme) => ({
                                color: "#007BFC",
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? 'فيديوهات و صور' : 'Photos & videos'}
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
                        <CameraAlt
                            fontSize="medium"
                            sx={(theme) => ({
                                color: "#007BFC",
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? 'الكاميرا' : 'Camera'}
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
                        <Headphones
                            fontSize="medium"
                            sx={(theme) => ({
                                color: "#FA6533",
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? 'صوتية' : 'Audio'}
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
                        <Person
                            fontSize="medium"
                            sx={(theme) => ({
                                color: "#009DE2",
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? 'جهة إتصال' : 'Contact'}
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
                        <Poll
                            fontSize="medium"
                            sx={(theme) => ({
                                color: "#FFB938",
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? 'استطلاع رأي' : 'Poll'}
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
                        <CalendarMonth
                            fontSize="medium"
                            sx={(theme) => ({
                                color: "#FF2E74",
                            })}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: (theme) => ({
                                fontWeight: 500,
                                fontSize: "15px",
                            }),
                        }}
                    >
                        {isRTL ? 'حدث' : 'Event'}
                    </ListItemText>
                </MenuItem>
            </Menu>
        </div>
    )
}