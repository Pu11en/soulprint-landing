"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface UseVoiceRecorderReturn {
    isRecording: boolean
    isSupported: boolean
    startRecording: () => void
    stopRecording: () => void
    transcript: string
    error: string | null
}

// Extend Window interface for Speech Recognition
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList
    resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
    const [isRecording, setIsRecording] = useState(false)
    const [isSupported, setIsSupported] = useState(false)
    const [transcript, setTranscript] = useState("")
    const [error, setError] = useState<string | null>(null)
    
    const recognitionRef = useRef<any>(null)

    useEffect(() => {
        // Check if Speech Recognition is supported
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        setIsSupported(!!SpeechRecognition)
        
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition()
            recognition.continuous = true
            recognition.interimResults = true
            recognition.lang = "en-US"
            
            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let finalTranscript = ""
                let interimTranscript = ""
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i]
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript
                    } else {
                        interimTranscript += result[0].transcript
                    }
                }
                
                setTranscript(finalTranscript || interimTranscript)
            }
            
            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error("Speech recognition error:", event.error)
                setError(event.error)
                setIsRecording(false)
            }
            
            recognition.onend = () => {
                setIsRecording(false)
            }
            
            recognitionRef.current = recognition
        }
        
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
        }
    }, [])

    const startRecording = useCallback(() => {
        if (!recognitionRef.current) return
        
        setError(null)
        setTranscript("")
        
        try {
            recognitionRef.current.start()
            setIsRecording(true)
        } catch (err) {
            console.error("Start recording error:", err)
            setError("Could not start voice recognition")
        }
    }, [])

    const stopRecording = useCallback(() => {
        if (!recognitionRef.current) return
        
        recognitionRef.current.stop()
        setIsRecording(false)
    }, [])

    return {
        isRecording,
        isSupported,
        startRecording,
        stopRecording,
        transcript,
        error
    }
}
