"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, RefreshCw, Check, Edit3, Wand2 } from "lucide-react"
import Image from "next/image"

interface AvatarGeneratorProps {
    soulprintId: string
    onComplete?: (avatarUrl: string) => void
    onSkip?: () => void
}

export function AvatarGenerator({ soulprintId, onComplete, onSkip }: AvatarGeneratorProps) {
    const [step, setStep] = useState<'idle' | 'generating-prompt' | 'editing-prompt' | 'generating-image' | 'preview' | 'saving'>('idle')
    const [prompt, setPrompt] = useState("")
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedModel, setSelectedModel] = useState<'ideogram' | 'flux2'>('ideogram')

    const generatePrompt = async () => {
        setStep('generating-prompt')
        setError(null)

        try {
            const response = await fetch('/api/generate-avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate-prompt',
                    soulprintId,
                }),
            })

            const data = await response.json()
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate prompt')
            }

            setPrompt(data.prompt)
            setStep('editing-prompt')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate prompt')
            setStep('idle')
        }
    }

    const generateImage = async () => {
        setStep('generating-image')
        setError(null)

        try {
            const response = await fetch('/api/generate-avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate-image',
                    customPrompt: prompt,
                    model: selectedModel,
                }),
            })

            const data = await response.json()
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate image')
            }

            setImageUrl(data.imageUrl)
            setStep('preview')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate image')
            setStep('editing-prompt')
        }
    }

    const saveAvatar = async () => {
        if (!imageUrl) return
        
        setStep('saving')
        setError(null)

        try {
            const response = await fetch('/api/generate-avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save-avatar',
                    imageUrl,
                }),
            })

            const data = await response.json()
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to save avatar')
            }

            onComplete?.(data.savedUrl)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save avatar')
            setStep('preview')
        }
    }

    const regenerate = () => {
        setImageUrl(null)
        setStep('editing-prompt')
    }

    const startOver = () => {
        setPrompt("")
        setImageUrl(null)
        setStep('idle')
    }

    return (
        <div className="w-full space-y-4">
            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Step: Idle - Start */}
            {step === 'idle' && (
                <div className="text-center space-y-4">
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                        <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-gray-900">Generate Your SoulPrint Avatar</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Create a unique profile picture based on your personality
                        </p>
                    </div>
                    <Button
                        onClick={generatePrompt}
                        className="w-full h-12 bg-[#EA580C] hover:bg-orange-700 text-white font-medium"
                    >
                        <Wand2 className="w-5 h-5 mr-2" />
                        Generate Avatar
                    </Button>
                    {onSkip && (
                        <button
                            onClick={onSkip}
                            className="text-sm text-gray-400 hover:text-gray-600 underline"
                        >
                            Skip for now
                        </button>
                    )}
                </div>
            )}

            {/* Step: Generating Prompt */}
            {step === 'generating-prompt' && (
                <div className="text-center space-y-4 py-8">
                    <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
                    <p className="text-gray-600">Analyzing your SoulPrint...</p>
                </div>
            )}

            {/* Step: Editing Prompt */}
            {step === 'editing-prompt' && (
                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                            <Edit3 className="w-4 h-4" />
                            Image Prompt
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={6}
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                            placeholder="Describe your ideal avatar..."
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Edit this prompt to customize your avatar. Be specific about colors, patterns, and mood.
                        </p>
                    </div>

                    {/* Model Selection */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedModel('ideogram')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                selectedModel === 'ideogram'
                                    ? 'bg-orange-100 text-orange-700 border-2 border-orange-500'
                                    : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                            }`}
                        >
                            Ideogram (Artistic)
                        </button>
                        <button
                            onClick={() => setSelectedModel('flux2')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                selectedModel === 'flux2'
                                    ? 'bg-orange-100 text-orange-700 border-2 border-orange-500'
                                    : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                            }`}
                        >
                            Flux 2 (Photorealistic)
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            onClick={generateImage}
                            disabled={!prompt.trim()}
                            className="flex-1 h-11 bg-[#EA580C] hover:bg-orange-700 text-white font-medium disabled:opacity-50"
                        >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Image
                        </Button>
                        <Button
                            onClick={startOver}
                            variant="outline"
                            className="h-11 border-gray-300"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Step: Generating Image */}
            {step === 'generating-image' && (
                <div className="text-center space-y-4 py-8">
                    <div className="relative">
                        <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-orange-400 to-purple-500 animate-pulse" />
                        <Loader2 className="w-8 h-8 animate-spin text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div>
                        <p className="text-gray-600 font-medium">Creating your avatar...</p>
                        <p className="text-sm text-gray-400">This may take 30-60 seconds</p>
                    </div>
                </div>
            )}

            {/* Step: Preview */}
            {step === 'preview' && imageUrl && (
                <div className="space-y-4">
                    <div className="relative w-48 h-48 mx-auto rounded-xl overflow-hidden shadow-lg">
                        <Image
                            src={imageUrl}
                            alt="Generated Avatar"
                            fill
                            className="object-cover"
                            unoptimized
                        />
                    </div>
                    <p className="text-center text-sm text-gray-500">
                        Your SoulPrint Avatar
                    </p>
                    <div className="flex gap-3">
                        <Button
                            onClick={regenerate}
                            variant="outline"
                            className="flex-1 h-11 border-gray-300"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Regenerate
                        </Button>
                        <Button
                            onClick={saveAvatar}
                            className="flex-1 h-11 bg-[#EA580C] hover:bg-orange-700 text-white font-medium"
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Use This
                        </Button>
                    </div>
                    {onSkip && (
                        <button
                            onClick={onSkip}
                            className="w-full text-sm text-gray-400 hover:text-gray-600 underline"
                        >
                            Skip for now
                        </button>
                    )}
                </div>
            )}

            {/* Step: Saving */}
            {step === 'saving' && (
                <div className="text-center space-y-4 py-8">
                    <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
                    <p className="text-gray-600">Saving your avatar...</p>
                </div>
            )}
        </div>
    )
}
