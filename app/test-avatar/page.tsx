"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { AvatarGenerator } from "@/components/avatar/AvatarGenerator"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import Image from "next/image"

export default function TestAvatarPage() {
    const supabase = createClient()
    const [soulprints, setSoulprints] = useState<Array<{ id: string; name: string; archetype: string }>>([])
    const [selectedSoulprint, setSelectedSoulprint] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [avatarComplete, setAvatarComplete] = useState(false)
    const [savedUrl, setSavedUrl] = useState<string | null>(null)

    const loadSoulprints = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setLoading(false)
            return
        }

        const { data } = await supabase
            .from('soulprints')
            .select('id, soulprint_data')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (data) {
            setSoulprints(data.map(s => ({
                id: s.id,
                name: s.soulprint_data?.archetype || 'Unnamed',
                archetype: s.soulprint_data?.archetype || 'Unknown'
            })))
            // Auto-select the first one (likely Maverick)
            if (data.length > 0) {
                setSelectedSoulprint(data[0].id)
            }
        }
        setLoading(false)
    }, [supabase])

    useEffect(() => {
        loadSoulprints()
    }, [loadSoulprints])

    const handleAvatarComplete = (url: string) => {
        setAvatarComplete(true)
        setSavedUrl(url)
    }

    const handleReset = () => {
        setAvatarComplete(false)
        setSavedUrl(null)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">🎨 Avatar Generator Test</h1>
                    <p className="text-gray-500 mb-6">Test the AI avatar generation for your soulprints</p>

                    {/* Soulprint Selector */}
                    {soulprints.length > 0 && !avatarComplete && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select SoulPrint:
                            </label>
                            <select
                                value={selectedSoulprint || ''}
                                onChange={(e) => setSelectedSoulprint(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                            >
                                {soulprints.map(sp => (
                                    <option key={sp.id} value={sp.id}>
                                        {sp.name} - {sp.archetype}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Avatar Generator */}
                    {selectedSoulprint && !avatarComplete && (
                        <AvatarGenerator
                            soulprintId={selectedSoulprint}
                            onComplete={handleAvatarComplete}
                        />
                    )}

                    {/* Success State */}
                    {avatarComplete && savedUrl && (
                        <div className="text-center space-y-4">
                            <div className="relative w-48 h-48 mx-auto rounded-xl overflow-hidden shadow-lg">
                                <Image
                                    src={savedUrl}
                                    alt="Saved Avatar"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                            <h3 className="text-xl font-semibold text-green-600">✓ Avatar Saved!</h3>
                            <p className="text-sm text-gray-500 break-all">{savedUrl}</p>
                            <Button
                                onClick={handleReset}
                                className="bg-[#EA580C] hover:bg-orange-700 text-white"
                            >
                                Generate Another
                            </Button>
                        </div>
                    )}

                    {soulprints.length === 0 && (
                        <p className="text-center text-gray-500">No soulprints found. Complete the questionnaire first.</p>
                    )}
                </div>

                {/* Debug Info */}
                <div className="mt-8 bg-gray-800 rounded-lg p-4 text-green-400 font-mono text-sm">
                    <p className="text-gray-400 mb-2"># Debug Info</p>
                    <p>Soulprints loaded: {soulprints.length}</p>
                    <p>Selected: {selectedSoulprint || 'None'}</p>
                    {soulprints.map(sp => (
                        <p key={sp.id} className="ml-2">- {sp.archetype}</p>
                    ))}
                </div>
            </div>
        </div>
    )
}
