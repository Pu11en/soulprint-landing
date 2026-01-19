"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import { updateSoulPrintName } from "@/app/actions/soulprint-management"
import { switchSoulPrint } from "@/app/actions/soulprint-selection"
import { AvatarGenerator } from "@/components/avatar/AvatarGenerator"

export default function QuestionnaireCompletePage() {
    const router = useRouter()
    const supabase = createClient()
    const hasStarted = useRef(false)

    const [status, setStatus] = useState("Generating your SoulPrint...")
    const [isGenerating, setIsGenerating] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Naming Modal State
    const [showNameModal, setShowNameModal] = useState(false)
    const [showAvatarGenerator, setShowAvatarGenerator] = useState(false)
    const [soulprintId, setSoulprintId] = useState<string | null>(null)
    const [soulprintName, setSoulprintName] = useState("")
    const [isSavingName, setIsSavingName] = useState(false)

    useEffect(() => {
        if (!hasStarted.current) {
            hasStarted.current = true
            generateSoulPrint()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const generateSoulPrint = async () => {
        try {
            // Get user
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/')
                return
            }

            // Get saved answers
            const savedAnswers = localStorage.getItem("soulprint_answers")
            if (!savedAnswers) {
                setError("No answers found. Please complete the questionnaire.")
                setIsGenerating(false)
                return
            }

            const answers = JSON.parse(savedAnswers)
            setStatus("Processing your responses...")

            // Layer 2 Safety: Final check before API call
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();

            if (!profile) {
                console.log('🛡️ Layer 2: Final self-healing for profile on completion page');
                await supabase.from('profiles').insert({
                    id: user.id,
                    email: user.email!,
                    full_name: user.user_metadata?.full_name || '',
                    avatar_url: user.user_metadata?.avatar_url || ''
                });
            }

            // Call the API to generate SoulPrint
            const response = await fetch('/api/soulprint/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ answers }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to generate SoulPrint')
            }

            setStatus("Finalizing your SoulPrint...")

            // Clear local storage
            localStorage.removeItem("soulprint_answers")
            localStorage.removeItem("soulprint_current_index")

            // Capture ID and Open Modal
            if (result.soulprint_id) {
                setSoulprintId(result.soulprint_id)
                setStatus("SoulPrint Created!")
                setIsGenerating(false)
                setShowNameModal(true) // Trigger Modal
            } else {
                // Fallback if no ID returned (shouldn't happen)
                router.push('/dashboard/chat')
            }

        } catch (err) {
            console.error('Error generating SoulPrint:', err)
            setError(err instanceof Error ? err.message : "Failed to generate SoulPrint")
            setIsGenerating(false)
        }
    }

    const handleSaveName = async () => {
        if (!soulprintId || !soulprintName.trim()) return

        setIsSavingName(true)
        try {
            // 1. Update Name
            await updateSoulPrintName(soulprintId, soulprintName)

            // 2. Auto-Switch Context
            await switchSoulPrint(soulprintId)

            // 3. Show Avatar Generator instead of redirect
            setShowNameModal(false)
            setShowAvatarGenerator(true)
            setIsSavingName(false)
        } catch (e) {
            console.error("Failed to save name:", e)
            // Even if name fails, show avatar generator
            setShowNameModal(false)
            setShowAvatarGenerator(true)
            setIsSavingName(false)
        }
    }

    const handleSkipName = async () => {
        if (soulprintId) {
            await switchSoulPrint(soulprintId)
        }
        // Show avatar generator instead of redirect
        setShowNameModal(false)
        setShowAvatarGenerator(true)
    }

    const handleAvatarComplete = () => {
        router.push('/dashboard/chat')
    }

    const handleSkipAvatar = () => {
        router.push('/dashboard/chat')
    }

    const handleRetry = () => {
        setError(null)
        setIsGenerating(true)
        generateSoulPrint()
    }

    return (
        <div className="flex h-screen bg-[#d4d4d8]">
            {/* Sidebar */}
            <div className="flex h-full w-14 flex-col items-center justify-between border-r border-[#111] bg-[#111] py-2">
                <div className="h-[52px] w-full" />
                <div className="flex flex-1 flex-col items-center gap-1 py-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-600">
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>
                <div className="py-2" />
            </div>

            {/* Main Content */}
            <div className="flex flex-1 flex-col">
                {/* Top Bar */}
                <header className="flex h-[52px] items-center justify-between border-b border-[#111] bg-[#111] px-4">
                    <div className="flex items-center gap-2">
                        {/* Logo moved to sidebar, text left aligned */}
                        <span className="font-koulen text-[22px] leading-[26px] text-white tracking-wide pl-2">
                            SOULPRINT
                        </span>
                        <span className="font-cinzel font-normal text-[20px] leading-[26px] tracking-[1px] uppercase text-white -ml-1">
                            ENGINE
                        </span>
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex flex-1 items-center justify-center p-4">
                    <div className="flex flex-col items-center justify-center rounded-xl bg-[#FAFAFA] p-12 shadow-[0px_4px_4px_2px_rgba(0,0,0,0.25)] max-w-lg w-full relative">

                        {/* Logo */}
                        <div className="mb-8">
                            <Image
                                src="/images/Soulprintengine-logo.png"
                                alt="SoulPrint Logo"
                                width={120}
                                height={120}
                                className="object-contain"
                            />
                        </div>

                        {showNameModal ? (
                            <div className="w-full animate-in fade-in zoom-in duration-300">
                                <h2 className="font-koulen text-3xl text-black mb-2 text-center">
                                    SoulPrint Created!
                                </h2>
                                <p className="font-inter text-gray-500 text-center mb-6">
                                    Give your new AI companion a name.
                                </p>

                                <div className="space-y-4">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="e.g. Atlas, Maya, Jarvis..."
                                        value={soulprintName}
                                        onChange={(e) => setSoulprintName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-medium text-black placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />

                                    <Button
                                        onClick={handleSaveName}
                                        disabled={!soulprintName.trim() || isSavingName}
                                        className="w-full h-12 rounded-lg bg-[#EA580C] text-lg font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                                    >
                                        {isSavingName ? <Loader2 className="animate-spin" /> : "Continue"}
                                    </Button>

                                    <button
                                        onClick={handleSkipName}
                                        className="w-full text-sm text-gray-400 hover:text-gray-600 underline"
                                    >
                                        Skip for now
                                    </button>
                                </div>
                            </div>
                        ) : showAvatarGenerator && soulprintId ? (
                            <div className="w-full animate-in fade-in zoom-in duration-300">
                                <AvatarGenerator
                                    soulprintId={soulprintId}
                                    onComplete={handleAvatarComplete}
                                    onSkip={handleSkipAvatar}
                                />
                            </div>
                        ) : isGenerating ? (
                            <>
                                <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-6" />
                                <h2 className="font-koulen text-2xl text-black mb-2">
                                    {status}
                                </h2>
                                <p className="font-inter text-sm text-gray-500 text-center">
                                    This may take a moment as we analyze your responses.
                                </p>
                            </>
                        ) : error ? (
                            <>
                                <h2 className="font-koulen text-2xl text-red-600 mb-4 text-center">
                                    {error}
                                </h2>
                                <Button
                                    onClick={handleRetry}
                                    className="h-10 rounded-lg bg-[#EA580C] px-6 py-2 text-sm font-medium text-white hover:bg-orange-700"
                                >
                                    Try Again
                                </Button>
                            </>
                        ) : null}
                    </div>
                </main>
            </div>
        </div>
    )
}
