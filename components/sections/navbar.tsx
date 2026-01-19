"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Menu, X } from "lucide-react"

export function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-black">
            <div className="flex h-16 w-full items-center justify-between px-6">
                {/* Left side */}
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center">
                        <Image
                            src="/images/SoulPrintEngine-title-logo.png"
                            alt="SoulPrint Engine"
                            width={180}
                            height={36}
                            style={{ height: "auto" }}
                            priority
                        />
                    </Link>

                    <div className="hidden md:flex gap-6">
                        <Link href="/#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</Link>
                        <Link href="/#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
                        <Link href="/#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</Link>
                        <a href="mailto:drew@arpaforge.com" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Contact</a>
                    </div>
                </div>

                {/* Desktop Buttons (Hidden on mobile) */}
                <div className="hidden md:flex items-center gap-2">
                    <Link href="/enter">
                        <Button className="bg-[#E8632B] text-white hover:bg-[#E8632B]/90">
                            Enter SoulPrint
                        </Button>
                    </Link>
                </div>

                {/* Mobile Menu Toggle (Visible only on mobile) */}
                <div className="flex md:hidden items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="rounded-xl border border-white/10"
                    >
                        {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        <span className="sr-only">Toggle menu</span>
                    </Button>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-16 left-0 w-full bg-[#0f0f0f] border-b border-white/10 p-6 flex flex-col gap-6 animate-in slide-in-from-top-4 duration-200">
                    <div className="flex flex-col gap-4">
                        <Link href="/#features" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium text-white/70">Features</Link>
                        <Link href="/#faq" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium text-white/70">FAQ</Link>
                        <Link href="/#about" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium text-white/70">About</Link>
                        <a href="mailto:drew@arpaforge.com" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium text-white/70">Contact</a>
                    </div>
                    <div className="h-px bg-white/10 w-full" />
                    <div className="flex flex-col gap-3">
                        <Link href="/enter" onClick={() => setIsMenuOpen(false)}>
                            <Button className="w-full h-12 bg-[#E8632B] text-white hover:bg-[#E8632B]/90">
                                Enter SoulPrint
                            </Button>
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    )
}
