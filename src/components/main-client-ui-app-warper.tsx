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
import DetailedLargeSidebar from './detailed-large-sidebar';
import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { useDetailedSidebarStore } from '@/store/use-detailed-sidebar-store';
import { useLogout } from '@/hooks/use-logout';
import { Snackbar } from '@mui/material';
import { Info } from '@mui/icons-material';

export default function MainClientUIAppWrapper({ children }: { children: React.ReactNode }) {
    const { isOpen } = useMediaPreviewStore();
    const { activeSideBar, setActiveSideBar } = useSidebarStore();
    const { isOpen: isDetailedSidebarOpen } = useDetailedSidebarStore();
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const {
        loading: logoutLoading,
        isError,
        setIsError,
        errorMsg,
        logout
    } = useLogout(isRTL);

    const customEasing: [number, number, number, number] = [0.32, 0, 0.67, 0];

    const [isLoaded, setIsLoaded] = useState(false);
    const [activeNav, setActiveNav] = useState<'chats' | 'settings' | 'profile' | 'archive'>('chats');
    const [activeContentPage, setActiveContentPage] = useState<'empty-state' | 'messages-state'>('empty-state');

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            setIsLoaded(true);
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    if (!isLoaded || logoutLoading) return <GlobalLoading />;

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
                    <main className="relative flex flex-row items-start h-screen overflow-y-hidden overflow-x-hidden">
                        <SmallSideBar
                            activeNav={activeNav}
                            setActiveNav={setActiveNav}
                        />
                        <LargeSideBar logout={logout} />
                        <div className="flex flex-1 w-full">
                            {children}
                        </div>
                        <motion.div
                            initial={false}
                            animate={{
                                width: isDetailedSidebarOpen ? '100%' : 0,
                                opacity: 1,
                                x: isDetailedSidebarOpen ? 0 : (isRTL ? '-100%' : '100%'),
                            }}
                            transition={{ duration: 0.2, ease: customEasing }}
                            className="relative z-10 flex h-full shrink-0 overflow-hidden w-full max-w-[18rem] sm:max-w-[20rem] xl:max-w-115"
                            style={{
                                pointerEvents: isDetailedSidebarOpen ? 'auto' : 'none',
                            }}
                        >
                            <DetailedLargeSidebar />
                        </motion.div>
                    </main>
                </MuiSystemThemeProvider>
            </motion.div>
            <Snackbar
                open={isError}
                autoHideDuration={6000}
                onClose={() => setIsError(false)}
                message={errorMsg}
                ContentProps={{
                    sx: (theme) => ({
                        borderRadius: '99px',
                        bgcolor: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
                        color: theme.palette.mode === 'dark' ? '#000000' : '#ffffff',
                        fontWeight: 500,
                        paddingRight: '24px',
                        boxShadow: 'none'
                    }),
                }}
                action={
                    <Info />
                }
            />
        </>
    );
}
