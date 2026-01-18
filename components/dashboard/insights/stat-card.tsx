"use client"

import { motion, useSpring, useTransform } from "framer-motion"
import { useEffect, useState } from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
    title: string
    value: number
    delta: string
    icon: LucideIcon
    color?: "orange" | "blue" | "default"
    index?: number
}

function AnimatedNumber({ value }: { value: number }) {
    const spring = useSpring(0, { stiffness: 50, damping: 15 })
    const display = useTransform(spring, (current) => Math.round(current))
    const [displayValue, setDisplayValue] = useState(0)

    useEffect(() => {
        spring.set(value)
    }, [spring, value])

    useEffect(() => {
        return display.on("change", (latest) => {
            setDisplayValue(latest)
        })
    }, [display])

    return <>{displayValue}</>
}

export function StatCard({ title, value, delta, icon: Icon, color = "default", index = 0 }: StatCardProps) {
    const colorClasses = {
        orange: "text-orange-500",
        blue: "text-[#126DFE]",
        default: "text-foreground"
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: [0.23, 1, 0.32, 1]
            }}
            whileHover={{
                scale: 1.02,
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12)"
            }}
            className="group flex-1 p-6 bg-white dark:bg-[#111] rounded-[14px] border border-gray-200 dark:border-[#222] shadow-sm hover:border-orange-500/30 dark:hover:border-orange-500/50 transition-colors"
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
                <Icon className="w-4 h-4 text-gray-400" />
            </div>

            <div className="space-y-1">
                <div className={cn("text-2xl font-bold", colorClasses[color])}>
                    {value >= 0 ? <AnimatedNumber value={value} /> : `+${Math.abs(value)}`}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{delta}</p>
            </div>
        </motion.div>
    )
}
