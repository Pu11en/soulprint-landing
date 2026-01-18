"use client"

import { motion } from "framer-motion"
import { useState } from "react"

interface BarChartProps {
    data: { month: string; value: number }[]
    highlightLast?: boolean
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function BarChart({ data, highlightLast = true }: BarChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const maxValue = Math.max(...data.map(d => d.value), 1)
    const yAxisLabels = [600, 450, 300, 150, 0]

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-6 bg-white dark:bg-[#111] rounded-[14px] border border-gray-200 dark:border-[#222] shadow-sm"
        >
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">
                Interactions Overview
            </h3>

            <div className="relative h-[320px]">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-right pr-2">
                    {yAxisLabels.map((label) => (
                        <span key={label} className="text-xs text-gray-500">
                            {label}
                        </span>
                    ))}
                </div>

                {/* Chart area */}
                <div className="ml-10 h-full flex items-end gap-1.5 pb-8">
                    {data.map((item, index) => {
                        const height = (item.value / 600) * 100
                        const isLast = index === data.length - 1
                        const isHovered = hoveredIndex === index

                        return (
                            <div
                                key={item.month}
                                className="flex-1 flex flex-col items-center gap-3 h-full justify-end"
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                {/* Tooltip */}
                                {isHovered && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="absolute -top-2 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg z-10"
                                        style={{ left: `${(index / data.length) * 100}%` }}
                                    >
                                        {item.value}
                                    </motion.div>
                                )}

                                {/* Bar */}
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${height}%` }}
                                    transition={{
                                        duration: 0.8,
                                        delay: index * 0.05,
                                        ease: [0.23, 1, 0.32, 1]
                                    }}
                                    className={`w-full rounded-t-[5px] cursor-pointer transition-opacity ${
                                        highlightLast && isLast
                                            ? "bg-[#126DFE]"
                                            : "bg-gray-800 dark:bg-[#171717]"
                                    } ${isHovered ? "opacity-80" : ""}`}
                                    style={{ minHeight: item.value > 0 ? 4 : 0 }}
                                />

                                {/* X-axis label */}
                                <span className="text-xs text-gray-500 absolute bottom-0">
                                    {item.month}
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* Grid lines */}
                <div className="absolute left-10 right-0 top-0 bottom-8 pointer-events-none">
                    {yAxisLabels.map((_, index) => (
                        <div
                            key={index}
                            className="absolute left-0 right-0 border-t border-gray-100 dark:border-[#222]"
                            style={{ top: `${(index / (yAxisLabels.length - 1)) * 100}%` }}
                        />
                    ))}
                </div>
            </div>
        </motion.div>
    )
}

// Default data for demo
export const defaultChartData = months.map((month, i) => ({
    month,
    value: [240, 530, 305, 400, 240, 330, 240, 530, 305, 400, 240, 330][i] || 200
}))
