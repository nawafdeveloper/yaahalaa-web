"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import React from 'react'
import DetailedLargeSidebarHeader from './detailed-large-sidebar-header';
import DetailedLargeSidebarContent from './detailed-large-sidebar-content';

export default function DetailedLargeSidebar() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    return (
        <div className="md:flex hidden flex-col w-full h-full bg-white dark:bg-[#161717] relative overflow-hidden">
            <div className={`flex flex-col space-y-4 h-screen max-h-screen min-h-screen w-full ${isRTL ? 'border-r' : 'border-l'} dark:border-neutral-700 border-neutral-300 p-4 overflow-y-auto`}>
                <DetailedLargeSidebarHeader />
                <DetailedLargeSidebarContent
                    contactName={'Zahid Iqbal'}
                    contactNumber={'+966 54 391 9413'}
                    biography={'Hello world, I am using YaaHalaa for real :)'}
                    mediaCount={3}
                    mediaUrls={[
                        'https://images.unsplash.com/photo-1522071820081-009f0129c71c',
                        'https://images.unsplash.com/photo-1522071820081-009f0129c71c',
                        'https://images.unsplash.com/photo-1522071820081-009f0129c71c'
                    ]}
                    muteNotification={false}
                    dissappearingMessages={'off'}
                    isFavorite={false}
                    isBlocked={false}
                />
            </div>
        </div>
    )
}