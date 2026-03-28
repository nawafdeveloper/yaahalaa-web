"use client";

import { useEffect, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { Noto_Sans_Arabic } from "next/font/google";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";

const notoSansArabic = Noto_Sans_Arabic({
    weight: ["300", "400", "500", "700"],
    subsets: ["arabic"],
});

export function MuiSystemThemeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<"light" | "dark">("light");
    const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");
    const [themeKey, setThemeKey] = useState(0);

    // Handle system theme
    useEffect(() => {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

        const updateTheme = () => {
            const isDark = systemTheme.matches;
            setMode(isDark ? "dark" : "light");
            document.documentElement.classList.toggle("dark", isDark);
        };

        updateTheme();
        systemTheme.addEventListener("change", updateTheme);

        return () => systemTheme.removeEventListener("change", updateTheme);
    }, []);

    // Handle direction based on locale from cookie
    useEffect(() => {
        const updateDirection = () => {
            const locale = getLocaleFromCookie();
            const isRTL = locale ? isRTLClient(locale) : false;
            const newDirection = isRTL ? "rtl" : "ltr";

            setDirection(newDirection);
            document.documentElement.dir = newDirection;

            // Force theme to re-render when direction changes
            setThemeKey(prev => prev + 1);
        };

        updateDirection();

        // Listen for custom event when locale changes
        window.addEventListener('localeChanged', updateDirection);

        return () => {
            window.removeEventListener('localeChanged', updateDirection);
        };
    }, []);

    const theme = createTheme({
        palette: {
            mode,
        },
        typography: {
            fontFamily: notoSansArabic.style.fontFamily,
        },
        direction: direction,
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        fontFamily: notoSansArabic.style.fontFamily,
                    },
                },
            },
            MuiListItem: {
                styleOverrides: {
                    root: {
                        direction: direction,
                    },
                },
            },
            MuiListItemText: {
                styleOverrides: {
                    root: {
                        textAlign: direction === 'rtl' ? 'right' : 'left',
                    },
                    secondary: {
                        direction: direction,
                    },
                },
            },
            MuiListItemAvatar: {
                styleOverrides: {
                    root: {
                        marginRight: direction === 'rtl' ? 0 : 16,
                        marginLeft: direction === 'rtl' ? 16 : 0,
                    },
                },
            },
            MuiBadge: {
                styleOverrides: {
                    root: {
                        direction: 'ltr',
                    },
                },
            }
        },
    });

    return (
        <ThemeProvider key={themeKey} theme={theme}>
            {children}
        </ThemeProvider>
    );
}