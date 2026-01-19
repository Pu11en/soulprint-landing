"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    SquareTerminal,
    Home,
    Key,
    Settings2,
    User,
    HelpCircle,
    Fingerprint,
    BarChart3,
    GitCompareArrows,
    LucideIcon,
    X
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarItem {
    icon: LucideIcon
    label: string
    href: string
}

const sidebarItems: SidebarItem[] = [
    { icon: Home, label: "Home", href: "/dashboard/chat" },
    { icon: SquareTerminal, label: "Questionnaire", href: "/questionnaire" },
    { icon: Fingerprint, label: "My SoulPrint", href: "/dashboard/profile" },
    { icon: BarChart3, label: "Insights", href: "/dashboard/insights" },
    { icon: GitCompareArrows, label: "Compare", href: "/dashboard/compare" },
    { icon: Key, label: "API Keys", href: "/dashboard/bot" },
    { icon: Settings2, label: "Settings", href: "/dashboard/settings" },
]

interface SidebarProps {
    hasSoulprint: boolean
}

interface MobileSidebarProps {
    hasSoulprint: boolean
    isOpen: boolean
    onClose: () => void
}

// Desktop Sidebar - hidden on mobile
export function Sidebar({ hasSoulprint }: SidebarProps) {
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const visibleItems = hasSoulprint
        ? sidebarItems
        : sidebarItems.filter(item => item.label === "Questionnaire" || item.label === "Home")

    return (
        <div className="hidden lg:flex h-screen w-14 flex-col items-center justify-between border-r border-[#222] bg-[#111111] py-2">
            {/* Logo Section */}
            <div className="flex h-[52px] w-full items-center justify-center border-b border-[#222]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/images/vector-personalized.png"
                    alt="SoulPrint"
                    className="h-8 w-8 object-contain"
                />
            </div>

            {/* Main Nav */}
            <nav className="flex flex-1 flex-col items-center gap-1 py-2">
                {visibleItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href ||
                        (item.href === "/dashboard/chat" && pathname === "/dashboard") ||
                        (item.label === "Home" && pathname.startsWith("/dashboard/chat")) ||
                        (item.label === "Questionnaire" && pathname.startsWith("/questionnaire"))

                    return (
                        <Link
                            key={item.label}
                            href={item.label === "Questionnaire" ? "/questionnaire/new" : item.href}
                            className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                                isActive
                                    ? "bg-[#E8632B] text-white"
                                    : "text-[#e5e5e5] hover:bg-white/5"
                            )}
                            title={item.label}
                        >
                            {mounted ? <Icon className="h-5 w-5" /> : <div className="h-5 w-5" />}
                            <span className="sr-only">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom Nav */}
            <div className="flex flex-col items-center gap-1 py-2">
                <a
                    href="mailto:support@soulprint.ai?subject=SoulPrint%20Support%20Request"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[#e5e5e5] transition-colors hover:bg-white/5"
                    title="Get Help"
                >
                    {mounted ? <HelpCircle className="h-5 w-5" /> : <div className="h-5 w-5" />}
                </a>
                <Link
                    href="/dashboard/settings"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[#e5e5e5] transition-colors hover:bg-white/5"
                    title="Settings & Account"
                >
                    {mounted ? <User className="h-5 w-5" /> : <div className="h-5 w-5" />}
                </Link>
            </div>
        </div>
    )
}

// Mobile Sidebar Drawer
export function MobileSidebar({ hasSoulprint, isOpen, onClose }: MobileSidebarProps) {
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Close sidebar on route change
    useEffect(() => {
        onClose()
    }, [pathname, onClose])

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    const visibleItems = hasSoulprint
        ? sidebarItems
        : sidebarItems.filter(item => item.label === "Questionnaire" || item.label === "Home")

    if (!isOpen) return null

    return (
        <div className="lg:hidden fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="absolute left-0 top-0 h-full w-64 bg-[#111111] border-r border-[#222] animate-in slide-in-from-left duration-200">
                {/* Header */}
                <div className="flex h-[52px] items-center justify-between px-4 border-b border-[#222]">
                    <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/images/vector-personalized.png"
                            alt="SoulPrint"
                            className="h-8 w-8 object-contain"
                        />
                        <span className="font-koulen text-lg text-white">SOULPRINT</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-md text-[#e5e5e5] hover:bg-white/5 transition-colors"
                    >
                        <X className="h-5 w-5" />
                        <span className="sr-only">Close menu</span>
                    </button>
                </div>

                {/* Nav Items - larger touch targets on mobile */}
                <nav className="flex flex-col gap-1 p-3">
                    {visibleItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href ||
                            (item.href === "/dashboard/chat" && pathname === "/dashboard") ||
                            (item.label === "Home" && pathname.startsWith("/dashboard/chat")) ||
                            (item.label === "Questionnaire" && pathname.startsWith("/questionnaire"))

                        return (
                            <Link
                                key={item.label}
                                href={item.label === "Questionnaire" ? "/questionnaire/new" : item.href}
                                className={cn(
                                    "flex h-12 items-center gap-3 rounded-lg px-3 transition-colors",
                                    isActive
                                        ? "bg-[#E8632B] text-white"
                                        : "text-[#e5e5e5] hover:bg-white/5"
                                )}
                            >
                                {mounted ? <Icon className="h-5 w-5" /> : <div className="h-5 w-5" />}
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                {/* Bottom Section */}
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[#222]">
                    <a
                        href="mailto:support@soulprint.ai?subject=SoulPrint%20Support%20Request"
                        className="flex h-12 items-center gap-3 rounded-lg px-3 text-[#e5e5e5] hover:bg-white/5 transition-colors"
                    >
                        {mounted ? <HelpCircle className="h-5 w-5" /> : <div className="h-5 w-5" />}
                        <span className="font-medium">Get Help</span>
                    </a>
                    <Link
                        href="/dashboard/settings"
                        className="flex h-12 items-center gap-3 rounded-lg px-3 text-[#e5e5e5] hover:bg-white/5 transition-colors"
                    >
                        {mounted ? <User className="h-5 w-5" /> : <div className="h-5 w-5" />}
                        <span className="font-medium">Settings & Account</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
