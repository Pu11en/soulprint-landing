"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { generateApiKey, listApiKeys } from "@/app/actions/api-keys"
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface Message {
    role: "user" | "assistant"
    content: string
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [initializing, setInitializing] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Initialize: Get or Create API Key
    useEffect(() => {
        async function init() {
            // 1. Check for existing keys
            const { keys } = await listApiKeys()

            if (keys && keys.length > 0) {
                const storedKey = localStorage.getItem("soulprint_internal_key")
                if (storedKey) {
                    setApiKey(storedKey)
                    setInitializing(false)
                    return
                }
            }

            // 2. If no key usable, generate a new one
            const { apiKey: newKey } = await generateApiKey("Internal Chat Key")
            if (newKey) {
                setApiKey(newKey)
                localStorage.setItem("soulprint_internal_key", newKey)
            }
            setInitializing(false)
        }

        init()
    }, [])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    async function handleLoadDemoData() {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                alert("Please sign in first")
                return
            }

            // Fetch the FIRST soulprint to be deterministic
            const { data: soulprints } = await supabase
                .from('soulprints')
                .select('*')
                .limit(1)

            if (soulprints && soulprints.length > 0) {
                const sourceSp = soulprints[0]

                const { error } = await supabase
                    .from('soulprints')
                    .upsert({
                        user_id: user.id,
                        soulprint_data: sourceSp.soulprint_data
                    }, { onConflict: 'user_id' })

                if (error) throw error

                setMessages(prev => [...prev, { role: "assistant", content: "✨ I've set your SoulPrint personality! I will now consistently use this persona." }])
            } else {
                alert("No soulprints found in database to copy.")
            }
        } catch (e) {
            console.error(e)
            alert("Failed to set demo data")
        } finally {
            setLoading(false)
        }
    }

    async function handleSend() {
        if (!input.trim() || !apiKey) return

        const userMsg = input
        setInput("")
        setMessages(prev => [...prev, { role: "user", content: userMsg }])
        setLoading(true)

        try {
            const res = await fetch("/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { role: "user", content: userMsg }
                    ]
                })
            })

            const data = await res.json()

            if (data.error) {
                setMessages(prev => [...prev, { role: "assistant", content: `Error: ${data.error} ` }])
            } else {
                const botMsg = data.choices[0].message.content
                setMessages(prev => [...prev, { role: "assistant", content: botMsg }])
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: "assistant", content: "Error: Failed to send message." }])
        } finally {
            setLoading(false)
        }
    }

    if (initializing) {
        return (
            <div className="flex h-full items-center justify-center text-gray-400">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Initializing SoulPrint Engine...
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-8rem)] flex-col rounded-xl border border-[#222] bg-[#111]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#222] p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                        <Bot className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-white">SoulPrint GPT-4</h2>
                        <p className="text-xs text-gray-500">Personalized with your SoulPrint</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadDemoData}
                    className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
                >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Set Demo Personality
                </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
                        <Bot className="mb-4 h-12 w-12 opacity-20" />
                        <p>Start chatting to see your SoulPrint in action.</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                        {msg.role === "assistant" && (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                                <Bot className="h-4 w-4" />
                            </div>
                        )}
                        <div className={cn(
                            "max-w-[80%] rounded-lg p-3 text-sm",
                            msg.role === "user"
                                ? "bg-orange-600 text-white"
                                : "bg-[#222] text-gray-200"
                        )}>
                            {msg.content}
                        </div>
                        {msg.role === "user" && (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-600/20 text-orange-500">
                                <User className="h-4 w-4" />
                            </div>
                        )}
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                            <Bot className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-1 rounded-lg bg-[#222] p-3">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: "0ms" }} />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: "150ms" }} />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: "300ms" }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-[#222] p-4">
                <div className="flex gap-2">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Type a message..."
                        className="flex-1 rounded-md border border-[#333] bg-[#0A0A0A] px-4 py-2 text-white placeholder:text-gray-600 focus:border-orange-500 focus:outline-none"
                        disabled={loading}
                    />
                    <Button onClick={handleSend} disabled={loading || !input.trim()} className="bg-orange-600 hover:bg-orange-700">
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
