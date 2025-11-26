"use client"

import { Button } from "@/components/ui/button"

export function TopBar() {
    return (
        <header className="flex h-16 items-center justify-end gap-4 border-b border-[#333] bg-[#0A0A0A] px-6">
            <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600/20 text-xs font-medium text-orange-500">
                    DD
                </div>
                <div className="hidden text-sm text-gray-400 md:block">
                    demo@soulprint.ai
                </div>
            </div>
            <div className="h-4 w-px bg-[#333]" />
            <Button
                variant="ghost"
                className="text-gray-400 hover:text-white"
            >
                Log out
            </Button>
        </header>
    )
}
