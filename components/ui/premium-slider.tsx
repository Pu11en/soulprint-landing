"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { motion, useMotionValue } from "framer-motion";

// Brand orange color from logo: #E8632B
const BRAND_ORANGE = "#E8632B";

interface PremiumSliderProps {
    value: number[];
    min?: number;
    max?: number;
    step?: number;
    onValueChange?: (value: number[]) => void;
    className?: string;
    leftLabel?: string;
    rightLabel?: string;
}

export function PremiumSlider({
    value,
    min = 0,
    max = 100,
    step = 1,
    onValueChange,
    className,
    leftLabel,
    rightLabel,
}: PremiumSliderProps) {
    const [isDragging, setIsDragging] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = React.useState(0);

    // Update width on mount and resize
    React.useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            setWidth(entries[0].contentRect.width);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Derived values
    const progress = (value[0] - min) / (max - min);

    // Motion values for smoother programmatic animations
    const x = useMotionValue(0);

    React.useEffect(() => {
        // Sync x with value when width is available
        if (width > 0) {
            x.set(progress * width);
        }
    }, [progress, width, x]);

    // Calculate left/right influence for label animations
    const leftInfluence = Math.max(0, 1 - progress * 2); // 1 at 0%, 0 at 50%
    const rightInfluence = Math.max(0, (progress - 0.5) * 2); // 0 at 50%, 1 at 100%

    // Neutral zone calculations (center)
    const deviation = Math.abs(progress - 0.5);
    const isNeutral = deviation < 0.1;
    const intensity = Math.min(1, deviation * 2.5); // 0 to 1 based on how far from center

    return (
        <div className={cn("relative w-full py-12 select-none touch-none", className)}>
            {/* Global SVG Filters for Liquid Effect */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <filter id="goo">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            {/* Labels container - absolutely positioned relative to slider area but outside track */}
            <div className="absolute top-0 w-full flex justify-between pointer-events-none -mt-8 px-1">
                <motion.span
                    animate={{
                        opacity: 0.4 + leftInfluence * 0.6,
                        scale: 1 + leftInfluence * 0.1,
                        color: leftInfluence > 0.5 ? BRAND_ORANGE : "#666"
                    }}
                    className="text-sm font-medium transition-colors duration-300"
                >
                    {leftLabel}
                </motion.span>
                <motion.span
                    animate={{
                        opacity: 0.4 + rightInfluence * 0.6,
                        scale: 1 + rightInfluence * 0.1,
                        color: rightInfluence > 0.5 ? BRAND_ORANGE : "#666"
                    }}
                    className="text-sm font-medium transition-colors duration-300"
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
                <div ref={containerRef} className="relative w-full h-4">

                    {/* Background Track - Glassmorphism */}
                    <div className="absolute inset-0 rounded-full bg-black/5 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-white/20 h-full overflow-hidden">
                        {/* Subtle center marker */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-black/10 z-0" />
                    </div>

                    {/* Liquid Fill Element - This uses the SVG filter */}
                    <div className="absolute inset-y-0 left-0 w-full pointer-events-none" style={{ filter: 'url(#goo)' }}>
                        {/* The fill itself - starts from center, extends left or right */}
                        <motion.div
                            className="absolute top-0 bottom-0 bg-[#E8632B]"
                            style={{
                                left: progress < 0.5 ? `${progress * 100}%` : '50%',
                                width: `${Math.abs(progress - 0.5) * 100}%`,
                                opacity: isNeutral ? 0.3 : 0.8
                            }}
                        />

                        {/* Connection blob that merges thumb and track */}
                        <motion.div
                            className="absolute top-1/2 -translate-y-1/2 rounded-full bg-[#E8632B]"
                            style={{
                                left: `${progress * 100}%`,
                                x: -25, // Offset to center on tip
                                width: 50,
                                height: 50,
                            }}
                        />
                    </div>

                    {/* Actual Radix Track (invisible functional layer) */}
                    <SliderPrimitive.Track className="relative h-full w-full rounded-full bg-transparent overflow-visible">
                        <SliderPrimitive.Range className="absolute h-full bg-transparent" />
                    </SliderPrimitive.Track>
                </div>

                {/* The Thumb - Visual Layer */}
                <SliderPrimitive.Thumb
                    className="block w-12 h-12 outline-none cursor-grab active:cursor-grabbing z-20"
                    asChild
                >
                    <motion.div
                        animate={{
                            scale: isDragging ? 1.1 : 1,
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                        {/* Thumb Visuals */}
                        <div className="relative w-full h-full flex items-center justify-center">

                            {/* Outer Glow Ring / Halo - Reacts to intensity/distance from center */}
                            <motion.div
                                className="absolute inset-0 rounded-full bg-[#E8632B]/30 blur-md"
                                animate={{
                                    scale: 1 + intensity * 0.5,
                                    opacity: 0.5 + intensity * 0.5
                                }}
                            />

                            {/* Main Glass Sphere Thumb */}
                            <div className="relative w-10 h-10 rounded-full bg-white shadow-[0_8px_16px_rgba(232,99,43,0.3)] flex items-center justify-center backdrop-blur-sm border border-white/60">
                                {/* Inner Core - shifts based on state */}
                                <motion.div
                                    className="w-3 h-3 rounded-full bg-[#E8632B]"
                                    animate={{
                                        scale: isNeutral ? 0.8 : 1.2,
                                        backgroundColor: isNeutral ? "#9CA3AF" : "#E8632B" // Gray if neutral
                                    }}
                                />

                                {/* Specular Highlight for Glass effect */}
                                <div className="absolute top-1 left-2 w-3 h-2 rounded-[50%] bg-white/80 blur-[1px]" />
                            </div>
                        </div>
                    </motion.div>
                </SliderPrimitive.Thumb>
            </SliderPrimitive.Root>

            {/* Feedback Text below thumb - centered dynamically */}
            <div className="absolute top-full mt-4 left-0 w-full pointer-events-none">
                <motion.div
                    className="flex flex-col items-center"
                    style={{
                        x: width > 0 ? (progress * width) - (width / 2) : 0, // Center relative to container, then shift by half width to align with thumb
                        // Note: simpler approach is just left: progress * 100% in a relative container
                    }}
                >
                    <div className="relative -left-1/2 transform translate-x-1/2 w-32 text-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#E8632B]">
                            {isNeutral ? "Neutral" : `${Math.round(intensity * 100)}% Intensity`}
                        </span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
