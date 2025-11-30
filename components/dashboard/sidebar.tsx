"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    SquareTerminal,
    Bot,
    CodeXml,
    Book,
    Settings2,
    User,
    LifeBuoy
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

const sidebarItems = [
    { icon: SquareTerminal, label: "Questionnaire", href: "/questionnaire" },
    { icon: Bot, label: "Chat", href: "/dashboard/chat" },
    { icon: CodeXml, label: "Identity Reactor", href: "/dashboard" },
    { icon: Book, label: "Docs", href: "/dashboard/docs" },
    { icon: Settings2, label: "Settings", href: "/dashboard/settings" },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <div className="flex h-screen w-14 flex-col items-center justify-between border-r border-[#222] bg-[#111111] py-2">
            {/* Logo Section */}
            <div className="flex flex-col items-center border-b border-[#222] pb-2 w-full">
                <div className="flex h-9 w-9 items-center justify-center rounded-md overflow-hidden shadow-sm">
                    <Image
                        src="/images/Soulprintengine-logo.png"
                        alt="SoulPrint"
                        width={36}
                        height={36}
                        className="object-cover"
                    />
                </div>
            </div>

            {/* Main Nav */}
            <nav className="flex flex-1 flex-col items-center gap-1 py-2">
                {sidebarItems.map((item) => {
                    // Check if this nav item is active
                    const isActive = pathname === item.href || 
                        (item.href === "/dashboard" && pathname === "/dashboard")
                    
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                                isActive 
                                    ? "bg-orange-600 text-white" 
                                    : "text-[#e5e5e5] hover:bg-white/5"
                            )}
                            title={item.label}
                        >
                            <item.icon className="h-5 w-5" />
                            <span className="sr-only">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom Nav */}
            <div className="flex flex-col items-center gap-1 py-2">
                <button className="flex h-10 w-10 items-center justify-center rounded-full text-[#e5e5e5] transition-colors hover:bg-white/5">
                    <LifeBuoy className="h-5 w-5" />
                </button>
                <button className="flex h-10 w-10 items-center justify-center rounded-full text-[#e5e5e5] transition-colors hover:bg-white/5">
                    <User className="h-5 w-5" />
                </button>
            </div>
        </div>
    )
}
