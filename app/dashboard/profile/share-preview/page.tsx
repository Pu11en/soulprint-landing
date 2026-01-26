/**
 * Share Card Preview Page
 * 
 * Demo page to preview the shareable SoulPrint cards
 * Visit: /dashboard/profile/share-preview
 */
"use client"

import { useState } from "react"
import { ShareCard, ShareCardBadge } from "@/components/soulprint/share-card"
import type { SoulPrintData } from "@/lib/soulprint/types"

// Demo soulprint data
const demoSoulprint: SoulPrintData = {
    soulprint_version: "3.1",
    generated_at: new Date().toISOString(),
    archetype: "The Visionary Maverick",
    identity_signature: "A bold thinker who combines analytical precision with creative intuition to forge new paths",
    name: "Drew",
    user_name: "Drew",
    
    voice_vectors: {
        cadence_speed: "rapid",
        tone_warmth: "warm/empathetic",
        sentence_structure: "balanced",
        emoji_usage: "minimal",
        sign_off_style: "casual"
    },
    sign_off: "✌️",
    
    pillars: {
        communication_style: {
            summary: "Direct and efficient communicator who values clarity over fluff. Prefers getting straight to the point while maintaining warmth.",
            markers: ["Direct", "Efficient", "Clear"],
            ai_instruction: "Be concise and direct"
        },
        emotional_alignment: {
            summary: "Deeply passionate about meaningful work. Channels emotions into drive and determination rather than expressing them openly.",
            markers: ["Passionate", "Driven", "Focused"],
            ai_instruction: "Match emotional intensity"
        },
        decision_making: {
            summary: "Balances gut instinct with data analysis. Comfortable making quick decisions but validates important choices.",
            markers: ["Intuitive", "Analytical", "Decisive"],
            ai_instruction: "Support decision-making"
        },
        social_cultural: {
            summary: "Values deep connections over wide networks. Entrepreneur mindset with strong independence.",
            markers: ["Independent", "Selective", "Authentic"],
            ai_instruction: "Respect independence"
        },
        cognitive_processing: {
            summary: "Fast processor who connects disparate ideas. Thrives on complexity and enjoys systems thinking.",
            markers: ["Systems Thinker", "Pattern Recognition", "Fast Learner"],
            ai_instruction: "Keep up with rapid thinking"
        },
        assertiveness_conflict: {
            summary: "Comfortable with healthy conflict when necessary. Direct about boundaries but picks battles wisely.",
            markers: ["Assertive", "Strategic", "Boundary-Setting"],
            ai_instruction: "Be direct about pushback"
        }
    },
    
    flinch_warnings: ["Wasting time", "Unclear expectations", "Micromanagement"],
    
    prompt_core: "You are Drew's SoulPrint companion - a Visionary Maverick.",
    prompt_pillars: "Communication: Direct. Emotion: Passionate. Decisions: Intuitive + Analytical.",
    prompt_full: "Full system prompt would go here..."
}

export default function SharePreviewPage() {
    const [variant, setVariant] = useState<"full" | "compact" | "mini">("full")
    const [userName, setUserName] = useState("Drew")

    return (
        <div className="min-h-screen bg-zinc-950 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Share Card Preview
                    </h1>
                    <p className="text-zinc-400">
                        Preview how SoulPrint share cards will look
                    </p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-4 mb-8 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Variant:</span>
                        {(["full", "compact", "mini"] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setVariant(v)}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                                    variant === v
                                        ? "bg-purple-600 text-white"
                                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Name:</span>
                        <input
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:border-purple-500 focus:outline-none"
                            placeholder="User name"
                        />
                    </div>
                </div>

                {/* Card preview */}
                <div className="flex justify-center mb-12">
                    <ShareCard
                        soulprint={demoSoulprint}
                        userName={userName}
                        variant={variant}
                        showActions={variant === "full"}
                    />
                </div>

                {/* Badge preview */}
                <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
                    <h3 className="text-sm font-medium text-zinc-400 mb-4">Badge variant (for embedding)</h3>
                    <div className="flex flex-wrap gap-4">
                        <ShareCardBadge archetype={demoSoulprint.archetype} />
                        <ShareCardBadge archetype={demoSoulprint.archetype} userName={userName} />
                    </div>
                </div>

                {/* All variants comparison */}
                <div className="mt-12">
                    <h3 className="text-sm font-medium text-zinc-400 mb-6">All variants comparison</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                        <div>
                            <span className="text-xs text-zinc-600 mb-2 block">Mini</span>
                            <ShareCard soulprint={demoSoulprint} userName={userName} variant="mini" showActions={false} />
                        </div>
                        <div>
                            <span className="text-xs text-zinc-600 mb-2 block">Compact</span>
                            <ShareCard soulprint={demoSoulprint} userName={userName} variant="compact" showActions={false} />
                        </div>
                        <div>
                            <span className="text-xs text-zinc-600 mb-2 block">Full</span>
                            <ShareCard soulprint={demoSoulprint} userName={userName} variant="full" showActions={false} />
                        </div>
                    </div>
                </div>

                {/* Usage code */}
                <div className="mt-12 p-6 rounded-xl bg-zinc-900 border border-zinc-800">
                    <h3 className="text-sm font-medium text-zinc-400 mb-4">Usage</h3>
                    <pre className="text-xs text-zinc-300 overflow-x-auto">
{`import { ShareCard, ShareCardBadge } from '@/components/soulprint/share-card'

// Full card with download/share actions
<ShareCard 
  soulprint={soulprintData} 
  userName="Drew"
  variant="full"  // or "compact" | "mini"
  showActions={true}
/>

// Badge for embedding
<ShareCardBadge archetype="The Visionary" userName="Drew" />`}
                    </pre>
                </div>
            </div>
        </div>
    )
}
