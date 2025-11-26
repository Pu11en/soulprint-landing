"use client"

import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { SignUpModal } from "@/components/auth/signup-modal"

export function Navbar() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 w-full items-center justify-between px-6 md:px-12 lg:px-24 xl:px-32">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center space-x-2">
                        <Image
                            src="/images/SoulPrintEngine-title-logo.png"
                            alt="SoulPrint"
                            width={120}
                            height={30}
                        />
                    </Link>

                    <div className="hidden md:flex gap-6">
                        <Link
                            href="#features"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Features
                        </Link>
                        <Link
                            href="#pricing"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Pricing
                        </Link>
                        <Link
                            href="#faq"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            FAQ
                        </Link>
                        <Link
                            href="#about"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            About
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-4">
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
                        <Button variant="ghost">Sign In</Button>
                        <SignUpModal>
                            <Button>Get Started</Button>
                        </SignUpModal>
                    </div>
                </div>
            </div>
        </nav>
    )
}
