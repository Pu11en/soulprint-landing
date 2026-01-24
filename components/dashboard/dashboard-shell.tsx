"use client"

import { useState, useCallback, useEffect } from "react"
import { Sidebar, MobileSidebar } from "@/components/dashboard/sidebar"
import { TopBar } from "@/components/dashboard/top-bar"
import { OnboardingTour } from "@/components/onboarding-tour"
import { InstallPromptBanner } from "@/components/install-prompt-banner"

interface DashboardShellProps {
    children: React.ReactNode
    hasSoulprint: boolean
}

export function DashboardShell({ children, hasSoulprint }: DashboardShellProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [showTour, setShowTour] = useState(false)

    useEffect(() => {
        // Check if we should show the onboarding tour
        const tourCompleted = localStorage.getItem("soulprint-tour-completed")
        const isFirstLogin = localStorage.getItem("soulprint-first-login")

        if (isFirstLogin === "true" && tourCompleted !== "true") {
            // Small delay to let the UI render first
            const timer = setTimeout(() => setShowTour(true), 500)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleMenuClick = useCallback(() => {
        setIsMobileMenuOpen(true)
    }, [])

    const handleMenuClose = useCallback(() => {
        setIsMobileMenuOpen(false)
    }, [])

    const handleTourComplete = useCallback(() => {
        setShowTour(false)
    }, [])

    return (
        <div className="flex min-h-dvh bg-[#0B0B0B] text-white">
            {/* Onboarding Tour */}
            {showTour && (
                <OnboardingTour onComplete={handleTourComplete} />
            )}

            {/* Install Prompt */}
            <InstallPromptBanner />

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
                <main className="flex-1 overflow-hidden bg-[#0B0B0B] px-2 sm:px-3 lg:px-4">
                    <div className="mx-auto h-full w-full max-w-none">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
