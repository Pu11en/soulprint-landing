"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Download, RefreshCw, Loader2, Brain, Heart, Scale, Users, Cpu, Shield, Plus, Trash2, ArrowLeft, Pencil, Check, X } from "lucide-react"
import { listMySoulPrints, switchSoulPrint } from "@/app/actions/soulprint-selection"
import { deleteSoulPrint, updateSoulPrintName } from "@/app/actions/soulprint-management"
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

export default function ProfilePage() {
    const router = useRouter()
    const supabase = createClient()

    const [view, setView] = useState<'list' | 'detail'>('list')
    const [soulprints, setSoulprints] = useState<any[]>([])
    const [selectedSoulprint, setSelectedSoulprint] = useState<SoulPrintData | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    // Inline editing state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState("")

    // Load list on mount
    useEffect(() => {
        loadList()
    }, [])

    async function loadList() {
        setLoading(true)
        try {
            const list = await listMySoulPrints()
            if (!list || list.length === 0) {
                router.push('/dashboard/welcome')
                return
            }
            setSoulprints(list)
        } catch (error) {
            console.error("Failed to load soulprints", error)
        } finally {
            setLoading(false)
        }
    }

    async function handleViewDetail(id: string) {
        setLoading(true)
        // Fetch full detail
        const { data } = await supabase
            .from('soulprints')
            .select('soulprint_data')
            .eq('id', id)
            .single()

        if (data?.soulprint_data) {
            setSelectedSoulprint(data.soulprint_data as SoulPrintData)
            setView('detail')
        }
        setLoading(false)
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure? This cannot be undone.")) return

        setActionLoading(true)
        await deleteSoulPrint(id)
        await loadList() // Reload list
        setActionLoading(false)
    }

    async function handleSwitchAndEdit(id: string) {
        // Switch context first? Not strictly needed for viewing, but maybe nice.
        // For now just view.
        handleViewDetail(id)
    }

    // Inline name editing handlers
    function startEditing(sp: any) {
        setEditingId(sp.id)
        setEditingName(sp.name || "")
    }

    async function saveNameEdit() {
        if (!editingId || !editingName.trim()) {
            setEditingId(null)
            return
        }

        setActionLoading(true)
        const result = await updateSoulPrintName(editingId, editingName)
        if (result.success) {
            // Update local state
            setSoulprints(prev => prev.map(sp =>
                sp.id === editingId ? { ...sp, name: editingName.trim() } : sp
            ))
        }
        setEditingId(null)
        setActionLoading(false)
    }

    function cancelEditing() {
        setEditingId(null)
        setEditingName("")
    }

    const handleExport = () => {
        if (!selectedSoulprint) return
        const blob = new Blob([JSON.stringify(selectedSoulprint, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `soulprint-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    // Render Loading
    if (loading && soulprints.length === 0) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        )
    }

    // Render List View
    if (view === 'list') {
        const canCreate = soulprints.length < 2

        return (
            <div className="max-w-4xl space-y-8 pb-12">
                <div>
                    <h1 className="text-2xl font-bold text-white">My SoulPrints</h1>
                    <p className="text-gray-400">Manage your AI companions. Click the name to personalize it.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {soulprints.map(sp => (
                        <div key={sp.id} className="group relative overflow-hidden rounded-xl border border-[#333] bg-[#111] p-6 transition-all hover:border-orange-500/50 hover:bg-[#161616]">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1 flex-1">
                                    {editingId === sp.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveNameEdit()
                                                    if (e.key === 'Escape') cancelEditing()
                                                }}
                                                autoFocus
                                                className="text-xl font-bold text-white bg-transparent border-b border-orange-500 outline-none max-w-[200px]"
                                                placeholder="Name your companion..."
                                            />
                                            <button onClick={saveNameEdit} className="text-green-500 hover:text-green-400">
                                                <Check className="h-4 w-4" />
                                            </button>
                                            <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-400">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group/name">
                                            <h3
                                                className="text-xl font-bold text-white cursor-pointer hover:text-orange-400 transition-colors"
                                                onClick={() => startEditing(sp)}
                                            >
                                                {sp.name || "Name me..."}
                                            </h3>
                                            <Pencil
                                                className="h-3 w-3 text-gray-600 opacity-0 group-hover/name:opacity-100 transition-opacity cursor-pointer hover:text-orange-500"
                                                onClick={() => startEditing(sp)}
                                            />
                                        </div>
                                    )}
                                    <p className="text-sm text-gray-500 font-mono uppercase">{sp.archetype}</p>
                                </div>
                                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-orange-900/20 text-orange-500 font-bold">
                                    {(sp.name || sp.archetype || 'S')[0].toUpperCase()}
                                </div>
                            </div>

                            <div className="mt-8 flex items-center gap-3">
                                <Button onClick={() => handleViewDetail(sp.id)} className="flex-1 bg-white text-black hover:bg-gray-200">
                                    View Details
                                </Button>
                                <Button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(sp.id) }}
                                    disabled={actionLoading}
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                                >
                                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    ))}

                    {/* Create New Card */}
                    {canCreate ? (
                        <button
                            onClick={() => router.push('/questionnaire/new')}
                            className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[#333] bg-transparent p-6 text-gray-500 transition-all hover:border-orange-500/50 hover:bg-orange-500/5 hover:text-orange-500"
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#111] shadow-sm">
                                <Plus className="h-6 w-6" />
                            </div>
                            <span className="font-medium">Create New SoulPrint</span>
                        </button>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#222] bg-[#111]/50 p-6 text-gray-600 opacity-70 cursor-not-allowed">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#111]">
                                <Scale className="h-6 w-6" />
                            </div>
                            <span className="font-medium">Limit Reached (2/2)</span>
                            <span className="text-xs">Delete one to create another.</span>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Render Detail View (Original UI)
    if (!selectedSoulprint) return null

    return (
        <div className="max-w-4xl space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setView('list')} className="text-gray-400 hover:text-white">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">SoulPrint Details</h1>
                        <p className="text-gray-400">Deep dive into this personality.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleExport} variant="outline" className="border-[#333] text-white hover:bg-[#222]">
                        <Download className="mr-2 h-4 w-4" />
                        Export JSON
                    </Button>
                </div>
            </div>

            {/* Identity Card */}
            <div className="rounded-xl border border-[#222] bg-[#111] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-700">
                        <span className="text-2xl font-bold text-white">
                            {selectedSoulprint.archetype?.[0] || 'S'}
                        </span>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 uppercase tracking-wider">Archetype</div>
                        <div className="text-2xl font-bold text-white">{selectedSoulprint.archetype || 'Unique Individual'}</div>
                    </div>
                </div>

                {selectedSoulprint.identity_signature && (
                    <div className="rounded-lg bg-[#0A0A0A] p-4 border border-[#222]">
                        <div className="text-sm text-gray-500 mb-2">Identity Signature</div>
                        <p className="text-gray-300">{selectedSoulprint.identity_signature}</p>
                    </div>
                )}
            </div>

            {/* Pillars */}
            <div className="grid gap-4">
                <h2 className="text-lg font-semibold text-white">Personality Pillars</h2>
                {selectedSoulprint.pillars && Object.entries(selectedSoulprint.pillars).map(([key, pillar]: [string, SoulPrintPillar]) => (
                    <div key={key} className="rounded-xl border border-[#222] bg-[#111] p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#222] text-orange-500">
                                {pillarIcons[key] || <Brain className="w-5 h-5" />}
                            </div>
                            <h3 className="text-lg font-semibold text-white">{pillarLabels[key] || key}</h3>
                        </div>
                        <p className="text-gray-400 mb-4">{pillar.summary}</p>

                        {pillar.markers && pillar.markers.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {pillar.markers.slice(0, 5).map((marker: string, i: number) => (
                                    <span key={i} className="rounded-full bg-[#222] px-3 py-1 text-xs text-gray-300">
                                        {marker}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Flinch Warnings */}
            {selectedSoulprint.flinch_warnings && selectedSoulprint.flinch_warnings.length > 0 && (
                <div className="rounded-xl border border-red-900/30 bg-red-900/10 p-6">
                    <h2 className="text-lg font-semibold text-red-400 mb-4">Communication Triggers</h2>
                    <p className="text-sm text-gray-400 mb-4">Things that may cause friction or discomfort:</p>
                    <ul className="space-y-2">
                        {selectedSoulprint.flinch_warnings.map((warning: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-gray-300">
                                <span className="text-red-500 mt-1">•</span>
                                {warning}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
