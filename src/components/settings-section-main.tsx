"use client";

import { useSettingsStore } from '@/store/use-active-setting-store';
import { AccountCircleOutlined, CloseOutlined, Computer, HelpOutline, LockOutline, NotificationsOutlined, Person, SearchOutlined, VpnKeyOutlined } from '@mui/icons-material';
import { Avatar, IconButton, InputAdornment, ListItem, ListItemButton, ListItemIcon, ListItemText, Stack, TextField } from '@mui/material';
import React, { useRef, useState } from 'react'

const ChatIcon = () => (
    <svg className="text-gray-600 dark:text-gray-300" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M3.00208 9L0.942085 5.53C0.542171 4.86348 1.01478 4 1.79207 4H19.3355C20.8082 4 22.0021 5.19391 22.0021 6.66667V17.3333C22.0021 18.8061 20.8082 20 19.3355 20H5.66875C4.19599 20 3.00208 18.8061 3.00208 17.3333V9ZM5.00208 8.44603L3.53447 6H19.3355C19.7037 6 20.0021 6.29848 20.0021 6.66667V17.3333C20.0021 17.7015 19.7037 18 19.3355 18H5.66875C5.30056 18 5.00208 17.7015 5.00208 17.3333V8.44603Z" fill="currentColor" />
        <path d="M7 10C7 9.44772 7.44772 9 8 9H17C17.5523 9 18 9.44772 18 10C18 10.5523 17.5523 11 17 11H8C7.44772 11 7 10.5523 7 10Z" fill="currentColor" />
        <path d="M7 14C7 13.4477 7.44772 13 8 13H14C14.5523 13 15 13.4477 15 14C15 14.5523 14.5523 15 14 15H8C7.44772 15 7 14.5523 7 14Z" fill="currentColor" />
    </svg>
);

export default function SettingsSectionMain() {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const { navigateToSettings } = useSettingsStore();

    const handleClear = () => {
        setValue("");
        inputRef.current?.blur();
    };

    const settingItems = [
        {
            id: '1',
            primary: 'General',
            secondary: 'Language and text sizes',
            icon: Computer,
            href: 'settings-general'
        },
        {
            id: '2',
            primary: 'Profile',
            secondary: 'Name, profile photo and number',
            icon: AccountCircleOutlined,
            href: 'settings-profile'
        },
        {
            id: '3',
            primary: 'Account',
            secondary: 'Account security and information',
            icon: VpnKeyOutlined,
            href: 'settings-account'
        },
        {
            id: '4',
            primary: 'Privacy',
            secondary: 'Block contacts dissappearing messages',
            icon: LockOutline,
            href: 'settings-privacy'
        },
        {
            id: '5',
            primary: 'Chats',
            secondary: 'Theme, wallpaper and chats setting',
            icon: ChatIcon,
            href: 'settings-chats'
        },
        {
            id: '6',
            primary: 'Notifications',
            secondary: 'Message notifications',
            icon: NotificationsOutlined,
            href: 'settings-notifications'
        },
        {
            id: '7',
            primary: 'Help & feedback',
            secondary: 'Help center, contact us, privacy and policy',
            icon: HelpOutline,
            href: 'settings-help'
        }
    ];

    return (
        <Stack
            spacing={4}
            alignItems={'center'}
            className='px-5 pt-5'
            sx={{
                width: '100%',
            }}
        >
            <TextField
                hiddenLabel
                id="filled-search-bar"
                variant="filled"
                size="small"
                placeholder="Search for settings"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputRef={inputRef}
                sx={{
                    "& .MuiFilledInput-root": {
                        borderRadius: 8,
                        "&.Mui-focused": {
                            outline: "2px solid #25D366",
                        },
                    },
                    width: '100%',
                }}
                InputProps={{
                    disableUnderline: true,
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchOutlined
                                sx={{
                                    color: (theme) =>
                                        theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                    width: 20,
                                    height: 20,
                                }}
                            />
                        </InputAdornment>
                    ),
                    endAdornment: value ? (
                        <InputAdornment position="end">
                            <IconButton onClick={handleClear} size="small">
                                <CloseOutlined
                                    sx={{
                                        color: (theme) =>
                                            theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                        width: 18,
                                        height: 18,
                                    }}
                                />
                            </IconButton>
                        </InputAdornment>
                    ) : null,
                }}
            />
            <button className='cursor-pointer'>
                <Avatar
                    sx={(theme) => ({
                        width: 120,
                        height: 120,
                        backgroundColor: theme.palette.mode === "dark" ? "#103529" : "#D9FDD3",
                        color: theme.palette.mode === "dark" ? "#25D366" : "#1F4E2E",
                        border: `1px solid ${theme.palette.mode === "dark" ? "#24453B" : "#C4DCC0"}`,
                    })}
                    src={""}
                >
                    <Person className='size-16!' />
                </Avatar>
            </button>
            <Stack
                sx={{
                    width: '100%',
                }}
                spacing={1}
            >
                {settingItems.map((item) => (
                    <ListItemButton
                        key={item.id}
                        onClick={() => navigateToSettings(item.href)}
                        sx={(theme) => ({
                            width: "100%",
                            borderRadius: 3,
                            padding: 0,
                            marginY: '2px',
                            backgroundColor: "transparent",
                            boxShadow: "0px 4px 20px rgba(0,0,0,0)",
                            textTransform: "inherit",
                            color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",

                            "&:hover": {
                                boxShadow: "0px 4px 20px rgba(0,0,0,0)",
                                backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                                "& .chat-badge": {
                                    transform: "translate(-28px, -50%)",
                                    opacity: 1,
                                },
                                "& .chat-hover-action": {
                                    transform: "translate(-50%, -50%)",
                                    opacity: 1,
                                    pointerEvents: "auto",
                                },
                                "& .MuiListItemText-secondary": {
                                    maxWidth: "calc(100% - 30px)",
                                },
                            },
                            "& .MuiListItemText-secondary": {
                                maxWidth: "100%",
                            },
                        })}
                    >
                        <ListItem
                            sx={{
                                paddingY: 1,
                                paddingX: 2,
                            }}
                        >
                            <ListItemIcon>
                                <item.icon className='size-6! text-gray-600 dark:text-gray-300' />
                            </ListItemIcon>
                            <ListItemText
                                primary={item.primary}
                                sx={{
                                    transition: "max-width 100ms ease",
                                    maxWidth: "75%",
                                    overflow: "hidden",
                                    whiteSpace: "nowrap",
                                    textOverflow: "ellipsis",
                                    display: "block",
                                }}
                                secondary={item.secondary}
                                secondaryTypographyProps={{
                                    noWrap: true,
                                    sx: {
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        display: "block",
                                        maxWidth: "100%",
                                        transition: "max-width 100ms ease",
                                    },
                                }}
                            />
                        </ListItem>
                    </ListItemButton>
                ))}
            </Stack>
        </Stack>
    )
}