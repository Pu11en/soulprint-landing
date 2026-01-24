"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface SpeechRecognitionResult {
    transcript: string
    isFinal: boolean
}

interface UseSpeechRecognitionReturn {
    isListening: boolean
    transcript: string
    interimTranscript: string
    error: string | null
    isSupported: boolean
    startListening: () => void
    stopListening: () => void
    resetTranscript: () => void
}

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList
    resultIndex: number
}

interface SpeechRecognitionResultList {
    length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: {
        isFinal: boolean
        [index: number]: {
            transcript: string
            confidence: number
        }
    }
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string
    message: string
}

interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    start: () => void
    stop: () => void
    abort: () => void
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
    onstart: (() => void) | null
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognitionInstance
        webkitSpeechRecognition: new () => SpeechRecognitionInstance
    }
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState("")
    const [interimTranscript, setInterimTranscript] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isSupported, setIsSupported] = useState(false)

    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

    // Check for browser support
    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            setIsSupported(!!SpeechRecognition)
        }
    }, [])

    // Initialize recognition instance
    useEffect(() => {
        if (typeof window === "undefined") return

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) return

        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = "en-US"

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = ""
            let interim = ""

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                const transcriptText = result[0].transcript

                if (result.isFinal) {
                    finalTranscript += transcriptText
                } else {
                    interim += transcriptText
                }
            }

            if (finalTranscript) {
                setTranscript(prev => prev + finalTranscript)
            }
            setInterimTranscript(interim)
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            const errorMessages: Record<string, string> = {
                "not-allowed": "Microphone access denied. Please allow microphone access in your browser settings.",
                "no-speech": "No speech detected. Please try again.",
                "audio-capture": "No microphone found. Please check your audio input device.",
                "network": "Network error occurred. Please check your connection.",
                "aborted": "Speech recognition was aborted.",
            }

            setError(errorMessages[event.error] || `Error: ${event.error}`)
            setIsListening(false)
        }

        recognition.onend = () => {
            setIsListening(false)
            setInterimTranscript("")
        }

        recognition.onstart = () => {
            setIsListening(true)
            setError(null)
        }

        recognitionRef.current = recognition

        return () => {
            recognition.abort()
        }
    }, [])

    const startListening = useCallback(() => {
        if (!recognitionRef.current) {
            setError("Speech recognition not supported in this browser")
            return
        }

        setError(null)
        setTranscript("")
        setInterimTranscript("")

        try {
            recognitionRef.current.start()
        } catch (err) {
            // Recognition might already be running
            console.error("Speech recognition start error:", err)
        }
    }, [])

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
        }
    }, [])

    const resetTranscript = useCallback(() => {
        setTranscript("")
        setInterimTranscript("")
    }, [])

    return {
        isListening,
        transcript,
        interimTranscript,
        error,
        isSupported,
        startListening,
        stopListening,
        resetTranscript,
    }
}
