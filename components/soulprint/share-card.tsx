/**
 * SoulPrint Share Card
 * 
 * A visually appealing, shareable personality card
 * inspired by Spotify Wrapped / personality test results
 * 
 * Can be exported as image for social media sharing
 */
"use client"

import { useRef } from "react"
import { Brain, Heart, Scale, Users, Cpu, Shield, Sparkles, Download, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SoulPrintData, SoulPrintPillars } from "@/lib/soulprint/types"

interface ShareCardProps {
    soulprint: SoulPrintData
    userName?: string
    variant?: "full" | "compact" | "mini"
    showActions?: boolean
    className?: string
}

const pillarConfig = {
    communication_style: { 
        icon: Brain, 
        label: "Communication", 
        color: "from-blue-500 to-cyan-500",
        bgColor: "bg-blue-500/10"
    },
    emotional_alignment: { 
        icon: Heart, 
        label: "Emotional", 
        color: "from-pink-500 to-rose-500",
        bgColor: "bg-pink-500/10"
    },
    decision_making: { 
        icon: Scale, 
        label: "Decision Making", 
        color: "from-amber-500 to-orange-500",
        bgColor: "bg-amber-500/10"
    },
    social_cultural: { 
        icon: Users, 
        label: "Social Identity", 
        color: "from-green-500 to-emerald-500",
        bgColor: "bg-green-500/10"
    },
    cognitive_processing: { 
        icon: Cpu, 
        label: "Cognitive", 
        color: "from-purple-500 to-violet-500",
        bgColor: "bg-purple-500/10"
    },
    assertiveness_conflict: { 
        icon: Shield, 
        label: "Assertiveness", 
        color: "from-red-500 to-rose-600",
        bgColor: "bg-red-500/10"
    },
}

export function ShareCard({ 
    soulprint, 
    userName,
    variant = "full",
    showActions = true,
    className 
}: ShareCardProps) {
    const cardRef = useRef<HTMLDivElement>(null)

    const displayName = userName || soulprint.user_name || soulprint.name || "Your"

    // Extract key traits from pillars
    const getTopMarkers = (pillars: SoulPrintPillars) => {
        const markers: string[] = []
        Object.values(pillars).forEach(pillar => {
            if (pillar.markers) {
                markers.push(...pillar.markers.slice(0, 1))
            }
        })
        return markers.slice(0, 4)
    }

    const topMarkers = getTopMarkers(soulprint.pillars)

    // Download as image
    const handleDownload = async () => {
        if (!cardRef.current) return
        
        try {
            // Dynamic import to avoid SSR issues
            const html2canvas = (await import('html2canvas')).default
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: null,
                scale: 2,
            })
            
            const link = document.createElement('a')
            link.download = `soulprint-${displayName.toLowerCase().replace(/\s+/g, '-')}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        } catch (error) {
            console.error('Failed to generate image:', error)
        }
    }

    // Copy share link
    const handleShare = async () => {
        if (navigator.share) {
            await navigator.share({
                title: `${displayName}'s SoulPrint`,
                text: `Check out my AI personality profile!`,
                url: window.location.href
            })
        } else {
            await navigator.clipboard.writeText(window.location.href)
            alert('Link copied to clipboard!')
        }
    }

    if (variant === "mini") {
        return (
            <div className={cn(
                "relative w-[280px] p-4 rounded-2xl overflow-hidden",
                "bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800",
                "border border-zinc-700/50",
                className
            )}>
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-orange-500/10" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-zinc-400 uppercase tracking-wider">SoulPrint</span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-1">{soulprint.archetype}</h3>
                    <p className="text-sm text-zinc-400">{displayName}&apos;s Personality</p>
                </div>
            </div>
        )
    }

    if (variant === "compact") {
        return (
            <div 
                ref={cardRef}
                className={cn(
                    "relative w-[320px] p-5 rounded-3xl overflow-hidden",
                    "bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800",
                    "border border-zinc-700/50 shadow-2xl",
                    className
                )}
            >
                {/* Background effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-orange-500/15" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
                
                <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-xs text-zinc-500 uppercase tracking-widest">SoulPrint</span>
                        </div>
                    </div>

                    {/* Archetype */}
                    <h2 className="text-2xl font-bold text-white mb-1">
                        {soulprint.archetype}
                    </h2>
                    <p className="text-sm text-zinc-400 mb-4">
                        {displayName}&apos;s Personality Profile
                    </p>

                    {/* Identity signature */}
                    <p className="text-sm text-zinc-300 italic mb-4 line-clamp-2">
                        &ldquo;{soulprint.identity_signature}&rdquo;
                    </p>

                    {/* Top traits */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {topMarkers.map((marker, i) => (
                            <span 
                                key={i}
                                className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300"
                            >
                                {marker}
                            </span>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-zinc-700/50 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-600">soulprint.ai</span>
                        <span className="text-[10px] text-zinc-600">
                            {new Date(soulprint.generated_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    // Full variant
    return (
        <div className={cn("flex flex-col gap-4", className)}>
            <div 
                ref={cardRef}
                className={cn(
                    "relative w-full max-w-[400px] p-6 rounded-3xl overflow-hidden",
                    "bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800",
                    "border border-zinc-700/50 shadow-2xl"
                )}
            >
                {/* Background effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-orange-500/15" />
                <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />
                
                <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center shadow-lg">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <span className="text-xs text-zinc-500 uppercase tracking-widest block">SoulPrint</span>
                                <span className="text-xs text-zinc-600">v{soulprint.soulprint_version}</span>
                            </div>
                        </div>
                    </div>

                    {/* Main content */}
                    <div className="text-center mb-6">
                        <h2 className="text-3xl font-bold text-white mb-2">
                            {soulprint.archetype}
                        </h2>
                        <p className="text-zinc-400">
                            {displayName}&apos;s Personality Profile
                        </p>
                    </div>

                    {/* Identity signature */}
                    <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/5">
                        <p className="text-sm text-zinc-300 italic text-center">
                            &ldquo;{soulprint.identity_signature}&rdquo;
                        </p>
                    </div>

                    {/* Pillars grid */}
                    <div className="grid grid-cols-2 gap-2 mb-6">
                        {Object.entries(soulprint.pillars).map(([key, pillar]) => {
                            const config = pillarConfig[key as keyof typeof pillarConfig]
                            const Icon = config.icon
                            return (
                                <div 
                                    key={key}
                                    className={cn(
                                        "p-3 rounded-xl",
                                        config.bgColor,
                                        "border border-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon className="w-3.5 h-3.5 text-zinc-400" />
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                            {config.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-300 line-clamp-2">
                                        {pillar.summary?.slice(0, 60)}...
                                    </p>
                                </div>
                            )
                        })}
                    </div>

                    {/* Voice style */}
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                        <span className="px-3 py-1.5 rounded-full bg-purple-500/20 text-xs text-purple-300">
                            {soulprint.voice_vectors.cadence_speed} pace
                        </span>
                        <span className="px-3 py-1.5 rounded-full bg-orange-500/20 text-xs text-orange-300">
                            {soulprint.voice_vectors.tone_warmth}
                        </span>
                        <span className="px-3 py-1.5 rounded-full bg-blue-500/20 text-xs text-blue-300">
                            {soulprint.voice_vectors.emoji_usage} emoji
                        </span>
                    </div>

                    {/* Footer */}
                    <div className="pt-4 border-t border-zinc-700/50 flex items-center justify-between">
                        <span className="text-xs text-zinc-600">soulprint.ai</span>
                        <span className="text-xs text-zinc-600">
                            Generated {new Date(soulprint.generated_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            {showActions && (
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-zinc-300 transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Download
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-orange-500 text-sm text-white font-medium transition-all hover:opacity-90"
                    >
                        <Share2 className="w-4 h-4" />
                        Share
                    </button>
                </div>
            )}
        </div>
    )
}

/**
 * Minimal card for embedding in other places
 */
export function ShareCardBadge({ archetype, userName }: { archetype: string, userName?: string }) {
    return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-orange-500/20 border border-purple-500/30">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-zinc-300">
                {userName ? `${userName}: ` : ""}{archetype}
            </span>
        </div>
    )
}
