/**
 * SoulPrint Dark Theme Chat Container
 * 
 * Telegram-inspired dark mode chat interface with:
 * - Subtle animated background pattern
 * - Purple/orange SoulPrint accent colors
 * - Smooth message animations
 * - Modern input area
 * 
 * This is a themed wrapper - use with existing chat logic from ChatClient
 */
"use client"

import { useRef, useEffect, type ReactNode } from "react"
import { Send, Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import "./chat-dark-theme.css"

interface ChatContainerDarkProps {
    children: ReactNode
    soulprintName?: string
    inputValue?: string
    onInputChange?: (value: string) => void
    onSend?: () => void
    isLoading?: boolean
    placeholder?: string
    showHeader?: boolean
    backgroundStyle?: "default" | "neural" | "ethereal"
}

export function ChatContainerDark({
    children,
    soulprintName = "SoulPrint",
    inputValue = "",
    onInputChange,
    onSend,
    isLoading = false,
    placeholder = "Type a message...",
    showHeader = true,
    backgroundStyle = "default"
}: ChatContainerDarkProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto"
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"
        }
    }, [inputValue])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSend?.()
        }
    }

    const bgClass = {
        default: "chat-dark-bg",
        neural: "chat-dark-bg-neural",
        ethereal: "chat-dark-bg-ethereal"
    }[backgroundStyle]

    return (
        <div className="flex flex-col h-full w-full overflow-hidden rounded-xl bg-[#0a0a0f]">
            {/* Header */}
            {showHeader && (
                <div className="chat-dark-header flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-white truncate">
                            {soulprintName}
                        </h2>
                        <p className="text-xs text-zinc-500">Your AI companion</p>
                    </div>
                    {isLoading && (
                        <div className="flex items-center gap-2 text-zinc-500 text-xs">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Thinking...</span>
                        </div>
                    )}
                </div>
            )}

            {/* Messages Area */}
            <div 
                className={cn(
                    "flex-1 overflow-y-auto px-4 py-4 chat-dark-scrollbar",
                    bgClass
                )}
            >
                <div className="max-w-3xl mx-auto">
                    {children}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="chat-dark-input px-4 py-3">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-end gap-3">
                        <div className="flex-1 relative">
                            <textarea
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => onInputChange?.(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={placeholder}
                                disabled={isLoading}
                                rows={1}
                                className={cn(
                                    "w-full resize-none rounded-2xl px-4 py-3 text-sm",
                                    "bg-[#1E1E2E] border border-zinc-800",
                                    "text-zinc-100 placeholder:text-zinc-500",
                                    "focus:border-[#8B5CF6]/50 focus:ring-2 focus:ring-[#8B5CF6]/10 focus:outline-none",
                                    "transition-all duration-200",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                                style={{ maxHeight: "120px" }}
                            />
                        </div>
                        <button
                            onClick={onSend}
                            disabled={isLoading || !inputValue.trim()}
                            className={cn(
                                "chat-dark-send-btn",
                                "flex items-center justify-center",
                                "w-11 h-11 rounded-full",
                                "transition-all duration-200"
                            )}
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Send className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                    <p className="text-[10px] text-zinc-600 text-center mt-2">
                        {soulprintName} may produce inaccurate information
                    </p>
                </div>
            </div>
        </div>
    )
}

/**
 * Empty state for dark theme chat
 */
export function ChatEmptyStateDark({ 
    soulprintName = "SoulPrint",
    onSuggestionClick 
}: { 
    soulprintName?: string
    onSuggestionClick?: (prompt: string) => void 
}) {
    const suggestions = [
        {
            title: "Tell me about yourself",
            prompt: "What makes you unique? Tell me about your personality and how you see the world."
        },
        {
            title: "Help me reflect",
            prompt: "I want to understand myself better. Ask me thought-provoking questions."
        },
        {
            title: "Creative brainstorm",
            prompt: "Let's brainstorm creative ideas together. I'm open to exploring new concepts."
        }
    ]

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center shadow-xl shadow-purple-500/30">
                    <Sparkles className="h-8 w-8 text-white" />
                </div>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">
                Welcome to {soulprintName}
            </h1>
            <p className="text-zinc-500 text-sm mb-8 text-center max-w-md">
                Your AI companion that truly understands you. Start a conversation below.
            </p>

            {/* Suggestion cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
                {suggestions.map((suggestion, idx) => (
                    <button
                        key={idx}
                        onClick={() => onSuggestionClick?.(suggestion.prompt)}
                        className={cn(
                            "chat-dark-welcome-card",
                            "p-4 rounded-xl text-left",
                            "transition-all duration-200",
                            "hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        <h3 className="text-sm font-medium text-white mb-1">
                            {suggestion.title}
                        </h3>
                        <p className="text-xs text-zinc-500 line-clamp-2">
                            {suggestion.prompt}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    )
}
