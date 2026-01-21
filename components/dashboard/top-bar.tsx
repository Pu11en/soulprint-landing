"use client"

import { Button } from "@/components/ui/button"
import { SoulPrintSelector } from "@/components/dashboard/soulprint-selector"
import { LayoutGrid } from "lucide-react"
import { signOut as signOutAction } from "@/app/actions/auth"

interface TopBarProps {
    onMenuClick?: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {

    const handleLogout = async () => {
        // Clear local storage first
        localStorage.removeItem("soulprint_internal_key")
        localStorage.removeItem("soulprint_answers")
        localStorage.removeItem("soulprint_current_q")

        // Then call server action to clear cookies and redirect
        // We import the server action dynamically or pass it as a prop, 
        // but since this is a client component, we should import the action.
        // Ideally, we'd pass this as a prop, but for a quick fix, we can assume the action is available via import.
        // Wait, we can't import server actions directly into client components in some Next.js setups without 'use server' at top of action file (which we have).
        // Let's actually use the action we just modified.
        // We need to import it at the top.
        await signOutAction()
    }

    return (
        <header className="flex h-[52px] items-center justify-between border-b border-[#111111] bg-[#111111] px-4">
            {/* Left side - Mobile menu + branding */}
            <div className="flex items-center gap-3">
                {/* Mobile hamburger menu */}
                <button
                    onClick={onMenuClick}
                    className="lg:hidden inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                >
                    <LayoutGrid className="h-4 w-4" />
                    Menu
                </button>

                {/* Branding - hidden on small mobile, visible on larger screens */}
                <div className="hidden sm:flex items-center gap-2">
                    <span className="font-koulen text-[22px] leading-[26px] text-white tracking-wide">
                        SOULPRINT
                    </span>
                    <span className="font-cinzel font-normal text-[20px] leading-[26px] tracking-[1px] uppercase text-white -ml-1">
                        ENGINE
                    </span>
                </div>
                {/* Compact branding for extra small screens */}
                <span className="sm:hidden font-koulen text-[18px] leading-[22px] text-white tracking-wide">
                    SOULPRINT
                </span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3">
                <SoulPrintSelector />
                <Button
                    onClick={handleLogout}
                    className="h-8 rounded-lg bg-gray-700 px-2 sm:px-3 py-1 font-geist text-xs font-medium text-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] hover:bg-gray-600"
                    suppressHydrationWarning
                >
                    <span className="hidden sm:inline">Log out</span>
                    <span className="sm:hidden">Exit</span>
                </Button>
            </div>
        </header>
    )
}
