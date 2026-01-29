"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Menu, X } from "lucide-react"

export function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    return (
        <nav className="hidden lg:sticky lg:top-0 lg:z-50 lg:w-full lg:bg-black/40 lg:backdrop-blur-2xl lg:block">
            <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
                {/* Left side */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-3 py-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5">
                            <Image
                                src="/images/vector-logo.png"
                                alt="SoulPrint Logo"
                                width={32}
                                height={32}
                                className="h-6 w-6"
                                priority
                            />
                        </div>
                        <Image
                            src="/images/SoulPrintEngine-title-logo.png"
                            alt="SoulPrint Engine"
                            width={170}
                            height={38}
                            className="h-6 w-auto sm:h-7"
                            priority
                        />
                    </Link>
                </div>

                {/* Center nav (desktop) */}
                <div className="hidden md:flex items-center gap-6 text-sm font-medium text-white/70">
                    <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
                    <span className="h-4 w-px bg-white/15" />
                    <Link href="/#faq" className="hover:text-white transition-colors">FAQ</Link>
                    <span className="h-4 w-px bg-white/15" />
                    <Link href="/#about" className="hover:text-white transition-colors">About</Link>
                    <span className="h-4 w-px bg-white/15" />
                    <a href="mailto:drew@arpaforge.com" className="hover:text-white transition-colors">Contact</a>
                </div>

                {/* Right side */}
                <div className="hidden md:flex items-center gap-3">
                    <Link href="https://soulprintengine.ai/signup">
                        <Button className="h-10 rounded-full bg-[#E8632B] px-6 text-white shadow-[0_0_24px_rgba(232,99,43,0.35)] hover:bg-[#E8632B]/90">
                            Enter SoulPrint
                        </Button>
                    </Link>
                </div>

                {/* Mobile Menu Toggle */}
                <div className="flex md:hidden items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="rounded-xl border border-white/10 bg-white/5"
                    >
                        {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        <span className="sr-only">Toggle menu</span>
                    </Button>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {isMenuOpen && (
                <>
                    <div
                        className="md:hidden fixed inset-0 top-[72px] bg-black/90 backdrop-blur-md z-40"
                        onClick={() => setIsMenuOpen(false)}
                    />
                    <div className="md:hidden absolute top-[72px] left-0 w-full border-b border-white/10 bg-black/90 px-6 py-6 flex flex-col gap-6 animate-in slide-in-from-top-4 duration-200 z-50">
                        <div className="flex flex-col gap-3">
                            <Link href="/#features" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium text-white/80">Features</Link>
                            <Link href="/#faq" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium text-white/80">FAQ</Link>
                            <Link href="/#about" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium text-white/80">About</Link>
                            <a href="mailto:drew@arpaforge.com" onClick={() => setIsMenuOpen(false)} className="text-lg font-medium text-white/80">Contact</a>
                        </div>
                        <div className="h-px bg-white/10 w-full" />
                        <div className="flex flex-col gap-3">
                            <Link href="https://soulprintengine.ai/signup" onClick={() => setIsMenuOpen(false)}>
                                <Button className="w-full h-12 rounded-full bg-[#E8632B] text-white hover:bg-[#E8632B]/90">
                                    Enter SoulPrint
                                </Button>
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </nav>
    )
}
