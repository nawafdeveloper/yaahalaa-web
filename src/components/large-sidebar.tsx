"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import ChatsSectionLargeSideBar from "./chats-section-large-sidebar";
import CreateChatSectionLargeSideBar from "./create-chat-section-large-sidebar";
import { useSidebarStore } from "@/store/use-active-sidebar-store";
import SettingsSectionSideBar from "./settings-section-large-sidebar";
import ArchiveSectionLargeSidebar from "./archive-section-large-sidebar";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import { useSubsidebarStore } from "@/store/use-active-subsidebar-store";
import CreateNewContactSection from "./create-new-contact-section";

type Props = {
    logout: () => void;
    country: string | null;
};

export default function LargeSideBar({ logout, country }: Props) {
    const { activeSideBar } = useSidebarStore();
    const { activeSubsideBar } = useSubsidebarStore();
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const customEasing: [number, number, number, number] = [0.32, 0, 0.67, 0];

    return (
        <div className="md:flex hidden flex-col w-full xl:max-w-117.5 sm:max-w-xs max-w-xs h-full bg-white dark:bg-[#161717] relative overflow-hidden">
            <div className="absolute inset-0 z-10">
                {activeSideBar === 'main-chat' && (
                    <ChatsSectionLargeSideBar logout={logout} />
                )}
                {activeSideBar === 'main-setting' && (
                    <SettingsSectionSideBar />
                )}
                {activeSideBar === 'main-archive' && (
                    <ArchiveSectionLargeSidebar />
                )}
            </div>
            <AnimatePresence mode="popLayout">
                {activeSideBar !== 'main-chat' && (
                    <motion.div
                        key={activeSideBar}
                        initial={{ x: isRTL ? '100%' : '-100%', opacity: 1 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: isRTL ? '100%' : '-100%', opacity: 1 }}
                        transition={{ duration: 0.15, ease: customEasing }}
                        className="absolute inset-0 z-10 flex h-full w-full"
                        style={{
                            pointerEvents: activeSideBar === 'create-chat' ? 'auto' : 'none'
                        }}
                    >
                        {activeSideBar === 'create-chat' && (
                            <CreateChatSectionLargeSideBar />
                        )}
                    </motion.div>
                )}
                {activeSideBar === 'create-chat' && activeSubsideBar && (
                    <motion.div
                        key={activeSubsideBar}
                        initial={{ x: isRTL ? '100%' : '-100%', opacity: 1 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: isRTL ? '100%' : '-100%', opacity: 1 }}
                        transition={{ duration: 0.15, ease: customEasing }}
                        className="absolute inset-0 z-20 flex h-full w-full"
                        style={{
                            pointerEvents: activeSubsideBar === 'new-contact' ? 'auto' : 'none'
                        }}
                    >
                        {activeSubsideBar === 'new-contact' && (
                            <CreateNewContactSection country={country} />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
