"use client";

import { ListItem, ListItemButton, ListItemIcon, ListItemText, Stack, Typography } from '@mui/material';
import React from 'react'
import SettingsHeader from './settings-header';
import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { useSettingsStore } from '@/store/use-active-setting-store';
import { GroupOutlined } from '@mui/icons-material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

const ChatIcon = () => (
    <svg className="text-gray-600 dark:text-gray-300" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M3.00208 9L0.942085 5.53C0.542171 4.86348 1.01478 4 1.79207 4H19.3355C20.8082 4 22.0021 5.19391 22.0021 6.66667V17.3333C22.0021 18.8061 20.8082 20 19.3355 20H5.66875C4.19599 20 3.00208 18.8061 3.00208 17.3333V9ZM5.00208 8.44603L3.53447 6H19.3355C19.7037 6 20.0021 6.29848 20.0021 6.66667V17.3333C20.0021 17.7015 19.7037 18 19.3355 18H5.66875C5.30056 18 5.00208 17.7015 5.00208 17.3333V8.44603Z" fill="currentColor" />
        <path d="M7 10C7 9.44772 7.44772 9 8 9H17C17.5523 9 18 9.44772 18 10C18 10.5523 17.5523 11 17 11H8C7.44772 11 7 10.5523 7 10Z" fill="currentColor" />
        <path d="M7 14C7 13.4477 7.44772 13 8 13H14C14.5523 13 15 13.4477 15 14C15 14.5523 14.5523 15 14 15H8C7.44772 15 7 14.5523 7 14Z" fill="currentColor" />
    </svg>
);

export default function SettingsSectionNotifications() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const { navigateToSettings } = useSettingsStore();

    const itemsList = [
        {
            id: '1',
            primary: isRTL ? 'الرسائل' : 'Messages',
            secondary: isRTL ? 'إشعارات الرسائل' : 'Messages notification',
            icon: ChatIcon,
            href: 'settings-notifications-messages'
        },
        {
            id: '2',
            primary: isRTL ? 'المجموعات' : 'Groups',
            secondary: isRTL ? 'إشعارات المجموعات' : 'Groups notification',
            icon: GroupOutlined,
            href: 'settings-notifications-groups'
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
            <SettingsHeader title={isRTL ? 'الإشعارات' : 'Notifications'} />
            <Stack
                spacing={1}
                sx={{
                    width: '100%',
                }}
            >
                {itemsList.slice(0, 4).map((item) => (
                    <ListItemButton
                        key={item.id}
                        onClick={() => navigateToSettings(item.href)}
                        sx={(theme) => ({
                            width: "100%",
                            borderRadius: 0,
                            padding: 0,
                            backgroundColor: "transparent",
                            boxShadow: "0px 0px 0px rgba(0,0,0,0)",
                            textTransform: "inherit",
                            color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                            borderBottom: `1px solid ${theme.palette.mode === "dark" ? "#2C2C2C" : "#E9E9E9"}`,
                            "&:hover": {
                                boxShadow: "0px 0px 0px rgba(0,0,0,0)",
                                backgroundColor: "transparent",
                            },
                            "& .MuiListItemText-secondary": {
                                maxWidth: "100%",
                            },
                        })}
                    >
                        <ListItem
                            sx={{
                                padding: isRTL ? '8px 0 8px 16px' : '8px 16px 8px 0',
                                justifyContent: 'space-between',
                            }}
                        >
                            <ListItemIcon>
                                <item.icon className='size-6! text-gray-600 dark:text-gray-300' />
                            </ListItemIcon>
                            <ListItemText
                                primary={item.primary}
                                sx={{
                                    display: "block",
                                    textAlign: isRTL ? 'right' : 'left',
                                }}
                                secondary={item.secondary}
                                secondaryTypographyProps={{
                                    sx: {
                                        display: "block",
                                        maxWidth: "100%",
                                        textAlign: isRTL ? 'right' : 'left',
                                    },
                                }}
                            />
                            {isRTL ? (
                                <ChevronLeftIcon
                                    sx={{
                                        color: (theme) =>
                                            theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                        fontSize: 24,
                                    }}
                                />
                            ) : (
                                <ChevronRightIcon
                                    sx={{
                                        color: (theme) =>
                                            theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                        fontSize: 24,
                                    }}
                                />
                            )}
                        </ListItem>
                    </ListItemButton>
                ))}
            </Stack>
            <Typography
                variant='body2'
                sx={{
                    color: (theme) =>
                        theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                    width: '100%',
                    textAlign: isRTL ? 'right' : 'left',
                }}
            >
                {isRTL ? 'للحصول على الإشعارات، تأكد من تشغيلها في إعدادات المتصفح والجهاز.' : 'To get notifications, make sure they are turned on in your browser and device settings.'}
            </Typography>
        </Stack>
    )
}