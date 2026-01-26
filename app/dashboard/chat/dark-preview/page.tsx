/**
 * Dark Theme Chat Preview
 * 
 * Demo page to preview the Telegram-style dark theme
 * Visit: /dashboard/chat/dark-preview
 */
"use client"

import { useState } from "react"
import { ChatContainerDark, ChatEmptyStateDark } from "../dark-theme"
import { ChatMessageDark, TypingIndicatorDark } from "../chat-message-dark"

interface Message {
    role: "user" | "assistant"
    content: string
    timestamp?: Date
}

// Demo messages to show the styling
const demoMessages: Message[] = [
    {
        role: "user",
        content: "Hey! I've been thinking about my goals lately. Can you help me reflect?",
        timestamp: new Date(Date.now() - 300000)
    },
    {
        role: "assistant",
        content: "Of course! I'd love to help you explore your goals. 🎯\n\nReflection is such a powerful tool for growth. Let's start with something simple:\n\n**What's one thing you've accomplished recently that you're proud of?**\n\nIt doesn't have to be big - sometimes the small wins matter most.",
        timestamp: new Date(Date.now() - 240000)
    },
    {
        role: "user",
        content: "I finally finished that side project I've been working on for months. It's a simple app but it actually works!",
        timestamp: new Date(Date.now() - 180000)
    },
    {
        role: "assistant",
        content: "That's amazing! 🎉 Finishing a side project is no small feat - especially one that took months.\n\nThe fact that \"it actually works\" tells me you:\n- Persisted through the hard parts\n- Learned to debug and problem-solve\n- Turned an idea into reality\n\n> \"Done is better than perfect.\"\n\nWhat made you finally push through to completion? Was there a specific moment or motivation?",
        timestamp: new Date(Date.now() - 120000)
    }
]

export default function DarkPreviewPage() {
    const [messages, setMessages] = useState<Message[]>(demoMessages)
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [backgroundStyle, setBackgroundStyle] = useState<"default" | "neural" | "ethereal">("ethereal")
    const [showEmpty, setShowEmpty] = useState(false)

    const handleSend = () => {
        if (!input.trim()) return

        const userMessage: Message = {
            role: "user",
            content: input,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput("")
        setIsLoading(true)

        // Simulate AI response
        setTimeout(() => {
            const aiMessage: Message = {
                role: "assistant",
                content: "This is a demo response to show how the dark theme looks with your message. The actual chat would connect to SoulPrint's AI backend.\n\n**Features shown:**\n- Message bubbles with tails\n- Markdown formatting\n- Timestamps\n- Smooth animations",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, aiMessage])
            setIsLoading(false)
        }, 1500)
    }

    return (
        <div className="h-screen flex flex-col bg-zinc-950">
            {/* Controls */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                    <span className="text-xs text-zinc-500">Background:</span>
                    <div className="flex gap-2">
                        {(["default", "neural", "ethereal"] as const).map(style => (
                            <button
                                key={style}
                                onClick={() => setBackgroundStyle(style)}
                                className={`px-3 py-1 text-xs rounded-full transition-all ${
                                    backgroundStyle === style
                                        ? "bg-purple-600 text-white"
                                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                }`}
                            >
                                {style}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowEmpty(!showEmpty)}
                        className="px-3 py-1 text-xs rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-all"
                    >
                        {showEmpty ? "Show Messages" : "Show Empty State"}
                    </button>
                    <button
                        onClick={() => setMessages([])}
                        className="px-3 py-1 text-xs rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-all"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Chat */}
            <div className="flex-1 overflow-hidden">
                <ChatContainerDark
                    soulprintName="Drew's SoulPrint"
                    inputValue={input}
                    onInputChange={setInput}
                    onSend={handleSend}
                    isLoading={isLoading}
                    backgroundStyle={backgroundStyle}
                    placeholder="Type a message to test the dark theme..."
                >
                    {showEmpty || messages.length === 0 ? (
                        <ChatEmptyStateDark 
                            soulprintName="Drew's SoulPrint"
                            onSuggestionClick={(prompt) => {
                                setInput(prompt)
                                setShowEmpty(false)
                            }}
                        />
                    ) : (
                        <>
                            {messages.map((msg, i) => (
                                <ChatMessageDark 
                                    key={i} 
                                    message={msg}
                                    soulprintName="Drew's SoulPrint"
                                />
                            ))}
                            {isLoading && <TypingIndicatorDark soulprintName="Drew's SoulPrint" />}
                        </>
                    )}
                </ChatContainerDark>
            </div>
        </div>
    )
}
