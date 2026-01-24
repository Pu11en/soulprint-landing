"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { SoulPrintSelector } from "@/components/dashboard/soulprint-selector"
import { LayoutGrid, LogOut } from "lucide-react"
import { signOut as signOutAction } from "@/app/actions/auth"

interface TopBarProps {
    onMenuClick?: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

    const handleLogout = async () => {
        // Clear local storage first
        localStorage.removeItem("soulprint_internal_key")
        localStorage.removeItem("soulprint_answers")
        localStorage.removeItem("soulprint_current_q")

        // Then call server action to clear cookies and redirect
        await signOutAction()
    }

    return (
        <>
            <header className="flex min-h-[52px] items-center justify-between border-b border-[#111111] bg-[#111111] px-4 pt-[env(safe-area-inset-top)]">
                {/* Left side - Logo + branding */}
                <div className="flex items-center gap-2">
                    {/* SoulPrint Logo */}
                    <Image
                        src="/images/soulprintlogomain.png"
                        alt="SoulPrint"
                        width={28}
                        height={28}
                        className="h-7 w-7 object-contain"
                    />

                    {/* Branding */}
                    <span className="font-koulen text-[18px] sm:text-[22px] leading-[22px] sm:leading-[26px] text-white tracking-wide">
                        SOULPRINT
                    </span>
                    <span className="hidden sm:inline font-cinzel font-normal text-[20px] leading-[26px] tracking-[1px] uppercase text-white -ml-1">
                        ENGINE
                    </span>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Mobile hamburger menu */}
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                    >
                        <LayoutGrid className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only">Menu</span>
                    </button>

                    {/* SoulPrint Selector - hidden on mobile */}
                    <div className="hidden sm:block">
                        <SoulPrintSelector />
                    </div>

                    {/* Logout button */}
                    <Button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="h-8 rounded-lg bg-gray-700 px-2 sm:px-3 py-1 font-geist text-xs font-medium text-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] hover:bg-gray-600"
                    >
                        <LogOut className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Logout</span>
                    </Button>
                </div>
            </header>

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="mx-4 w-full max-w-sm rounded-xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
                        <h3 className="font-koulen text-xl text-white mb-2">Confirm Logout</h3>
                        <p className="text-white/70 text-sm mb-6">
                            Are you sure you want to log out of SoulPrint?
                        </p>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="flex-1 h-10 rounded-lg border border-white/20 bg-transparent text-white hover:bg-white/10"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleLogout}
                                className="flex-1 h-10 rounded-lg bg-[#FF4D00] text-white hover:bg-[#FF4D00]/90"
                            >
                                Logout
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
