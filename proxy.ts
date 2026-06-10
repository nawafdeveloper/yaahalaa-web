// proxy.ts
import { NextResponse, NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { applySecurityHeaders } from "@/lib/security-policy";

const LOCALES = ['ar', 'en'] as const;
const DEFAULT_LOCALE = 'ar';
const COOKIE_NAME = 'yhla_web_lang_pref';

export type Locale = typeof LOCALES[number];

function detectLocale(request: NextRequest): Locale {
    // 1. Persisted user preference
    const cookie = request.cookies.get(COOKIE_NAME)?.value;
    if (cookie && LOCALES.includes(cookie as Locale)) {
        return cookie as Locale;
    }

    // 2. Browser preference via Accept-Language
    const acceptLang = request.headers.get('Accept-Language') ?? '';
    const match = acceptLang
        .split(',')
        .map(l => l.split(';')[0].trim().slice(0, 2).toLowerCase())
        .find(l => LOCALES.includes(l as Locale));

    return (match as Locale | undefined) ?? DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
    const { cf } = getCloudflareContext();
    const isApiRequest = request.nextUrl.pathname.startsWith('/api/');
    const locale = detectLocale(request);
    const response = NextResponse.next();

    // ========== Security Headers ==========
    applySecurityHeaders(response.headers);

    // ========== Cloudflare Headers ==========
    if (cf) {
        response.headers.set("X-CF-Country", cf.country ?? "unknown");
        response.headers.set("X-CF-Region", cf.region ?? "unknown");
        response.headers.set("X-CF-ASN", cf.asn?.toString() ?? "unknown");
    }

    // ========== Mobile Detection ==========
    const isMobile = request.headers.get("sec-ch-ua-mobile") ?? "?0";
    response.headers.set("X-Is-Mobile", isMobile);

    if (!isApiRequest) {
        // ========== Locale Handling ==========
        // Inject for Server Components
        response.headers.set('x-locale', locale);

        // Set cookie only if missing (don't overwrite user's choice)
        if (!request.cookies.has(COOKIE_NAME)) {
            response.cookies.set(COOKIE_NAME, locale, {
                path: '/',
                maxAge: 60 * 60 * 24 * 365, // 1 year
                sameSite: 'lax',
                httpOnly: false, // must be false if you read it client-side
            });
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         */
        '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
    ],
};
