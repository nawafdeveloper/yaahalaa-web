"use client";

import { Stack } from '@mui/material';
import React from 'react'
import SettingsHeader from './settings-header';

export default function SettingsSectionPrivacy() {
    return (
        <Stack
            spacing={4}
            alignItems={'center'}
            className='px-5 pt-5'
            sx={{
                width: '100%',
            }}
        >
            <SettingsHeader title='Privacy'/>
        </Stack>
    )
}