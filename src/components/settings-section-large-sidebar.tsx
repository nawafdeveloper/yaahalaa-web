"use client";

import React from 'react'
import SettingsSectionMain from './settings-section-main';
import { useSettingsStore } from '@/store/use-active-setting-store';
import { AnimatePresence, motion } from 'framer-motion';
import SettingsSectionGeneral from './settings-section-general';
import SettingsSectionProfile from './settings-section-profile';
import SettingsSectionAccount from './settings-section-account';
import SettingsSectionPrivacy from './settings-section-privacy';
import SettingsSectionChats from './settings-section-chats';
import SettingsSectionNotifications from './settings-section-notifications';
import SettingsSectionHelp from './settings-section-help';
import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';

export default function SettingsSectionSideBar() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const { activeSettingsSection } = useSettingsStore();
    const customEasing: [number, number, number, number] = [0.32, 0, 0.67, 0];

    const isSubSettings = activeSettingsSection !== 'settings-main';

    const getSubSettingsComponent = () => {
        switch (activeSettingsSection) {
            case 'settings-general':
                return <SettingsSectionGeneral />;
            case 'settings-profile':
                return <SettingsSectionProfile />;
            case 'settings-account':
                return <SettingsSectionAccount />;
            case 'settings-privacy':
                return <SettingsSectionPrivacy />;
            case 'settings-chats':
                return <SettingsSectionChats />;
            case 'settings-notifications':
                return <SettingsSectionNotifications />;
            case 'settings-help':
                return <SettingsSectionHelp />;
            default:
                return null;
        }
    };

    return (
        <div className={`relative flex flex-col h-screen max-h-screen min-h-screen w-full ${isRTL ? 'border-l' : 'border-r'} dark:border-neutral-700 border-neutral-300 overflow-y-auto`}>
            <div className="absolute inset-0">
                <SettingsSectionMain />
            </div>
            <AnimatePresence mode="wait">
                {isSubSettings && (
                    <motion.div
                        key={activeSettingsSection}
                        initial={{ x: '-100%', opacity: 1 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '-100%', opacity: 1 }}
                        transition={{ duration: 0.15, ease: customEasing }}
                        className="absolute inset-0 bg-white dark:bg-[#161717] z-20"
                    >
                        {getSubSettingsComponent()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}