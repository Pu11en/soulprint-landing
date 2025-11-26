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

const sidebarItems = [
    { icon: SquareTerminal, label: "Questionnaire", href: "/questionnaire" },
    { icon: Bot, label: "Dashboard", href: "/dashboard" },
    { icon: CodeXml, label: "Code", href: "/dashboard/code" },
    { icon: Book, label: "Docs", href: "/dashboard/docs" },
    { icon: Settings2, label: "Settings", href: "/dashboard/settings" },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <div className="flex h-screen w-16 flex-col items-center justify-between border-r border-[#333] bg-[#0A0A0A] py-4">
            <div className="flex flex-col items-center gap-6">
                {/* Logo Placeholder */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-white">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 2V22" stroke="currentColor" strokeWidth="2" />
                        <path d="M2 12H22" stroke="currentColor" strokeWidth="2" />
                    </svg>
                </div>

                <nav className="flex flex-col gap-4">
                    {sidebarItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-white/10",
                                    isActive ? "bg-orange-600 text-white" : "text-gray-400"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                <span className="sr-only">{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>
            </div>

            <div className="flex flex-col items-center gap-4">
                <button className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10">
                    <LifeBuoy className="h-5 w-5" />
                </button>
                <button className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10">
                    <User className="h-5 w-5" />
                </button>
            </div>
        </div>
    )
}
