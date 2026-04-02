"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import ChatsSectionLargeSideBar from "./chats-section-large-sidebar";
import mockChats from "@/mocks/chat-items";
import CreateChatSectionLargeSideBar from "./create-chat-section-large-sidebar";
import { useSidebarStore } from "@/store/use-active-sidebar-store";
import SettingsSectionSideBar from "./settings-section-large-sidebar";
import ArchiveSectionLargeSidebar from "./archive-section-large-sidebar";
import ProfileSectionLargeSidebar from "./profile-section-large-sidebar";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";

export default function LargeSideBar() {
    const { activeSideBar } = useSidebarStore();
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const customEasing: [number, number, number, number] = [0.32, 0, 0.67, 0];

    return (
        <div className="md:flex hidden flex-col w-full xxl:max-w-lg xl:max-w-[430] sm:max-w-xs max-w-xs h-full bg-white dark:bg-[#161717] relative overflow-hidden">
            <div className="absolute w-full z-10">
                {activeSideBar === 'main-chat' && (
                    <ChatsSectionLargeSideBar data={mockChats} />
                )}
                {activeSideBar === 'main-setting' && (
                    <SettingsSectionSideBar />
                )}
                {activeSideBar === 'main-archive' && (
                    <ArchiveSectionLargeSidebar />
                )}
                {activeSideBar === 'main-profile' && (
                    <ProfileSectionLargeSidebar />
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
                        className="relative z-10 flex h-full w-full"
                        style={{
                            pointerEvents: activeSideBar === 'create-chat' ? 'auto' : 'none'
                        }}
                    >
                        {activeSideBar === 'create-chat' && (
                            <CreateChatSectionLargeSideBar />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
