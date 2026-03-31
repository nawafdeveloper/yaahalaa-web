"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import useMediaPreviewStore from '@/store/media-preview-store';
import { CloseOutlined, FileDownloadOutlined, KeyboardDoubleArrowRight, MoodOutlined, Person, PushPinOutlined, Shortcut, StarOutline, StartOutlined, ZoomIn, ZoomOut } from '@mui/icons-material'
import { Avatar, Box, IconButton, Tooltip, Typography } from '@mui/material'
import React from 'react'

type Props = {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    maxZoom: number;
    minZoom: number;
}

type ActionButton = {
    id: string;
    tooltip: string;
    icon: React.ElementType | React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}

export default function MediaPreviewHeader({ zoom, onZoomIn, onZoomOut, maxZoom, minZoom }: Props) {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const { closePreview, mediaUrl, senderUserId, createdAt } = useMediaPreviewStore();

    const actionButtons: ActionButton[] = [
        {
            id: '1',
            tooltip: isRTL ? 'تصغير' : 'Zoom out',
            icon: ZoomOut,
            onClick: onZoomOut,
            disabled: zoom <= minZoom,
        },
        {
            id: '2',
            tooltip: isRTL ? 'تكبير' : 'Zoom in',
            icon: ZoomIn,
            onClick: onZoomIn,
            disabled: zoom >= maxZoom,
        },
        {
            id: '3',
            tooltip: isRTL ? 'الذهاب للمحادثة' : 'Go to message',
            icon:
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.00208 9L0.942085 5.53C0.542171 4.86348 1.01478 4 1.79207 4H19.3355C20.8082 4 22.0021 5.19391 22.0021 6.66667V17.3333C22.0021 18.8061 20.8082 20 19.3355 20H5.66875C4.19599 20 3.00208 18.8061 3.00208 17.3333V9ZM5.00208 8.44603L3.53447 6H19.3355C19.7037 6 20.0021 6.29848 20.0021 6.66667V17.3333C20.0021 17.7015 19.7037 18 19.3355 18H5.66875C5.30056 18 5.00208 17.7015 5.00208 17.3333V8.44603Z" fill="currentColor" />
                    <path d="M7 10C7 9.44772 7.44772 9 8 9H17C17.5523 9 18 9.44772 18 10C18 10.5523 17.5523 11 17 11H8C7.44772 11 7 10.5523 7 10Z" fill="currentColor" />
                    <path d="M7 14C7 13.4477 7.44772 13 8 13H14C14.5523 13 15 13.4477 15 14C15 14.5523 14.5523 15 14 15H8C7.44772 15 7 14.5523 7 14Z" fill="currentColor" />
                </svg>
            ,
            onClick: () => { },
        },
        {
            id: '4',
            tooltip: isRTL ? 'رد' : 'Reply',
            icon: Shortcut,
            onClick: () => { },
        },
        {
            id: '5',
            tooltip: isRTL ? 'نجمة' : 'Star',
            icon: StarOutline,
            onClick: () => { },
        },
        {
            id: '6',
            tooltip: isRTL ? 'تثبيت' : 'Pin',
            icon: PushPinOutlined,
            onClick: () => { },
        },
        {
            id: '7',
            tooltip: isRTL ? 'تفاعل' : 'React',
            icon: MoodOutlined,
            onClick: () => { },
        },
        {
            id: '8',
            tooltip: isRTL ? 'إعادة توجيه' : 'Forward',
            icon: KeyboardDoubleArrowRight,
            onClick: () => { },
        },
        {
            id: '9',
            tooltip: isRTL ? 'حفظ كـ' : 'Save as',
            icon: FileDownloadOutlined,
            onClick: () => { },
        },
        {
            id: '10',
            tooltip: isRTL ? 'إغلاق' : 'Close',
            icon: CloseOutlined,
            onClick: () => closePreview(),
        },
    ];

    return (
        <Box
            sx={(theme) => ({
                height: 64,
                width: "100%",
                px: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 0,
                boxShadow: "0px 2px 2px rgba(0,0,0,0.08)",
                backgroundColor: theme.palette.mode === "dark" ? "#161717" : "#FFFFFF",
                color: theme.palette.mode === "dark" ? "#FFFFFF" : "#000000"
            })}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Avatar
                    sx={(theme) => ({
                        width: 40,
                        height: 40,
                        backgroundColor:
                            theme.palette.mode === "dark" ? "#1d1f1f" : "#f7f5f3",
                        border: "1px solid",
                        borderColor:
                            theme.palette.mode === "dark" ? "#404040" : "#d4d4d4",
                        color: theme.palette.mode === "dark" ? "#fff" : "#000",
                    })}
                >
                    <Person />
                </Avatar>
                <span className='flex flex-col items-start justify-start'>
                    <Typography
                        variant="body1"
                        sx={{
                            fontWeight: "600"
                        }}
                    >
                        {senderUserId}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: "600"
                        }}
                    >
                        {createdAt}
                    </Typography>
                </span>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {actionButtons.map((item) => (
                    <Tooltip
                        key={item.id}
                        title={item.tooltip}
                        placement="bottom"
                        slotProps={{
                            tooltip: {
                                sx: (theme) => ({
                                    backgroundColor:
                                        theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                                    color: theme.palette.mode === "dark" ? "#000000" : "#ffffff",
                                }),
                            },
                        }}
                    >
                        <IconButton
                            size="medium"
                            component="span"
                            disabled={item.disabled}
                            sx={(theme) => ({
                                color: theme.palette.mode === "dark" ? "#ffffff" : "#000000"
                            })}
                            onClick={item.onClick}
                        >
                            {React.isValidElement(item.icon)
                                ? item.icon
                                : React.createElement(item.icon as React.ElementType)
                            }
                        </IconButton>
                    </Tooltip>
                ))}
            </Box>
        </Box>
    )
}