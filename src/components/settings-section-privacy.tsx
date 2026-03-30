"use client";

import { ListItem, ListItemButton, ListItemText, Stack, Switch, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import React, { useState } from 'react';
import SettingsHeader from './settings-header';
import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { useSettingsStore } from '@/store/use-active-setting-store';

export default function SettingsSectionPrivacy() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const [readReceipt, setReadReceipt] = useState(true);
    const [blockUnknownContact, setBlockUnknownContact] = useState(false);
    const [disableLinkPreview, setDisableLinkPreview] = useState(false);

    const { navigateToSettings } = useSettingsStore();

    const translations = {
        en: {
            title: 'Privacy',
            subtitle: 'Who can see my personal information',
            secondSubtitle: 'Dissappearing messages',
            thirdSubtitle: 'Advanced',
            lastSeen: 'Last seen & online',
            profilePicture: 'Profile picture',
            about: 'About',
            status: 'Status',
            defaultTimer: 'Default message timer',
            groups: 'Groups',
            blockedContacts: 'Blocked contacts',
            appLock: 'App lock',
            lastSeenSecondary: 'Control who can see when you were last active',
            profilePictureSecondary: 'Manage who can view your profile photo',
            aboutSecondary: 'Choose who can see your bio and information',
            statusSecondary: 'Select who can view your status updates',
            defaultTimerSecondary: 'Set how long messages last before disappearing',
            groupsSecondary: 'Decide who can add you to group chats',
            blockedContactsSecondary: 'View and manage blocked contacts',
            appLockSecondary: 'Required password to unlock YaaHalaa',
        },
        ar: {
            title: 'الخصوصية',
            subtitle: 'من يمكنه مشاهدة معلوماتي الشخصية',
            secondSubtitle: '',
            thirdSubtitle: 'متقدم',
            lastSeen: 'آخر ظهور و عبر الإنترنت',
            profilePicture: 'الصورة الشخصية',
            about: 'عن',
            status: 'الحالة',
            defaultTimer: 'المؤقت الافتراضي للرسائل',
            groups: 'المجموعات',
            blockedContacts: 'جهات الاتصال المحظورة',
            appLock: 'قفل التطبيق',
            lastSeenSecondary: 'التحكم بمن يمكنه رؤية آخر ظهور لك',
            profilePictureSecondary: 'إدارة من يمكنه مشاهدة صورتك الشخصية',
            aboutSecondary: 'اختر من يمكنه رؤية معلوماتك الشخصية',
            statusSecondary: 'حدد من يمكنه مشاهدة تحديثات الحالة الخاصة بك',
            defaultTimerSecondary: 'تعيين مدة بقاء الرسائل قبل اختفائها',
            groupsSecondary: 'تحديد من يمكنه إضافتك إلى المجموعات',
            blockedContactsSecondary: 'عرض وإدارة جهات الاتصال المحظورة',
            appLockSecondary: 'مطلوب كلمة مرور لفتح ياهلا',
        }
    };

    const t = translations[locale === 'ar' ? 'ar' : 'en'];

    const subItemList = [
        {
            id: '1',
            primary: t.lastSeen,
            secondary: t.lastSeenSecondary,
            href: 'settings-privacy-last-seen'
        },
        {
            id: '2',
            primary: t.profilePicture,
            secondary: t.profilePictureSecondary,
            href: 'settings-privacy-profile-picture'
        },
        {
            id: '3',
            primary: t.about,
            secondary: t.aboutSecondary,
            href: 'settings-privacy-about'
        },
        {
            id: '4',
            primary: t.status,
            secondary: t.statusSecondary,
            href: 'settings-privacy-status'
        },
        {
            id: '5',
            primary: t.defaultTimer,
            secondary: t.defaultTimerSecondary,
            href: 'settings-privacy-message-timer'
        },
        {
            id: '6',
            primary: t.groups,
            secondary: t.groupsSecondary,
            href: 'settings-privacy-groups'
        },
        {
            id: '7',
            primary: t.blockedContacts,
            secondary: t.blockedContactsSecondary,
            href: 'settings-privacy-blocked-contacts'
        },
        {
            id: '8',
            primary: t.appLock,
            secondary: t.appLockSecondary,
            href: 'settings-privacy-app-lock'
        },
    ];

    const ChevronIcon = isRTL ? ChevronLeftIcon : ChevronRightIcon;

    return (
        <Stack
            spacing={4}
            alignItems={'center'}
            className='px-5 pt-5'
            sx={{
                width: '100%',
            }}
        >
            <SettingsHeader title={t.title} />
            <Typography
                variant='body2'
                sx={{
                    color: (theme) =>
                        theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                    width: '100%',
                    textAlign: isRTL ? 'right' : 'left',
                }}
            >
                {t.subtitle}
            </Typography>
            <Stack
                spacing={1}
                sx={{
                    width: '100%',
                }}
            >
                {subItemList.slice(0, 4).map((item) => (
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
            <Stack
                spacing={1}
                sx={{
                    width: '100%',
                }}
            >
                <ListItem
                    sx={{
                        padding: isRTL ? '8px 0 8px 16px' : '8px 16px 8px 0',
                        justifyContent: 'space-between',
                    }}
                >
                    <ListItemText
                        primary={isRTL ? 'إيصالات القراءة' : 'Read receipts'}
                        sx={{
                            display: "block",
                            textAlign: isRTL ? 'right' : 'left',
                        }}
                        secondary={
                            isRTL ?
                                'إذا تم إيقاف التشغيل، لن ترسل أو تستلم إيصالات القراءة. يتم دائمًا إرسال إيصالات القراءة للمحادثات الجماعية.' :
                                `If turned off, you won't send or receive read receipts. Read receipts are always sent for group chats.`
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
                        onChange={() => setReadReceipt(!readReceipt)}
                        checked={readReceipt}
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
            <Typography
                variant='body2'
                sx={{
                    color: (theme) =>
                        theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                    width: '100%',
                    textAlign: isRTL ? 'right' : 'left',
                }}
            >
                {t.secondSubtitle}
            </Typography>
            <Stack
                spacing={1}
                sx={{
                    width: '100%',
                }}
            >
                {subItemList.slice(4, 5).map((item) => (
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
            <Stack
                spacing={1}
                sx={{
                    width: '100%',
                }}
            >
                {subItemList.slice(6, 8).map((item) => (
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
                {t.thirdSubtitle}
            </Typography>
            <Stack
                spacing={1}
                sx={{
                    width: '100%',
                }}
            >
                <ListItem
                    sx={{
                        padding: isRTL ? '8px 0 8px 16px' : '8px 16px 8px 0',
                        justifyContent: 'space-between',
                    }}
                >
                    <ListItemText
                        primary={isRTL ? 'حظر رسائل الحسابات غير المعروفة' : 'Block unknown account messages'}
                        sx={{
                            display: "block",
                            textAlign: isRTL ? 'right' : 'left',
                        }}
                        secondary={
                            isRTL ?
                                'لحماية حسابك وتحسين أداء الجهاز، سيقوم واتساب بحظر الرسائل من الحسابات غير المعروفة إذا تجاوزت حجمًا معينًا.' :
                                `To protect your account and improve device performance, WhatsApp will block messages from unknown accounts if they exceed a certain volume.`
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
                        onChange={() => setBlockUnknownContact(!blockUnknownContact)}
                        checked={blockUnknownContact}
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
                <ListItem
                    sx={{
                        padding: isRTL ? '8px 0 8px 16px' : '8px 16px 8px 0',
                        justifyContent: 'space-between',
                    }}
                >
                    <ListItemText
                        primary={isRTL ? 'تعطيل معاينات الروابط' : 'Disable link previews'}
                        sx={{
                            display: "block",
                            textAlign: isRTL ? 'right' : 'left',
                        }}
                        secondary={
                            isRTL ?
                                'للمساعدة في حماية عنوان IP الخاص بك من الاستدلال من قبل مواقع الويب الخارجية، لن يتم إنشاء معاينات للروابط التي تشاركها في الدردشات.' :
                                `To help protect your IP address from being inferred by third-party websites, previews for the links you share in chats will no longer be generated.`
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
                        onChange={() => setDisableLinkPreview(!disableLinkPreview)}
                        checked={disableLinkPreview}
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
        </Stack>
    );
}