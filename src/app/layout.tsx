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
import { MuiSystemThemeProvider } from "@/context/theme";

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
      <html lang={locale} dir={isRTL(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
        <body className={`${notoSansArabic.variable} antialiased`}>
          <MuiSystemThemeProvider>
            <MainClientUIAuthWrapper country={country} />
          </MuiSystemThemeProvider>
        </body>
      </html>
    );
  }

  if (session.user.isNewUser) {
    return (
      <html lang={locale} dir={isRTL(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
        <body className={`${notoSansArabic.variable} antialiased`}>
          <MuiSystemThemeProvider>
            <NewPinCode />
          </MuiSystemThemeProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang={locale} dir={isRTL(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className={`${notoSansArabic.variable} antialiased`}>
        <MuiSystemThemeProvider>
          <PinCodeWrapper />
          <MainClientUIAppWrapper>{children}</MainClientUIAppWrapper>
        </MuiSystemThemeProvider>
      </body>
    </html>
  );
}
