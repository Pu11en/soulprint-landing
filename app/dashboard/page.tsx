import { LLMSelector } from "@/components/dashboard/llm-selector"
import { SoulPrintVisualizer } from "@/components/dashboard/soulprint-visualizer"

export default function DashboardPage() {
    return (
        <div className="mx-auto max-w-6xl space-y-12">
            <div className="flex items-center justify-between font-mono text-sm text-gray-400">
                <div>SOULPRINT ENGINE / LLM SENDOFF</div>
                <div>[ SOULPRINT USERNAME ]</div>
            </div>

            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                <LLMSelector />
                <SoulPrintVisualizer />
            </div>
        </div>
    )
}
