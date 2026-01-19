"use client"

import { useState, useCallback } from "react"
import { Sidebar, MobileSidebar } from "@/components/dashboard/sidebar"
import { TopBar } from "@/components/dashboard/top-bar"

interface DashboardShellProps {
    children: React.ReactNode
    hasSoulprint: boolean
}

export function DashboardShell({ children, hasSoulprint }: DashboardShellProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const handleMenuClick = useCallback(() => {
        setIsMobileMenuOpen(true)
    }, [])

    const handleMenuClose = useCallback(() => {
        setIsMobileMenuOpen(false)
    }, [])

    return (
        <div className="flex min-h-screen bg-[#0B0B0B] text-white">
            {/* Desktop Sidebar */}
            <Sidebar hasSoulprint={hasSoulprint} />

            {/* Mobile Sidebar Drawer */}
            <MobileSidebar
                hasSoulprint={hasSoulprint}
                isOpen={isMobileMenuOpen}
                onClose={handleMenuClose}
            />

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopBar onMenuClick={handleMenuClick} />
                <main className="flex-1 overflow-hidden bg-[#0B0B0B] px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
                    <div className="mx-auto h-full w-full max-w-[1500px]">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
