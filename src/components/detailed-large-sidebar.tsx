"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import React from 'react'

export default function DetailedLargeSidebar() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    return (
        <div className="md:flex hidden flex-col w-full xxl:max-w-lg xl:max-w-md sm:max-w-xs max-w-xs h-full bg-white dark:bg-[#161717] relative overflow-hidden">
            <div className={`flex flex-col space-y-4 h-screen max-h-screen min-h-screen w-full ${isRTL ? 'border-r' : 'border-l'} dark:border-neutral-700 border-neutral-300`}>

            </div>
        </div>
    )
}