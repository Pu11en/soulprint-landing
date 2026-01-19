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
        <div className="flex h-screen bg-[#A1A1AA] text-white">
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
                <main className="flex-1 overflow-hidden bg-[#A1A1AA] p-2 sm:p-4">
                    {children}
                </main>
            </div>
        </div>
    )
}
