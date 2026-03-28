"use client";

import { ArrowBackOutlined } from '@mui/icons-material';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React from 'react'
import CreateChatMoreInfoButton from './create-chat-more-info-button';
import { useSidebarStore } from '@/store/use-active-sidebar-store';

export default function CreateChatHeaderLargeSidebar() {
    const { setActiveSideBar } = useSidebarStore();
    
    return (
        <div className="flex flex-row items-center justify-between w-full px-5">
            <div className="flex flex-row items-center gap-x-3 w-full">
                <Tooltip
                    title="Back"
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
                        onClick={() => setActiveSideBar('main-chat')}
                        sx={(theme) => ({
                            "&:hover": {
                                backgroundColor:
                                    theme.palette.mode === "dark"
                                        ? "#333333"
                                        : "#e5e5e5",
                            },
                            display: { xs: "none", sm: "flex" }
                        })}
                    >
                        <ArrowBackOutlined fontSize="inherit" />
                    </IconButton>
                </Tooltip>
                <p className='font-semibold'>New chat</p>
            </div>
            <CreateChatMoreInfoButton />
        </div>
    )
}