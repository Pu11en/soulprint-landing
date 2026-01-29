import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Koulen, Geist, Inter, Host_Grotesk, Cinzel } from "next/font/google";
import "./globals.css";
import { AchievementToastProvider } from "@/components/AchievementToast";

const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter" 
});

const koulen = Koulen({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-koulen"
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const hostGrotesk = Host_Grotesk({
  subsets: ["latin"],
  variable: "--font-host-grotesk",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
});

export const metadata: Metadata = {
  title: "SoulPrint — AI that remembers you",
  description: "Import your ChatGPT history. Get an AI that actually knows you.",
  icons: {
    icon: '/logo.svg',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SoulPrint',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${plusJakarta.className} ${inter.variable} ${koulen.variable} ${geist.variable} ${hostGrotesk.variable} ${cinzel.variable} antialiased bg-[#0A0A0B]`}>
        <AchievementToastProvider>
          {children}
        </AchievementToastProvider>
      </body>
    </html>
  );
}
