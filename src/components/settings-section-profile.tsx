"use client";

import { Avatar, Button, IconButton, ListItem, ListItemIcon, ListItemText, Stack, TextField } from '@mui/material';
import React, { useState, useRef, useEffect } from 'react';
import SettingsHeader from './settings-header';
import { CheckOutlined, ContentCopy, EditOutlined, Person, Phone, PhotoCameraOutlined } from '@mui/icons-material';

export default function SettingsSectionProfile() {
    const [isEditing, setIsEditing] = useState(false);
    const [fullName, setFullName] = useState('Nawaf Qahtani');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleEditClick = () => {
        setIsEditing(true);
    };

    const handleCheckClick = () => {
        setIsEditing(false);
        // Here you can save the updated name
        console.log('Saved name:', fullName);
    };

    return (
        <Stack
            spacing={4}
            alignItems={'center'}
            className='px-5 pt-5'
            sx={{
                width: '100%',
            }}
        >
            <SettingsHeader title='Profile' />
            <button className='cursor-pointer relative'>
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
                <span className='absolute left-1/2 -translate-x-1/2 gap-x-2 flex flex-row items-center -bottom-3 dark:bg-background bg-white border dark:border-neutral-700 border-neutral-300 px-5 py-2.5 rounded-full dark:text-[#25D366] text-[#15603E]'>
                    <PhotoCameraOutlined className='size-5!' />
                    <p className='text-sm'>Edit</p>
                </span>
            </button>
            <TextField
                id="user-full-name"
                label="Full name"
                variant="standard"
                disabled={!isEditing}
                inputRef={inputRef}
                sx={(theme) => ({
                    width: '100%',
                    '& .MuiInput-underline:after': {
                        borderBottomColor: theme.palette.mode === 'dark' ? '#25D366' : '#15603E'
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                        color: theme.palette.mode === 'dark' ? '#25D366' : '#15603E'
                    },
                    '& .MuiInputBase-input.Mui-disabled': {
                        WebkitTextFillColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.8)',
                    },
                })}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                InputProps={{
                    endAdornment: (
                        <>
                            {!isEditing ? (
                                <IconButton
                                    size="small"
                                    onClick={handleEditClick}
                                >
                                    <EditOutlined />
                                </IconButton>
                            ) : (
                                <IconButton
                                    size="small"
                                    onClick={handleCheckClick}
                                >
                                    <CheckOutlined />
                                </IconButton>
                            )}
                        </>
                    ),
                }}
            />
            <ListItem
                secondaryAction={
                    <IconButton edge="end" aria-label="delete">
                        <ContentCopy />
                    </IconButton>
                }
            >
                <ListItemIcon>
                    <Phone />
                </ListItemIcon>
                <ListItemText
                    primary="+966 55 994 4487"
                />
            </ListItem>
        </Stack>
    )
}