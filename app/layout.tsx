import type { Metadata } from "next";
import { Inter, Koulen, Geist, Host_Grotesk, Cinzel, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
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
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "SoulPrint - Discover Your Digital Soul",
  description: "Analyze your digital footprint and discover your unique SoulPrint.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.variable,
        koulen.variable,
        geist.variable,
        hostGrotesk.variable,
        cinzel.variable,
        jetbrainsMono.variable
      )}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
