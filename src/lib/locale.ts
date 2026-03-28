'use server';

import { cookies } from 'next/headers';
import { Locale } from '../../proxy';

const VALID: Locale[] = ['ar', 'en'];

export async function getLocale(): Promise<Locale> {
    // Cookie is the source of truth
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get('yhla_web_lang_pref')?.value;
    if (fromCookie && VALID.includes(fromCookie as Locale)) {
        return fromCookie as Locale;
    }

    // Fall back to default
    return 'en';
}

export async function setLocale(locale: Locale): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set('yhla_web_lang_pref', locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
}