import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono, Noto_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const notoSans = Noto_Sans({
  // latin-ext is required: the Naira sign ₦ (U+20A6) is NOT in Google's
  // latin subset unicode-range, so without latin-ext the browser falls back
  // to system fonts for ₦ — the broken-glyph bug in Section 1.1.
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Belgrove Homes",
  description: "Find your next home. Book a property inspection with Belgrove Homes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${fraunces.variable} ${inter.variable} ${plexMono.variable} ${notoSans.variable}`}>
      <body className="min-h-full flex flex-col font-sans bg-[var(--bg-cream)] text-[var(--text-heading)]">{children}</body>
    </html>
  );
}
