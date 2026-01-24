import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Send, Paperclip, Mic, MicOff } from "lucide-react"
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition"
import { cn } from "@/lib/utils"

interface ChatInputProps {
    onSend: (message: string) => void
    disabled?: boolean
    placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder = "Type a message..." }: ChatInputProps) {
    const [input, setInput] = useState("")
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const {
        isListening,
        transcript,
        interimTranscript,
        error,
        isSupported,
        startListening,
        stopListening,
        resetTranscript,
    } = useSpeechRecognition()

    // Update input when transcript changes
    useEffect(() => {
        if (transcript) {
            setInput(prev => {
                // If already has text, add a space before new transcript
                if (prev && !prev.endsWith(" ")) {
                    return prev + " " + transcript
                }
                return prev + transcript
            })
            resetTranscript()
        }
    }, [transcript, resetTranscript])

    function handleSend() {
        if (!input.trim() || disabled) return
        onSend(input)
        setInput("")
        resetTranscript()

        // Reset height
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
        }
    }

    function autoResizeTextarea(el: HTMLTextAreaElement) {
        el.style.height = "auto"
        const next = Math.min(el.scrollHeight, 220)
        el.style.height = `${next}px`
    }

    function handleVoiceClick() {
        if (isListening) {
            stopListening()
        } else {
            startListening()
        }
    }

    // Auto-focus on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            textareaRef.current?.focus()
        }, 100)
        return () => clearTimeout(timer)
    }, [])

    // Display text: show input + interim transcript when listening
    const displayPlaceholder = isListening
        ? interimTranscript || "Listening..."
        : placeholder

    return (
        <div className="flex flex-col gap-2">
            {/* Error message */}
            {error && (
                <div className="text-xs text-red-500 px-2">
                    {error}
                </div>
            )}

            <div
                className={cn(
                    "flex items-center gap-2 border rounded-xl p-2 sm:p-3 bg-zinc-50 transition-all",
                    "focus-within:border-[color:var(--sp-primary)] focus-within:ring-1 focus-within:ring-[color:var(--sp-primary)]",
                    isListening
                        ? "border-red-400 ring-2 ring-red-200 animate-pulse"
                        : "border-zinc-300"
                )}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => alert("File attachments coming soon!")}
                    className="h-10 w-10 sm:h-8 sm:w-8 text-neutral-500 hover:text-neutral-700 shrink-0"
                    title="Attach file (Coming Soon)"
                >
                    <Paperclip className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>

                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !disabled) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                        onInput={(e) => autoResizeTextarea(e.currentTarget)}
                        placeholder={displayPlaceholder}
                        className={cn(
                            "w-full bg-transparent text-zinc-900 text-sm focus:outline-none min-h-[56px] sm:min-h-[48px] resize-none leading-relaxed overflow-hidden",
                            isListening ? "placeholder:text-red-400" : "placeholder:text-zinc-400"
                        )}
                        rows={1}
                        disabled={disabled}
                    />
                    {/* Interim transcript overlay when listening */}
                    {isListening && interimTranscript && input && (
                        <span className="absolute bottom-3 left-0 text-sm text-red-400 opacity-70 pointer-events-none">
                            {interimTranscript}
                        </span>
                    )}
                </div>

                {/* Voice input button */}
                {isSupported ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleVoiceClick}
                        disabled={disabled}
                        className={cn(
                            "h-10 w-10 sm:h-8 sm:w-8 shrink-0 transition-all",
                            isListening
                                ? "text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100"
                                : "text-neutral-500 hover:text-neutral-700"
                        )}
                        title={isListening ? "Stop recording" : "Start voice input"}
                    >
                        {isListening ? (
                            <MicOff className="h-5 w-5 sm:h-4 sm:w-4" />
                        ) : (
                            <Mic className="h-5 w-5 sm:h-4 sm:w-4" />
                        )}
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        className="h-10 w-10 sm:h-8 sm:w-8 text-neutral-300 shrink-0 cursor-not-allowed"
                        title="Voice input not supported in this browser"
                    >
                        <Mic className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                )}

                <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={disabled || !input.trim()}
                    className="bg-[color:var(--sp-primary)] hover:bg-[color:var(--sp-primary-dark)] h-10 w-10 sm:h-8 sm:w-8 rounded-lg shrink-0 transition-opacity disabled:opacity-50"
                >
                    <Send className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
            </div>

            {/* Recording indicator */}
            {isListening && (
                <div className="flex items-center justify-center gap-2 text-xs text-red-500">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    Recording... Click the mic button or press Enter to stop
                </div>
            )}
        </div>
    )
}
