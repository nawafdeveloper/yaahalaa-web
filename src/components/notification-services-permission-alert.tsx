"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { NotificationsOffOutlined } from '@mui/icons-material';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';

export default function NotificationServicesPermissionAlert() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    return (
        <Alert
            severity="success"
            dir={isRTL ? 'rtl' : 'ltr'}
            onClose={() => { }}
            icon={<NotificationsOffOutlined fontSize="large" sx={{ color: "#25D366" }} />}
            sx={(theme) => ({
                borderRadius: 3,
                backgroundColor:
                    theme.palette.mode === "dark" ? "#103529" : "#D9FDD3",
                color: theme.palette.mode === "dark" ? "white" : "black",
                textAlign: isRTL ? 'right' : 'left',
                direction: isRTL ? 'rtl' : 'ltr',
                "& .MuiAlert-icon": {
                    color: theme.palette.mode === "dark" ? "#5cd68a" : "#198754",
                    marginRight: isRTL ? 0 : '12px',
                    marginLeft: isRTL ? '12px' : 0,
                },
                "& .MuiAlert-message": {
                    width: '100%',
                    textAlign: isRTL ? 'right' : 'left',
                },
                "& .MuiAlert-action": {
                    marginRight: isRTL ? 'auto' : 0,
                    marginLeft: isRTL ? 0 : 'auto',
                    paddingRight: isRTL ? '12px' : 0,
                    paddingLeft: isRTL ? 0 : '12px',
                },
            })}
        >
            {isRTL ? 'إشعارات الرسائل غير مفعلة.' : 'Message notifications are off.'}{"  "}
            <Link
                href="#"
                underline="hover"
                sx={(theme) => ({
                    fontWeight: 600,
                    color: "#25D366",
                    cursor: "pointer",
                    "&:hover": {
                        color: "#25D366",
                    },
                })}
            >
                {isRTL ? 'تفعيل' : 'Turn on'}
            </Link>
        </Alert>
    )
}