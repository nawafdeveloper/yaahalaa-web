"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { BlockOutlined, CloseOutlined, CollectionsOutlined, DeleteOutlineOutlined, NotificationsOutlined, Person, SearchOutlined, StarOutline } from '@mui/icons-material';
import { Box, Divider, IconButton, InputAdornment, ListItem, ListItemButton, ListItemIcon, ListItemText, Stack, Switch, TextField, Typography } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react'
import DecryptedProfileImage from './decrypted-profile-image';
import { useMediaDisplayAllStore } from '@/store/use-media-display-all-store';
import { DetailedSidebarMediaItem, DetailedSidebarMediaTile } from './detailed-sidebar-item-media';
import { useToggleChatNotifications } from '@/hooks/use-toggle-chat-notifications';

type Props = {
    chatId: string | null;
    avatar?: string | null;
    contactName: string | null;
    contactNumber: string | null;
    biography?: string | null;
    mediaCount: number;
    mediaItems: DetailedSidebarMediaItem[];
    muteNotification: boolean;
    isBlocked: boolean;
}

export default function DetailedLargeSidebarContent({
    chatId,
    avatar,
    contactName,
    contactNumber,
    biography,
    mediaCount,
    mediaItems,
    muteNotification,
    isBlocked
}: Props) {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const { open } = useMediaDisplayAllStore();
    const { isToggling, setChatNotificationsMuted } = useToggleChatNotifications();

    const [isMuted, setIsMuted] = useState(muteNotification || false);
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const displayContactName =
        contactName?.trim() ||
        contactNumber ||
        (isRTL ? "جهة الإتصال" : "contact");

    const handleClear = () => {
        setValue("");
        inputRef.current?.blur();
    };

    useEffect(() => {
        setIsMuted(muteNotification || false);
    }, [muteNotification]);

    const handleToggleNotifications = async () => {
        if (!chatId || isToggling) {
            return;
        }

        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        const didSave = await setChatNotificationsMuted(chatId, nextMuted);

        if (!didSave) {
            setIsMuted(!nextMuted);
        }
    };

    const listItems = [
        {
            id: '1',
            primary: isRTL ? 'نجمة' : 'Starred',
            secondary: isRTL ? 'الرسائل المميزة' : 'Starred messages',
            icon: StarOutline,
            href: 'detailed-starred'
        },
    ];

    const secondListItems = [
        {
            id: '3',
            primary: isRTL ? `حضر ${displayContactName}` : `Block ${displayContactName}`,
            icon: BlockOutlined,
            distructive: true,
            href: 'detailed-privacy'
        },
        {
            id: '5',
            primary: isRTL ? 'حذف المحادثة' : 'Delete chat',
            icon: DeleteOutlineOutlined,
            distructive: true,
            href: 'detailed-delete-chat'
        },
    ];

    return (
        <Stack
            spacing={4}
            alignItems={'center'}
            sx={{
                width: '100%',
            }}
        >
            <TextField
                hiddenLabel
                id="filled-search-bar"
                variant="filled"
                size="small"
                placeholder={isRTL ? "إبحث في المحادثات" : "Search for messages"}
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
            <Stack
                spacing={1}
                alignItems={'center'}
                className='px-5 pt-5'
                sx={{
                    width: '100%',
                }}
            >
                <button className='cursor-pointer'>
                    <DecryptedProfileImage
                        imageUrl={avatar || ""}
                        fallback={<Person className='size-16!' />}
                        sx={(theme) => ({
                            width: 120,
                            height: 120,
                            backgroundColor: theme.palette.mode === "dark" ? "#103529" : "#D9FDD3",
                            color: theme.palette.mode === "dark" ? "#25D366" : "#1F4E2E",
                            border: `1px solid ${theme.palette.mode === "dark" ? "#24453B" : "#C4DCC0"}`,
                        })}
                    />
                </button>
                <Typography variant='h6'>
                    {displayContactName}
                </Typography>
                <Typography
                    variant='body1'
                    className='text-gray-400!'
                    sx={{ direction: 'ltr' }}
                >
                    {contactNumber}
                </Typography>
            </Stack>
            <Stack
                spacing={1}
                sx={{
                    width: '100%',
                }}
            >
                <Typography
                    variant='body1'
                    className='text-gray-400!'
                >
                    {isRTL ? 'نبذة مختصرة' : 'About'}
                </Typography>
                <Typography
                    variant='body1'
                >
                    {biography}
                </Typography>
                <Divider />
            </Stack>
            <Stack
                spacing={1}
                sx={{
                    width: '100%',
                }}
            >
                <ListItemButton
                    onClick={open}
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
                            textAlign: isRTL ? 'left' : 'right',
                            '& .MuiListItem-secondaryAction': {
                                right: isRTL ? 'auto' : 16,
                                left: isRTL ? 16 : 'auto',
                            }
                        }}
                        secondaryAction={
                            <Typography
                                variant='body1'
                                className='text-gray-400!'
                            >
                                {mediaCount || 0}
                            </Typography>
                        }
                    >
                        <ListItemIcon>
                            <CollectionsOutlined className='size-6! text-gray-600 dark:text-gray-300' />
                        </ListItemIcon>
                        <ListItemText
                            primary={isRTL ? 'الوسائط, الروابط و المستندات' : 'Media, links & docs'}
                            sx={{
                                transition: "max-width 100ms ease",
                                maxWidth: "75%",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                                textOverflow: "ellipsis",
                                display: "block",
                            }}
                        />
                    </ListItem>
                </ListItemButton>
                {mediaItems.length > 0 ? (
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: 1,
                            width: '100%',
                            mt: 1,
                        }}
                    >
                        {mediaItems.map((item) => (
                            <DetailedSidebarMediaTile
                                key={item.id}
                                item={item}
                            />
                        ))}
                    </Box>
                ) : null}
                <Divider />
            </Stack>
            <Stack
                spacing={1}
                sx={{
                    width: '100%',
                }}
            >
                {listItems.map((item) => (
                    <ListItemButton
                        key={item.id}
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
                                    display: "block",
                                }}
                                secondary={item.secondary}
                                secondaryTypographyProps={{
                                    noWrap: true,
                                    sx: {
                                        display: "block",
                                        maxWidth: "100%",
                                    },
                                }}
                            />
                        </ListItem>
                    </ListItemButton>
                ))}
                <ListItem
                    sx={{
                        padding: isRTL ? '8px 0 8px 16px' : '8px 16px 8px 0',
                        paddingY: 1,
                        paddingX: 2,
                        justifyContent: 'space-between',
                    }}
                >
                    <ListItemIcon>
                        <NotificationsOutlined className='size-6! text-gray-600 dark:text-gray-300' />
                    </ListItemIcon>
                    <ListItemText
                        primary={isRTL ? 'كتم الإشعارات' : 'Mute notifications'}
                        sx={{
                            display: "block",
                            textAlign: isRTL ? 'right' : 'left',
                        }}
                        secondary={
                            isRTL ?
                                'إيقاف إشعارات هذه المحادثة' :
                                'Turn off notifications for this conversation'
                        }
                        secondaryTypographyProps={{
                            sx: {
                                display: "block",
                                maxWidth: "100%",
                                textAlign: isRTL ? 'right' : 'left',
                            },
                        }}
                    />
                    <Switch
                        edge="end"
                        onChange={handleToggleNotifications}
                        checked={isMuted}
                        disabled={!chatId || isToggling}
                        inputProps={{
                            'aria-labelledby': 'switch-list-label-receipt',
                        }}
                        sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                                color: '#25D366',
                                '&:hover': {
                                    backgroundColor: 'rgba(37, 211, 102, 0.08)',
                                },
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                backgroundColor: '#25D366',
                            },
                        }}
                    />
                </ListItem>
            </Stack>
            <Divider />
            <Stack
                spacing={1}
                sx={{
                    width: '100%',
                }}
            >
                {secondListItems.map((item) => (
                    <ListItemButton
                        key={item.id}
                        sx={(theme) => ({
                            width: "100%",
                            borderRadius: 3,
                            padding: 0,
                            marginY: '2px',
                            backgroundColor: "transparent",
                            boxShadow: "0px 4px 20px rgba(0,0,0,0)",
                            textTransform: "inherit",
                            color: item.distructive ? '#fa99a4' : theme.palette.mode === "dark" ? "#ffffff" : "#000000",

                            "&:hover": {
                                boxShadow: "0px 4px 20px rgba(0,0,0,0)",
                                backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
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
                                <item.icon className={`size-6! ${item.distructive ? 'text-[#fa99a4]' : 'text-gray-600 dark:text-gray-300'}`} />
                            </ListItemIcon>
                            <ListItemText
                                primary={item.primary}
                                sx={{
                                    display: "block",
                                }}
                            />
                        </ListItem>
                    </ListItemButton>
                ))}
            </Stack>
        </Stack>
    )
}
