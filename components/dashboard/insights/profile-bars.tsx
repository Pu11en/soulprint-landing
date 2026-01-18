"use client"

import { motion } from "framer-motion"

interface MetricBar {
    label: string
    value: number
    color: "orange" | "violet" | "blue" | "sky"
}

interface ProfileBarsProps {
    title: string
    subtitle?: string
    metrics: MetricBar[]
    delay?: number
}

const colorClasses = {
    orange: {
        fill: "bg-orange-500",
        track: "bg-orange-500/20"
    },
    violet: {
        fill: "bg-violet-600",
        track: "bg-violet-600/20"
    },
    blue: {
        fill: "bg-[#126DFE]",
        track: "bg-[#126DFE]/20"
    },
    sky: {
        fill: "bg-sky-500",
        track: "bg-sky-500/20"
    }
}

export function ProfileBars({ title, subtitle, metrics, delay = 0 }: ProfileBarsProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: delay + 0.3 }}
            className="p-6 bg-white dark:bg-[#111] rounded-[10px] border border-gray-200 dark:border-[#222] shadow-sm"
        >
            <div className="mb-4">
                <h4 className="text-sm text-gray-500 dark:text-gray-400">{title}</h4>
                {subtitle && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
                )}
            </div>

            <div className="space-y-4">
                {metrics.map((metric, index) => (
                    <div key={metric.label} className="flex items-center gap-3">
                        {/* Label */}
                        <span className="w-20 text-xs text-stone-600 dark:text-stone-400 shrink-0">
                            {metric.label}
                        </span>

                        {/* Progress bar */}
                        <div className={`flex-1 h-2 rounded-full ${colorClasses[metric.color].track}`}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${metric.value}%` }}
                                transition={{
                                    duration: 1,
                                    delay: delay + 0.4 + index * 0.1,
                                    ease: [0.23, 1, 0.32, 1]
                                }}
                                className={`h-full rounded-full ${colorClasses[metric.color].fill}`}
                            />
                        </div>

                        {/* Value */}
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: delay + 0.8 + index * 0.1 }}
                            className="w-8 text-xs text-stone-600 dark:text-stone-400 text-right"
                        >
                            {metric.value}
                        </motion.span>
                    </div>
                ))}
            </div>
        </motion.div>
    )
}
