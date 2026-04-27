"use client";

import { useWallpaperStore } from '@/store/use-update-wallpaper';
import { Box } from '@mui/material';
import React from 'react'

export default function WallpaperPreview() {
    const activeWallpaper = useWallpaperStore((s) => s.getActiveKey());

    const getWallpaper = (mode: 'dark' | 'light') => {
        switch (activeWallpaper) {
            case "wallpaper-1":
                return mode === 'dark' ? "url('/dark-wallpaper-1.svg')" : "url('/light-wallpaper-1.svg')";
            case "wallpaper-2":
                return mode === 'dark' ? "url('/dark-wallpaper-2.svg')" : "url('/light-wallpaper-2.svg')";
            case "wallpaper-3":
                return mode === 'dark' ? "url('/dark-wallpaper-3.svg')" : "url('/light-wallpaper-3.svg')";
            case "wallpaper-4":
                return mode === 'dark' ? "url('/dark-wallpaper-4.svg')" : "url('/light-wallpaper-4.svg')";
            case "wallpaper-5":
                return mode === 'dark' ? "url('/dark-wallpaper-5.svg')" : "url('/light-wallpaper-5.svg')";
            case "wallpaper-6":
                return mode === 'dark' ? "url('/dark-wallpaper-6.svg')" : "url('/light-wallpaper-6.svg')";
            case "wallpaper-7":
                return mode === 'dark' ? "url('/dark-wallpaper-7.svg')" : "url('/light-wallpaper-7.svg')";
            case "wallpaper-8":
                return mode === 'dark' ? "url('/dark-wallpaper-8.svg')" : "url('/light-wallpaper-8.svg')";
            case "wallpaper-9":
                return mode === 'dark' ? "url('/dark-wallpaper-9.svg')" : "url('/light-wallpaper-9.svg')";
            case "wallpaper-10":
                return mode === 'dark' ? "url('/dark-wallpaper-10.svg')" : "url('/light-wallpaper-10.svg')";
            default:
                return mode === 'dark' ? "url('/chat-background-dark.svg')" : "url('/chat-background-light.svg')"
        };
    };

    return (
        <Box
            sx={(theme) => ({
                height: "100%",
                width: "100%",
                position: "relative",
                display: "flex",
                overflow: 'hidden',
                backgroundImage: getWallpaper(theme.palette.mode),
                backgroundRepeat: "repeat",
                backgroundSize: "110px",
            })}
        />
    )
}