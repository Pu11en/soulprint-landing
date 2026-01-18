"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface TabNavProps {
    activeTab: string
    onTabChange: (tab: string) => void
}

const tabs = [
    { id: "overview", label: "Overview" },
    { id: "analytics", label: "Analytics" },
    { id: "reports", label: "Reports" },
    { id: "notifications", label: "Notifications" },
]

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
    return (
        <div className="inline-flex p-1 bg-gray-100 dark:bg-[#1a1a1a] rounded-[10px]">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                        "relative px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                        activeTab === tab.id
                            ? "text-gray-900 dark:text-white"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    )}
                >
                    {activeTab === tab.id && (
                        <motion.div
                            layoutId="activeTab"
                            className="absolute inset-0 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-sm"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                </button>
            ))}
        </div>
    )
}
