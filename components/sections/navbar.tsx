"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"
import { WaitlistModal } from "@/components/auth/waitlist-modal"

export function Navbar() {
    const [mounted, setMounted] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [showWaitlistModal, setShowWaitlistModal] = useState(false)
    const LOGIN_ENABLED = true;

    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 w-full items-center justify-between px-6">
                {/* Left side */}
                <div className="flex items-center gap-6">
                    <Image
                        src="/images/vector-personalized.png"
                        alt="SoulPrint Icon"
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0"
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
                        <Link href="/#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</Link>
                        <Link href="/#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
                        <Link href="/#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</Link>
                    </div>
                </div>

                {/* Desktop Buttons (Hidden on mobile) */}
                <div className="hidden md:flex items-center gap-2">
                    <Button
                        onClick={() => setShowWaitlistModal(true)}
                        className="bg-[#EA580C] text-white hover:bg-[#EA580C]/90"
                    >
                        Enter SoulPrint
                    </Button>
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
                    </div>
                    <div className="h-px bg-white/10 w-full" />
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={() => {
                                setIsMenuOpen(false)
                                setShowWaitlistModal(true)
                            }}
                            className="w-full h-12 bg-[#EA580C] text-white hover:bg-[#EA580C]/90"
                        >
                            Enter SoulPrint
                        </Button>
                    </div>
                </div>
            )}
            <WaitlistModal isOpen={showWaitlistModal} onOpenChange={setShowWaitlistModal} />
        </nav>
    )
}
