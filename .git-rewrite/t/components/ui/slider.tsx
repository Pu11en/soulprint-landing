"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Brand orange color from logo: #E8632B
const BRAND_ORANGE = "#E8632B";
const BRAND_ORANGE_RGB = "232, 99, 43";

interface SliderProps {
    value: number[];
    min?: number;
    max?: number;
    step?: number;
    onValueChange?: (value: number[]) => void;
    className?: string;
}

export function Slider({
    value,
    min = 0,
    max = 100,
    step = 1,
    onValueChange,
    className,
}: SliderProps) {
    const [isDragging, setIsDragging] = React.useState(false);

    // Calculate the center point and the fill direction/width
    const center = (max + min) / 2;
    const currentValue = value[0];
    const range = max - min;

    // Calculate fill percentage from center
    const distanceFromCenter = currentValue - center;
    const fillWidth = Math.abs(distanceFromCenter) / (range / 2) * 50;
    const isLeftOfCenter = currentValue < center;
    const intensity = Math.abs(distanceFromCenter) / (range / 2); // 0 to 1

    return (
        <SliderPrimitive.Root
            className={cn(
                "relative flex w-full touch-none select-none items-center py-8 group",
                className
            )}
            value={value}
            onValueChange={onValueChange}
            onPointerDown={() => setIsDragging(true)}
            onPointerUp={() => setIsDragging(false)}
            max={max}
            min={min}
            step={step}
        >
            {/* Outer glow layer */}
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                    background: `radial-gradient(ellipse at ${isLeftOfCenter ? 50 - fillWidth / 2 : 50 + fillWidth / 2}% 50%, rgba(${BRAND_ORANGE_RGB}, 0.15) 0%, transparent 70%)`,
                }}
            />

            <SliderPrimitive.Track className="relative h-3 w-full grow overflow-visible rounded-full bg-gradient-to-b from-gray-100 to-gray-200 shadow-inner border border-gray-200/50">
                {/* Main fill with brand orange gradient and glow */}
                <div
                    className="absolute h-full rounded-full"
                    style={{
                        left: isLeftOfCenter ? `${50 - fillWidth}%` : '50%',
                        width: `${fillWidth}%`,
                        background: `linear-gradient(90deg, 
                            ${isLeftOfCenter ? '#F07942' : BRAND_ORANGE} 0%, 
                            ${isLeftOfCenter ? BRAND_ORANGE : '#D15420'} 100%)`,
                        boxShadow: intensity > 0.1 ? `0 0 ${20 * intensity}px rgba(${BRAND_ORANGE_RGB}, ${0.5 * intensity}), inset 0 1px 0 rgba(255,255,255,0.3)` : 'none',
                    }}
                >
                    {/* Inner shine */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/30 to-transparent" style={{ height: '50%' }} />

                    {/* Animated shimmer effect */}
                    {intensity > 0.2 && (
                        <div className="absolute inset-0 rounded-full overflow-hidden">
                            <div
                                className="absolute inset-0 animate-shimmer"
                                style={{
                                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                                    transform: 'skewX(-20deg)',
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Center marker */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                    <div className="w-[2px] h-5 bg-gradient-to-b from-gray-300 via-gray-400 to-gray-300 rounded-full shadow-sm" />
                </div>
            </SliderPrimitive.Track>

            {/* Logo Thumb */}
            <SliderPrimitive.Thumb
                className={cn(
                    "relative block h-12 w-12 cursor-grab active:cursor-grabbing",
                    "focus-visible:outline-none", // Removed default focus ring
                    "disabled:pointer-events-none disabled:opacity-50",
                    "transition-transform duration-150",
                    "hover:scale-110",
                    "active:scale-105",
                    isDragging && "scale-110"
                )}
                style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                }}
            >
                {/* Pulse ring animation when dragging */}
                {isDragging && (
                    <div
                        className="absolute inset-0 rounded-full animate-ping-slow"
                        style={{ backgroundColor: `rgba(${BRAND_ORANGE_RGB}, 0.3)` }}
                    />
                )}

                {/* Logo Image as thumb */}
                <Image
                    src="/images/vector-personalized.png"
                    alt=""
                    width={48}
                    height={48}
                    className={cn(
                        "w-full h-full object-contain transition-transform",
                        isDragging ? "animate-spin-slow" : ""
                    )}
                    style={{
                        animationDuration: isDragging ? `${Math.max(0.5, 2 - intensity * 1.5)}s` : '0s',
                        animationDirection: isLeftOfCenter ? 'reverse' : 'normal',
                    }}
                    draggable={false}
                />
            </SliderPrimitive.Thumb>
        </SliderPrimitive.Root>
    );
}
