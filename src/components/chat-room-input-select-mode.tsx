"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { Clear, DeleteOutline, ShortcutOutlined, StarOutline } from '@mui/icons-material';
import { IconButton, Typography } from '@mui/material';
import React from 'react'

interface Props {
    setSelectMode: (value: boolean) => void;
    selectedCount: number;
    setSelectedMessages: (value: string[]) => void;
    onForwardSelected?: () => void;
}

export default function ChatRoomInputSelectMode({
    selectedCount,
    setSelectMode,
    setSelectedMessages,
    onForwardSelected,
}: Props) {
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
                <IconButton
                    disabled={selectedCount === 0}
                    onClick={onForwardSelected}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                        <path d="m640-280-57-56 184-184-184-184 57-56 240 240-240 240ZM80-200v-160q0-83 58.5-141.5T280-560h247L383-704l57-56 240 240-240 240-57-56 144-144H280q-50 0-85 35t-35 85v160H80Z" />
                    </svg>
                </IconButton>
            </div>
        </div>
    )
}
