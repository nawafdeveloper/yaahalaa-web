'use client';

import { MenuItem, Select, SelectChangeEvent, FormControl, InputLabel } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Locale } from '../../proxy';
import { getLocaleDisplayName } from '@/lib/locale-client';
import { setLocale } from '@/lib/locale';

interface LocaleSwitcherProps {
    currentLocale: Locale;
}

export default function LocaleSwitcher({ currentLocale }: LocaleSwitcherProps) {
    const router = useRouter();
    const [selectedLocale, setSelectedLocale] = useState<Locale>(currentLocale);
    const [isPending, startTransition] = useTransition();

    const handleLocaleChange = async (event: SelectChangeEvent) => {
        const newLocale = event.target.value as Locale;
        setSelectedLocale(newLocale);
        
        // Use startTransition for better UX
        startTransition(async () => {
            try {
                // Call server action directly
                await setLocale(newLocale);
                
                // Refresh the page to apply the new locale
                router.refresh();
            } catch (error) {
                console.error('Failed to change locale:', error);
                // Revert the selection on error
                setSelectedLocale(currentLocale);
            }
        });
    };

    const locales = [
        { value: 'en' as Locale, label: getLocaleDisplayName('en') },
        { value: 'ar' as Locale, label: getLocaleDisplayName('ar') },
    ];

    return (
        <FormControl sx={{ width: '100%' }}>
            <InputLabel
                id="locale-select-label"
                sx={{
                    color: (theme) =>
                        theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                    '&.Mui-focused': {
                        color: '#25D366',
                    },
                }}
            >
                Language
            </InputLabel>
            <Select
                labelId="locale-select-label"
                id="locale-select"
                value={selectedLocale}
                onChange={handleLocaleChange}
                label="Language"
                IconComponent={ChevronRight}
                disabled={isPending}
                sx={{
                    borderRadius: '12px',
                    backgroundColor: (theme) =>
                        theme.palette.mode === "dark" ? "#2A2A2A" : "#F5F5F5",
                    opacity: isPending ? 0.7 : 1,
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
                            maxHeight: 48 * 4.5 + 8,
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
                {locales.map((locale) => (
                    <MenuItem
                        key={locale.value}
                        value={locale.value}
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
                        {locale.label}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}