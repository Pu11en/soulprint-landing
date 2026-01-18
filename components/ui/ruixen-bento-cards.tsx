"use client"

import React from "react"
import { cn } from "@/lib/utils"

const cardContents = [
    {
        title: "Built on Our Own Engine",
        description: "No rented models. No third-party APIs. We built our own foundational model from the ground up — optimized for presence, persistence, and personalization.",
        className: "lg:col-span-2",
    },
    {
        title: "Identity-Locked Memory",
        description: "We don’t store 'chat history.' We build continuity of self. Your tone, preferences, and patterns woven into the way your AI thinks.",
        className: "lg:col-span-1",
    },
    {
        title: "Private by Design",
        description: "Your data stays local. Backups are optional and encrypted. No silent sync. No behavioral surveillance.",
        className: "lg:col-span-1",
    },
    {
        title: "Behavioral Engine",
        description: "This isn’t prompt engineering. This is cognitive imprinting — a system that learns your rhythm and emotional resonance.",
        className: "lg:col-span-1",
    },
    {
        title: "Fully Offline-Ready",
        description: "We own the model, so we can deploy it anywhere. Local servers, air-gapped networks. Your intelligence goes where you go.",
        className: "lg:col-span-1",
    },
    {
        title: "Built for Continuity",
        description: "Most AIs start from scratch. We don't. SoulPrint anchors context across weeks, projects, and decisions.",
        className: "lg:col-span-2",
    },
]


const PlusCard: React.FC<{
    className?: string
    title: string
    description: string
}> = ({
    className = "",
    title,
    description,
}) => {
        return (
            <div
                className={cn(
                    "relative border border-dashed border-zinc-700 rounded-lg p-6 bg-black min-h-[200px] group transition-all duration-300 hover:border-orange-500/50 hover:shadow-[0_0_20px_-10px_rgba(249,115,22,0.3)]",
                    "flex flex-col justify-between",
                    className
                )}
            >
                <CornerPlusIcons />
                {/* Content */}
                <div className="relative z-10 space-y-2">
                    <h3 className="text-xl font-bold text-gray-100 group-hover:text-orange-500 transition-colors duration-300">
                        {title}
                    </h3>
                    <p className="text-gray-400">{description}</p>
                </div>
            </div>
        )
    }

const CornerPlusIcons = () => (
    <>
        <PlusIcon className="absolute -top-3 -left-3" />
        <PlusIcon className="absolute -top-3 -right-3" />
        <PlusIcon className="absolute -bottom-3 -left-3" />
        <PlusIcon className="absolute -bottom-3 -right-3" />
    </>
)

const PlusIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        width={24}
        height={24}
        strokeWidth="1"
        stroke="currentColor"
        className={cn("text-orange-600 size-6", className)}
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
)

export default function RuixenBentoCards() {
    return (
        <section id="features" className="bg-black border-t border-gray-800">
            <div className="mx-auto container border-x border-gray-800 py-12 px-4">
                {/* Section Header */}
                <div className="max-w-3xl mx-auto text-center px-4 mb-12 lg:mb-20">
                    <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">
                        Core Features
                    </h2>
                    <p className="text-gray-400 text-lg">
                        Not a wrapper. A full-stack intelligence architecture designed for emotional cadence and persistent memory.
                    </p>
                </div>

                {/* Responsive Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-auto gap-8">
                    {cardContents.map((card, index) => (
                        <PlusCard key={index} {...card} />
                    ))}
                </div>


            </div>
        </section>
    )
}
