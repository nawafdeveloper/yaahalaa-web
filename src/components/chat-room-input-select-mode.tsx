"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { Clear, DeleteOutline, ShortcutOutlined, StarOutline } from '@mui/icons-material';
import { IconButton, Typography } from '@mui/material';
import React from 'react'

interface Props {
    setSelectMode: (value: boolean) => void;
    selectedCount: number;
    setSelectedMessages: (value: string[]) => void;
}

export default function ChatRoomInputSelectMode({ selectedCount, setSelectMode, setSelectedMessages }: Props) {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    return (
        <div className='absolute bottom-0 left-0 right-0 z-50 w-full flex-row p-2 shadow-sm bg-gray-100 dark:bg-[#242626] flex items-center justify-between'>
            <div className='flex flex-row items-center gap-x-3'>
                <IconButton onClick={() => { setSelectMode(false); setSelectedMessages([]) }}>
                    <Clear fontSize="inherit" />
                </IconButton>
                <Typography>
                    {selectedCount} {isRTL ? 'محدد' : 'Selected'}
                </Typography>
            </div>
            <div className='flex flex-row items-center gap-x-3'>
                <IconButton disabled={selectedCount === 0}>
                    <StarOutline fontSize="inherit" />
                </IconButton>
                <IconButton disabled={selectedCount === 0}>
                    <DeleteOutline fontSize="inherit" />
                </IconButton>
                <IconButton disabled={selectedCount === 0}>
                    <ShortcutOutlined fontSize="inherit" />
                </IconButton>
            </div>
        </div>
    )
}