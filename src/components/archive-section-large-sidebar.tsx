"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import React from 'react'

export default function ArchiveSectionLargeSidebar() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    return (
        <div className={`flex flex-col space-y-4 h-screen max-h-screen min-h-screen w-full ${isRTL ? 'border-l' : 'border-r'} dark:border-neutral-700 border-neutral-300`}>
            ArchiveSectionLargeSidebar
        </div>
    )
}