import type { Metadata } from "next";
import { Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import MainClientUIAuthWrapper from "@/components/main-client-ui-auth-warper";
import MainClientUIAppWrapper from "@/components/main-client-ui-app-warper";
import { getLocale } from "@/lib/locale";
import { isRTL } from '@/lib/locale-utils';
import { auth } from "@/lib/auth";
import NewPinCode from "@/components/new-pin-code";
import PinCodeWrapper from "@/components/pin-code-wrapper";

const notoSansArabic = Noto_Sans_Arabic({
  weight: ["300", "400", "500", "700"],
  subsets: ["arabic"],
  variable: "--font-noto-sans-arabic",
});

export const metadata: Metadata = {
  title: "YaaHala",
  description: "YaaHala | Secure and Reliable Free Private Messaging",
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  const locale = await getLocale()
  const headersList = await headers();
  const country = headersList.get("X-CF-Country");

  if (!session) {
    return (
      <html lang={locale} dir={isRTL(locale) ? 'rtl' : 'ltr'}>
        <body className={`${notoSansArabic.variable} antialiased`}>
          <MainClientUIAuthWrapper country={country} />
        </body>
      </html>
    );
  }

  if (session.user.isNewUser) {
    return (
      <html lang={locale} dir={isRTL(locale) ? 'rtl' : 'ltr'}>
        <body className={`${notoSansArabic.variable} antialiased`}>
          <NewPinCode />
        </body>
      </html>
    );
  }

  return (
    <html lang={locale} dir={isRTL(locale) ? 'rtl' : 'ltr'}>
      <body className={`${notoSansArabic.variable} antialiased`}>
        <PinCodeWrapper />
        <MainClientUIAppWrapper>{children}</MainClientUIAppWrapper>
      </body>
    </html>
  );
}
