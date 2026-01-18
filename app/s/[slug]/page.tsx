import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Brain, Heart, Scale, Users, Cpu, Shield } from "lucide-react"
import type { SoulPrintData, SoulPrintPillar } from "@/lib/soulprint/types"

const pillarIcons: Record<string, React.ReactNode> = {
    communication_style: <Brain className="w-5 h-5" />,
    emotional_alignment: <Heart className="w-5 h-5" />,
    decision_making: <Scale className="w-5 h-5" />,
    social_cultural: <Users className="w-5 h-5" />,
    cognitive_processing: <Cpu className="w-5 h-5" />,
    assertiveness_conflict: <Shield className="w-5 h-5" />,
}

const pillarLabels: Record<string, string> = {
    communication_style: "Communication Style",
    emotional_alignment: "Emotional Alignment",
    decision_making: "Decision Making",
    social_cultural: "Social & Cultural",
    cognitive_processing: "Cognitive Processing",
    assertiveness_conflict: "Assertiveness & Conflict",
}

interface PageProps {
    params: Promise<{ slug: string }>
}

export default async function PublicProfilePage({ params }: PageProps) {
    const { slug } = await params
    const supabase = await createClient()

    // Fetch public soulprint by slug or ID
    const { data: soulprint } = await supabase
        .from("soulprints")
        .select("soulprint_data, is_public, share_slug")
        .or(`share_slug.eq.${slug},id.eq.${slug}`)
        .eq("is_public", true)
        .single()

    if (!soulprint) {
        notFound()
    }

    const data = soulprint.soulprint_data as SoulPrintData

    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white">
            {/* Header */}
            <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <a href="/" className="flex items-center gap-2">
                        <span className="font-koulen text-2xl text-white">SOULPRINT</span>
                        <span className="font-inter italic font-thin text-xl text-white">Studio</span>
                    </a>
                    <a
                        href="/enter"
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Create Yours
                    </a>
                </div>
            </header>

            {/* Profile Content */}
            <main className="max-w-4xl mx-auto px-4 py-12">
                {/* Identity Card */}
                <div className="text-center mb-12">
                    <div className="flex justify-center mb-6">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-700 shadow-lg shadow-orange-500/20">
                            <span className="text-4xl font-bold text-white">
                                {data.archetype?.[0] || 'S'}
                            </span>
                        </div>
                    </div>
                    <div className="text-sm text-orange-500 uppercase tracking-wider mb-2">
                        Archetype
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4">
                        {data.archetype || 'Unique Individual'}
                    </h1>
                    {data.identity_signature && (
                        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                            {data.identity_signature}
                        </p>
                    )}
                </div>

                {/* Pillars Preview - Limited view to prevent cloning */}
                <div className="grid gap-4 mb-12">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <span className="w-8 h-0.5 bg-orange-500"></span>
                        Personality Dimensions
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {data.pillars && Object.entries(data.pillars).slice(0, 6).map(([key]: [string, SoulPrintPillar]) => (
                            <div
                                key={key}
                                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center"
                            >
                                <div className="flex justify-center mb-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-orange-500">
                                        {pillarIcons[key] || <Brain className="w-6 h-6" />}
                                    </div>
                                </div>
                                <h3 className="text-sm font-medium text-white">
                                    {pillarLabels[key] || key}
                                </h3>
                            </div>
                        ))}
                    </div>
                    <p className="text-center text-gray-500 text-sm mt-4">
                        Full personality insights are private. Create your own SoulPrint to unlock yours.
                    </p>
                </div>

                {/* CTA */}
                <div className="text-center py-12 border-t border-zinc-800">
                    <h3 className="text-2xl font-bold text-white mb-4">
                        Discover Your SoulPrint
                    </h3>
                    <p className="text-gray-400 mb-6 max-w-md mx-auto">
                        Take a 5-minute questionnaire to uncover your unique personality archetype and communication style.
                    </p>
                    <a
                        href="/enter"
                        className="inline-flex px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
                    >
                        Get Started Free
                    </a>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-zinc-800 py-8">
                <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
                    Powered by SoulPrint Engine
                </div>
            </footer>
        </div>
    )
}
