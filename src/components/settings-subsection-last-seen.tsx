"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { Stack, Typography } from '@mui/material';
import React from 'react'
import SettingsSubsectionHeader from './settings-subsection-header';

export default function SettingsSubsectionLastSeen() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const translations = {
        en: {
            title: 'Last seen',
        },
        ar: {
            title: 'آخر ظهور',
        }
    };

    const t = translations[locale === 'ar' ? 'ar' : 'en'];

    return (
        <Stack
            spacing={4}
            alignItems={'center'}
            className='px-5 pt-5'
            sx={{
                width: '100%',
            }}
        >
            <SettingsSubsectionHeader title={t.title} />
            <Typography>Last seen</Typography>
        </Stack>
    )
}