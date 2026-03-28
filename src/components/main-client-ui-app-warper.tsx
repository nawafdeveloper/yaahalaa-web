'use client';

import { useEffect, useState } from 'react';
import GlobalLoading from './global-loading';
import { motion } from "framer-motion";
import { MuiSystemThemeProvider } from '@/context/theme';
import SmallSideBar from './small-sidebar';
import LargeSideBar from './large-sidebar';
import useMediaPreviewStore from '@/store/media-preview-store';
import MediaPreviewWarper from './media-preview-warper';
import { useSidebarStore } from '@/store/use-active-sidebar-store';

export default function MainClientUIAppWrapper({ children }: { children: React.ReactNode }) {
    const { isOpen } = useMediaPreviewStore();
    const { activeSideBar, setActiveSideBar } = useSidebarStore();

    const [isLoaded, setIsLoaded] = useState(false);
    const [activeNav, setActiveNav] = useState<'chats' | 'settings' | 'profile' | 'archive'>('chats');
    const [activeContentPage, setActiveContentPage] = useState<'empty-state' | 'messages-state'>('empty-state');

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            setIsLoaded(true);
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    if (!isLoaded) return <GlobalLoading />;

    return (
        <>
            {isOpen && (
                <MuiSystemThemeProvider>
                    <MediaPreviewWarper />
                </MuiSystemThemeProvider>
            )}
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                    duration: 0.35,
                    ease: "easeOut",
                }}
                style={{ height: "100%" }}
            >
                <MuiSystemThemeProvider>
                    <main className="flex flex-row items-start h-screen overflow-y-hidden">
                        <SmallSideBar
                            activeNav={activeNav}
                            setActiveNav={setActiveNav}
                        />
                        <LargeSideBar />
                        <div className="flex flex-1 w-full">
                            {children}
                        </div>
                    </main>
                </MuiSystemThemeProvider>
            </motion.div>
        </>
    );
}
