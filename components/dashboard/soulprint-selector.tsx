"use client"

import { useEffect, useState } from "react"
import { listMySoulPrints, switchSoulPrint, getSelectedSoulPrintId } from "@/app/actions/soulprint-selection"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface SoulPrintOption {
    id: string
    name: string
    archetype?: string
}

export function SoulPrintSelector() {
    const [options, setOptions] = useState<SoulPrintOption[]>([])
    const [selectedId, setSelectedId] = useState<string>("")
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        async function init() {
            setLoading(true)
            const [prints, currentId] = await Promise.all([
                listMySoulPrints(),
                getSelectedSoulPrintId()
            ])

            setOptions(prints)

            // Logic handled in backend ensures valid selection, but we sync state here
            if (currentId && prints.find(p => p.id === currentId)) {
                setSelectedId(currentId)
            } else if (prints.length > 0) {
                setSelectedId(prints[0].id)
            }

            setLoading(false)
        }
        init()
    }, [])

    const handleValueChange = async (value: string) => {
        setSelectedId(value)
        await switchSoulPrint(value)
        router.refresh() // Refresh server components to pick up new cookie
    }

    if (loading) {
        return <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
    }

    if (options.length === 0) {
        return null // Don't show if no soulprints
    }

    // If only one, show it as a static badge or single item? 
    // Allowing dropdown even for one provides consistency if they add a second.

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider hidden md:block">Active Soul:</span>
            <Select value={selectedId} onValueChange={handleValueChange}>
                <SelectTrigger className="h-8 w-[130px] sm:w-[180px] border-[#333] bg-[#222] text-[10px] sm:text-xs text-white focus:ring-orange-500/20">
                    <SelectValue placeholder="Select SoulPrint" />
                </SelectTrigger>
                <SelectContent className="border-[#333] bg-[#111] text-white">
                    {options.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id} className="focus:bg-[#222] focus:text-white">
                            <span className="flex items-center gap-2">
                                <span>{opt.name}</span>
                                {opt.archetype && opt.name.toLowerCase() !== opt.archetype.toLowerCase() && (
                                    <Badge variant="outline" className="border-orange-500/30 text-[9px] text-orange-400 py-0 h-4">
                                        {opt.archetype}
                                    </Badge>
                                )}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
