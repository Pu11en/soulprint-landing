"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { BarChart2, Grid3X3, Activity, TrendingUp, Loader2 } from "lucide-react"
import type { SoulPrintData } from "@/lib/soulprint/types"

import { StatCard } from "@/components/dashboard/insights/stat-card"
import { TabNav } from "@/components/dashboard/insights/tab-nav"
import { BarChart, defaultChartData } from "@/components/dashboard/insights/bar-chart"
import { ProfileBars } from "@/components/dashboard/insights/profile-bars"

// Helper to derive numeric scores from markers/summary
function deriveScore(text: string, markers: string[] = []): number {
    // Create a consistent score based on content length and marker count
    const baseScore = 50
    const textBonus = Math.min(text.length / 10, 25)
    const markerBonus = Math.min(markers.length * 5, 25)
    return Math.round(baseScore + textBonus + markerBonus)
}

// Extract metrics from pillar data
function extractCommunicationMetrics(pillar: { summary: string; markers?: string[] }) {
    const markers = pillar.markers || []
    return [
        { label: "Direct", value: markers.some(m => m.toLowerCase().includes("direct")) ? 78 : deriveScore(pillar.summary, markers) - 10, color: "orange" as const },
        { label: "Diplomatic", value: markers.some(m => m.toLowerCase().includes("diplomatic")) ? 61 : deriveScore(pillar.summary, markers) - 20, color: "violet" as const },
        { label: "Precision", value: markers.some(m => m.toLowerCase().includes("precis")) ? 89 : deriveScore(pillar.summary, markers) + 5, color: "blue" as const },
        { label: "Expression", value: deriveScore(pillar.summary, markers) - 5, color: "sky" as const },
    ]
}

function extractEmotionalMetrics(pillar: { summary: string; markers?: string[] }) {
    const markers = pillar.markers || []
    const base = deriveScore(pillar.summary, markers)
    return [
        { label: "Composure", value: Math.min(base + 10, 100), color: "orange" as const },
        { label: "Tone Clarity", value: Math.min(base - 5, 100), color: "orange" as const },
        { label: "Empathy", value: Math.min(base + 15, 100), color: "orange" as const },
        { label: "Resilience", value: Math.min(base, 100), color: "orange" as const },
    ]
}

export default function InsightsPage() {
    const [activeTab, setActiveTab] = useState("overview")
    const [soulprint, setSoulprint] = useState<SoulPrintData | null>(null)
    const [loading, setLoading] = useState(true)
    const [chatCount, setChatCount] = useState(0)

    const supabase = createClient()

    useEffect(() => {
        async function loadData() {
            try {
                // Get current user
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setLoading(false)
                    return
                }

                // Get user's first soulprint
                const { data: soulprints } = await supabase
                    .from('soulprints')
                    .select('soulprint_data')
                    .eq('user_id', user.id)
                    .limit(1)

                if (soulprints && soulprints.length > 0) {
                    setSoulprint(soulprints[0].soulprint_data as SoulPrintData)
                }

                // Get chat count for interactions
                const { count } = await supabase
                    .from('chat_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)

                setChatCount(count || 0)
            } catch (error) {
                console.error("Failed to load insights data:", error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [supabase])

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        )
    }

    // Derive metrics from soulprint
    const stability = soulprint ? deriveScore(soulprint.pillars?.cognitive_processing?.summary || "", soulprint.pillars?.cognitive_processing?.markers) : 92
    const consistency = soulprint ? deriveScore(soulprint.pillars?.communication_style?.summary || "", soulprint.pillars?.communication_style?.markers) : 76
    const reliability = soulprint ? deriveScore(soulprint.pillars?.decision_making?.summary || "", soulprint.pillars?.decision_making?.markers) : 96

    const communicationMetrics = soulprint?.pillars?.communication_style
        ? extractCommunicationMetrics(soulprint.pillars.communication_style)
        : [
            { label: "Direct", value: 78, color: "orange" as const },
            { label: "Diplomatic", value: 61, color: "violet" as const },
            { label: "Precision", value: 89, color: "blue" as const },
            { label: "Expression", value: 72, color: "sky" as const },
        ]

    const emotionalMetrics = soulprint?.pillars?.emotional_alignment
        ? extractEmotionalMetrics(soulprint.pillars.emotional_alignment)
        : [
            { label: "Composure", value: 78, color: "orange" as const },
            { label: "Tone Clarity", value: 61, color: "orange" as const },
            { label: "Empathy", value: 89, color: "orange" as const },
            { label: "Resilience", value: 72, color: "orange" as const },
        ]

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-[1110px] mx-auto pb-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-6"
                >
                    <h1 className="text-[32px] font-koulen text-gray-900 dark:text-white">
                        Adaptive Intelligence
                    </h1>
                </motion.div>

                {/* Tabs */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="mb-6"
                >
                    <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
                </motion.div>

                <AnimatePresence mode="wait">
                    {activeTab === "overview" ? (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* Stat Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <StatCard
                                    title="Stability"
                                    value={stability}
                                    delta="+20.1% from last month"
                                    icon={BarChart2}
                                    color="orange"
                                    index={0}
                                />
                                <StatCard
                                    title="Consistency"
                                    value={consistency}
                                    delta="+180.1% from last month"
                                    icon={Grid3X3}
                                    color="blue"
                                    index={1}
                                />
                                <StatCard
                                    title="Reliability Score"
                                    value={reliability}
                                    delta="+19% from last month"
                                    icon={TrendingUp}
                                    color="default"
                                    index={2}
                                />
                                <StatCard
                                    title="Active Interactions"
                                    value={chatCount > 0 ? chatCount : 21}
                                    delta={`+${Math.max(chatCount, 201)} since last hour`}
                                    icon={Activity}
                                    color="blue"
                                    index={3}
                                />
                            </div>

                            {/* Charts Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Bar Chart */}
                                <BarChart data={defaultChartData} highlightLast />

                                {/* Profile Bars */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.25 }}
                                    className="p-6 bg-white dark:bg-[#111] rounded-[14px] border border-gray-200 dark:border-[#222] shadow-sm space-y-4"
                                >
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                            Profile Analysis
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            {soulprint?.archetype ? `Based on your ${soulprint.archetype} profile` : "Your personality breakdown"}
                                        </p>
                                    </div>

                                    <ProfileBars
                                        title="Communication Profile"
                                        metrics={communicationMetrics}
                                        delay={0}
                                    />

                                    <ProfileBars
                                        title="Emotional Regulation Index"
                                        metrics={emotionalMetrics}
                                        delay={0.2}
                                    />
                                </motion.div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="coming-soon"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center h-[400px] text-center"
                        >
                            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                                <Activity className="w-8 h-8 text-orange-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Coming Soon
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-md">
                                We&apos;re working on bringing you powerful {activeTab} features.
                                Stay tuned for updates!
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    className="mt-8 text-center"
                >
                    <p className="text-xs text-gray-500 dark:text-gray-600">
                        © 2026 ARCHEFORGE | SOULPRINT ENGINE
                    </p>
                </motion.div>
            </div>
        </div>
    )
}
