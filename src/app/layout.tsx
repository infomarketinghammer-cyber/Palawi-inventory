import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

const latin = Noto_Sans({ subsets: ["latin"], variable: "--font-latin", display: "swap" });
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: t("title"), template: `%s · ${t("name")}` },
    description: t("tagline"),
    icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#3c7b62",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${latin.variable} ${devanagari.variable}`}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
