import { Locale } from '../../proxy';

export function isRTL(locale: Locale): boolean {
    return locale === 'ar';
}

export function getLocaleDisplayName(locale: Locale): string {
    return locale === 'ar' ? 'Arabic العربية' : 'English';
}

export function getLocaleFromCookie(): Locale | null {
    if (typeof window === 'undefined') return null;
    const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    return match ? (match[1] as Locale) : null;
}