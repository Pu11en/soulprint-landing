"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// Brand orange color from logo: #E8632B
const BRAND_ORANGE = "#E8632B";

interface LiquidGlassSliderProps {
    value: number[];
    min?: number;
    max?: number;
    step?: number;
    onValueChange?: (value: number[]) => void;
    className?: string;
    leftLabel?: string;
    rightLabel?: string;
}

export function LiquidGlassSlider({
    value,
    min = 0,
    max = 100,
    step = 1,
    onValueChange,
    className,
    leftLabel,
    rightLabel,
}: LiquidGlassSliderProps) {
    const [isDragging, setIsDragging] = React.useState(false);

    // Derived values
    const progress = (value[0] - min) / (max - min);

    // Calculate left/right influence for label animations
    const leftInfluence = Math.max(0, 1 - progress * 2); // 1 at 0%, 0 at 50%
    const rightInfluence = Math.max(0, (progress - 0.5) * 2); // 0 at 50%, 1 at 100%

    // Neutral zone calculations (center)
    const deviation = Math.abs(progress - 0.5);
    const isNeutral = deviation < 0.1;
    const intensity = Math.min(1, deviation * 2.5); // 0 to 1 based on how far from center

    return (
        <div className={cn("relative w-full py-14 select-none touch-none", className)}>
            {/* Labels container */}
            <div className="absolute top-0 w-full flex justify-between pointer-events-none px-1">
                <motion.span
                    animate={{
                        opacity: 0.4 + leftInfluence * 0.6,
                        scale: 1 + leftInfluence * 0.1,
                        color: leftInfluence > 0.5 ? BRAND_ORANGE : "#9CA3AF"
                    }}
                    className="text-[11px] tracking-[0.2em] font-semibold uppercase transition-colors duration-300"
                >
                    {leftLabel}
                </motion.span>
                <motion.span
                    animate={{
                        opacity: 0.4 + rightInfluence * 0.6,
                        scale: 1 + rightInfluence * 0.1,
                        color: rightInfluence > 0.5 ? BRAND_ORANGE : "#9CA3AF"
                    }}
                    className="text-[11px] tracking-[0.2em] font-semibold uppercase transition-colors duration-300"
                >
                    {rightLabel}
                </motion.span>
            </div>

            <SliderPrimitive.Root
                className="relative flex w-full items-center"
                value={value}
                onValueChange={onValueChange}
                max={max}
                min={min}
                step={step}
                onPointerDown={() => setIsDragging(true)}
                onPointerUp={() => setIsDragging(false)}
            >
                <div className="relative w-full h-4">
                    {/* Light track */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white via-[#F7F7F7] to-white border border-[#E8E8E8] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]" />
                    <div className="absolute inset-0 rounded-full bg-[radial-gradient(70%_70%_at_50%_50%,rgba(255,255,255,0.95),transparent)] opacity-80" />

                    {/* Center marker */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-[#D8D8D8] -translate-x-1/2" />

                    {/* Active fill - liquid glow from center */}
                    <motion.div
                        className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full"
                        style={{
                            left: progress < 0.5 ? `${progress * 100}%` : "50%",
                            width: `${Math.abs(progress - 0.5) * 100}%`,
                            background: `linear-gradient(90deg, #FF8A4C 0%, ${BRAND_ORANGE} 60%, #C94813 100%)`,
                            boxShadow: isNeutral
                                ? "none"
                                : `0 0 10px ${BRAND_ORANGE}66, 0 0 22px ${BRAND_ORANGE}44`,
                        }}
                        animate={{
                            opacity: isNeutral ? 0.35 : 0.95,
                        }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    />

                    {/* Functional Radix track */}
                    <SliderPrimitive.Track className="relative h-full w-full rounded-full bg-transparent overflow-visible">
                        <SliderPrimitive.Range className="absolute h-full bg-transparent" />
                    </SliderPrimitive.Track>
                </div>

                {/* Sleek tech thumb */}
                <SliderPrimitive.Thumb
                    className="block outline-none cursor-grab active:cursor-grabbing z-20"
                    asChild
                >
                    <motion.div
                        animate={{ scale: isDragging ? 1.08 : 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 26 }}
                        className="relative h-12 w-12"
                    >
                        {/* Outer glow */}
                        <motion.div
                            className="absolute -inset-2 rounded-full"
                            style={{
                                background: `radial-gradient(circle, ${BRAND_ORANGE}66 0%, transparent 72%)`
                            }}
                            animate={{
                                opacity: isNeutral ? 0.25 : 0.8,
                                scale: isDragging ? 1.05 : 1,
                            }}
                        />

                        {/* Glass shell */}
                        <div className="absolute inset-0 rounded-full bg-white/85 backdrop-blur-md border border-white/80 shadow-[0_10px_24px_rgba(0,0,0,0.16)]" />

                        {/* Inner ring */}
                        <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-white/95 to-[#EFEFEF] border border-white/80" />

                        {/* Core indicator */}
                        <motion.div
                            className="absolute inset-[14px] rounded-full"
                            animate={{
                                scale: isNeutral ? 0.8 : 1,
                                backgroundColor: isNeutral ? "#9CA3AF" : BRAND_ORANGE,
                                boxShadow: isNeutral ? "none" : `0 0 12px ${BRAND_ORANGE}99`
                            }}
                            transition={{ type: "spring", stiffness: 320, damping: 24 }}
                        />

                        {/* Specular highlight */}
                        <div className="absolute top-2 left-3 h-2 w-4 rounded-full bg-white/90 blur-[1px]" />
                    </motion.div>
                </SliderPrimitive.Thumb>
            </SliderPrimitive.Root>

            {/* Feedback Text below thumb */}
            <div className="absolute top-full mt-3 left-0 w-full pointer-events-none">
                <motion.div
                    className="flex flex-col items-center"
                    style={{
                        marginLeft: `${progress * 100}%`,
                        transform: 'translateX(-50%)'
                    }}
                >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A3A3A3]">
                        {isNeutral ? "Neutral" : `${Math.round(intensity * 100)}% Intensity`}
                    </span>
                </motion.div>
            </div>
        </div>
    );
}
