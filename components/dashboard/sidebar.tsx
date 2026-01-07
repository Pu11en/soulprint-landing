"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    SquareTerminal,
    Bot,
    Key,
    Settings2,
    User,
    LifeBuoy,
    Fingerprint
} from "lucide-react"
import { cn } from "@/lib/utils"

const sidebarItems = [
    { icon: SquareTerminal, label: "Questionnaire", href: "/questionnaire" },
    { icon: Bot, label: "Chat", href: "/dashboard/chat" },
    { icon: Fingerprint, label: "My SoulPrint", href: "/dashboard/profile" },
    { icon: Key, label: "API Keys", href: "/dashboard/bot" },
    { icon: Settings2, label: "Settings", href: "/dashboard/settings" },
]

interface SidebarProps {
    hasSoulprint: boolean
}

export function Sidebar({ hasSoulprint }: SidebarProps) {
    const pathname = usePathname()

    return (
        <div className="flex h-screen w-14 flex-col items-center justify-between border-r border-[#222] bg-[#111111] py-2">
            {/* Empty top section for alignment */}
            {/* Logo Section */}
            <div className="flex h-[52px] w-full items-center justify-center border-b border-[#222]">
                <img
                    src="/images/vector-personalized.png"
                    alt="SoulPrint"
                    className="h-8 w-8 object-contain"
                />
            </div>

            {/* Main Nav */}
            <nav className="flex flex-1 flex-col items-center gap-1 py-2">
                {sidebarItems.map((item) => {
                    // Filter out items if user has no soulprint
                    if (!hasSoulprint && item.label !== "Questionnaire") {
                        return null
                    }

                    // Check if this nav item is active
                    const isActive = pathname === item.href ||
                        (item.href === "/dashboard" && pathname === "/dashboard") ||
                        (item.label === "Questionnaire" && pathname.startsWith("/questionnaire"))

                    return (
                        <Link
                            key={item.label}
                            href={item.label === "Questionnaire" ? "/questionnaire/new" : item.href}
                            className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                                isActive
                                    ? "bg-orange-600 text-white"
                                    : "text-[#e5e5e5] hover:bg-white/5"
                            )}
                            title={item.label}
                            suppressHydrationWarning
                        >
                            <item.icon className="h-5 w-5" />
                            <span className="sr-only">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom Nav */}
            <div className="flex flex-col items-center gap-1 py-2">
                <button
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[#e5e5e5] transition-colors hover:bg-white/5"
                    suppressHydrationWarning
                >
                    <LifeBuoy className="h-5 w-5" />
                </button>
                <button
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[#e5e5e5] transition-colors hover:bg-white/5"
                    suppressHydrationWarning
                >
                    <User className="h-5 w-5" />
                </button>
            </div>
        </div>
    )
}
