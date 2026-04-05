"use client";

import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Image from "next/image";

export default function GlobalLoading() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    return (
        <div className="flex flex-col h-screen max-h-screen min-h-screen w-full relative bg-white dark:bg-[#161717]">
            <div className="flex flex-col flex-1 h-full w-full justify-center items-center gap-y-6">
                <Image
                    src={'/HalaBaak-logo.svg'}
                    alt="YaaHalaa Corp.©"
                    width={500}
                    height={500}
                    className="w-auto h-8 object-contain"
                />
                <Box sx={{ width: "200px" }}>
                    <LinearProgress
                        sx={(theme) => ({
                            height: 3,
                            borderRadius: 2,

                            backgroundColor:
                                theme.palette.mode === 'dark'
                                    ? 'rgba(37, 211, 102, 0.2)'
                                    : 'rgba(37, 211, 102, 0.15)',

                            '& .MuiLinearProgress-bar': {
                                backgroundColor: '#25D366',
                                borderRadius: 2,
                            },
                        })}
                    />
                </Box>
            </div>
            <span className="absolute bottom-0 left-0 right-0 w-full px-4 md:px-0 md:max-w-xl md:mx-auto pb-10 justify-center items-center text-center bg-transparent text-sm text-gray-500">
                <p>© 2026 {isRTL ? 'YaaHalaa. جميع الحقوق محفوظة. جميع المحتويات والملكية الفكرية تعود إلى YaaHalaa. الاستخدام غير المصرح به محظور.' : 'YaaHalaa. All rights reserved. All content and intellectual property belong to YaaHalaa. Unauthorized use is prohibited.'}</p>
            </span>
        </div>
    )
}