"use client"

import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
// import { SignUpModal } from "@/components/auth/signup-modal" // Temporarily disabled for waitlist

export function Navbar() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 w-full items-center justify-between">
                {/* Left side: uniform gap-6 spacing (same as Features/FAQ) */}
                <div className="flex items-center gap-6 pl-6">
                    <Image
                        src="/images/vector-personalized.png"
                        alt="SoulPrint Icon"
                        width={40}
                        height={40}
                        className="h-10 w-10"
                    />
                    <Link href="/" className="flex items-center">
                        <Image
                            src="/images/SoulPrintEngine-title-logo.png"
                            alt="SoulPrint"
                            width={120}
                            height={30}
                        />
                    </Link>

                    <div className="hidden md:flex gap-6">
                        <Link
                            href="/#features"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Features
                        </Link>
                        <Link
                            href="/#faq"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            FAQ
                        </Link>
                        <Link
                            href="/#about"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            About
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-4 pr-3 md:pr-6 lg:pr-12 xl:pr-16">
                    {mounted && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className="rounded-full"
                        >
                            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                            <span className="sr-only">Toggle theme</span>
                        </Button>
                    )}

                    <div className="hidden md:flex gap-2">
                        <Link href="/waitlist">
                            <Button>Join the Waitlist</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    )
}
