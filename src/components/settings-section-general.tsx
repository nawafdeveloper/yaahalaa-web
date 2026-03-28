// components/settings/settings-section-general.tsx
"use client";

import { ChevronRight } from '@mui/icons-material';
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack } from '@mui/material';
import React, { useState, useEffect } from 'react';
import SettingsHeader from './settings-header';
import LocaleSwitcher from './locale-switcher';
import { getLocaleFromCookie } from '@/lib/locale-client';
import { Locale } from '../../proxy';

const fontSizes = [
    { label: '80%', value: '80%' },
    { label: '90%', value: '90%' },
    { label: '100% (Default)', value: '100%' },
    { label: '110%', value: '110%' },
    { label: '125%', value: '125%' },
    { label: '135%', value: '135%' },
    { label: '150%', value: '150%' },
];

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;

export default function SettingsSectionGeneral() {
    const [selectedFontSize, setSelectedFontSize] = useState<string>('100%');
    const [currentLocale, setCurrentLocale] = useState<Locale>('en');

    useEffect(() => {
        // Get current locale from cookie on client side
        const locale = getLocaleFromCookie();
        if (locale) {
            setCurrentLocale(locale);
        }
    }, []);

    const handleFontSizeChange = (event: SelectChangeEvent) => {
        setSelectedFontSize(event.target.value);
        // Save to localStorage
        localStorage.setItem('fontSize', event.target.value);
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
            <SettingsHeader title='General' />
            
            {/* Language Selector */}
            <LocaleSwitcher currentLocale={currentLocale} />

            {/* Font Size Selector */}
            <FormControl sx={{ width: '100%' }}>
                <InputLabel 
                    id="font-size-select-label"
                    sx={{
                        color: (theme) =>
                            theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                        '&.Mui-focused': {
                            color: '#25D366',
                        },
                    }}
                >
                    Font Size
                </InputLabel>
                <Select
                    labelId="font-size-select-label"
                    id="font-size-select"
                    value={selectedFontSize}
                    onChange={handleFontSizeChange}
                    label="Font Size"
                    IconComponent={ChevronRight}
                    sx={{
                        borderRadius: '12px',
                        backgroundColor: (theme) =>
                            theme.palette.mode === "dark" ? "#2A2A2A" : "#F5F5F5",
                        '& .MuiSelect-select': {
                            padding: '14px 16px',
                            color: (theme) =>
                                theme.palette.mode === "dark" ? "#FFFFFF" : "#000000",
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: (theme) =>
                                theme.palette.mode === "dark" ? "#3A3A3A" : "#E0E0E0",
                            borderWidth: '1px',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#25D366',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#25D366',
                            borderWidth: '2px',
                        },
                        '& .MuiSelect-icon': {
                            transform: 'rotate(0deg)',
                            transition: 'transform 0.2s',
                            color: (theme) =>
                                theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                        },
                        '&.Mui-focused .MuiSelect-icon': {
                            transform: 'rotate(90deg)',
                        },
                    }}
                    MenuProps={{
                        PaperProps: {
                            sx: {
                                maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
                                borderRadius: '12px',
                                marginTop: '8px',
                                marginLeft: '8px',
                                marginRight: '8px',
                                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
                                border: '1px solid',
                                borderColor: (theme) =>
                                    theme.palette.mode === "dark" ? "#3A3A3A" : "#E5E5E5",
                            },
                        },
                        anchorOrigin: {
                            vertical: 'bottom',
                            horizontal: 'left',
                        },
                        transformOrigin: {
                            vertical: 'top',
                            horizontal: 'left',
                        },
                    }}
                >
                    {fontSizes.map((size) => (
                        <MenuItem
                            key={size.value}
                            value={size.value}
                            sx={{
                                borderRadius: '8px',
                                margin: '4px 8px',
                                padding: '8px 12px',
                                '&:hover': {
                                    backgroundColor: (theme) =>
                                        theme.palette.mode === "dark" ? "#2A2A2A" : "#F0F0F0",
                                },
                                '&.Mui-selected': {
                                    backgroundColor: (theme) =>
                                        theme.palette.mode === "dark" ? "#103529" : "#D9FDD3",
                                    color: (theme) =>
                                        theme.palette.mode === "dark" ? "#25D366" : "#1F4E2E",
                                    '&:hover': {
                                        backgroundColor: (theme) =>
                                            theme.palette.mode === "dark" ? "#1A4A3A" : "#C4E8C0",
                                    },
                                },
                            }}
                        >
                            {size.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Stack>
    );
}