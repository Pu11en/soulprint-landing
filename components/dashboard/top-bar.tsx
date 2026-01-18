"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { SoulPrintSelector } from "@/components/dashboard/soulprint-selector"

export function TopBar() {
    const supabase = createClient()
    const router = useRouter()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        localStorage.removeItem("soulprint_internal_key")
        localStorage.removeItem("soulprint_answers")
        localStorage.removeItem("soulprint_current_q")
        router.push('/')
    }

    return (
        <header className="flex h-[52px] items-center justify-between border-b border-[#111111] bg-[#111111] px-4">
            {/* Left side - SoulPrint Engine branding */}
            <div className="flex items-center gap-2">

                <span className="font-koulen text-[22px] leading-[26px] text-white tracking-wide">
                    SOULPRINT
                </span>
                <span className="font-cinzel font-normal text-[20px] leading-[26px] tracking-[1px] uppercase text-white -ml-1">
                    ENGINE
                </span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
                <SoulPrintSelector />
                <Button
                    onClick={handleLogout}
                    className="h-8 rounded-lg bg-gray-700 px-3 py-1 font-geist text-xs font-medium text-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] hover:bg-gray-600"
                    suppressHydrationWarning
                >
                    Log out
                </Button>
            </div>
        </header>
    )
}
