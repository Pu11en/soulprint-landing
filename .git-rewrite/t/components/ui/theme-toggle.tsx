"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
    className?: string
    iconOnly?: boolean
}

export function ThemeToggle({ className, iconOnly = true }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <button
                className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-[#e5e5e5] transition-colors hover:bg-white/5",
                    className
                )}
            >
                <Sun className="h-5 w-5" />
            </button>
        )
    }

    const isDark = theme === "dark"

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cn(
                "flex items-center justify-center rounded-full transition-colors",
                iconOnly
                    ? "h-10 w-10 text-[#e5e5e5] hover:bg-white/5"
                    : "h-10 gap-2 px-4 text-sm",
                className
            )}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
            {isDark ? (
                <Sun className="h-5 w-5" />
            ) : (
                <Moon className="h-5 w-5" />
            )}
            {!iconOnly && (
                <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            )}
        </button>
    )
}
