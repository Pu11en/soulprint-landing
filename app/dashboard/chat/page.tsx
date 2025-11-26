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
    const [user, setUser] = useState<any>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Initialize: Get user, API Key, and ensure soulprint exists
    useEffect(() => {
        async function init() {
            try {
                // 1. Get current user
                const { data: { user: currentUser } } = await supabase.auth.getUser()
                if (!currentUser) {
                    console.error('No user found')
                    setInitializing(false)
                    return
                }
                setUser(currentUser)

                // 2. GUARANTEE soulprint exists for ALL users
                const { data: existingSoulprint, error: soulprintCheckError } = await supabase
                    .from('soulprints')
                    .select('soulprint_data')
                    .eq('user_id', currentUser.id)
                    .maybeSingle()

                if (!existingSoulprint) {
                    console.log('No soulprint found, creating default soulprint for user:', currentUser.email)

                    // Default soulprint for ANY user
                    const defaultSoulprintData = {
                        communication_style: {
                            formality: "casual",
                            directness: "direct",
                            humor: "moderate",
                            tone: "friendly"
                        },
                        decision_making: {
                            approach: "analytical",
                            speed: "balanced",
                            collaboration: "high",
                            risk_tolerance: "moderate"
                        },
                        values: ["innovation", "authenticity", "growth", "learning"],
                        work_style: {
                            environment: "collaborative",
                            pace: "steady",
                            structure: "flexible"
                        },
                        personality_traits: {
                            openness: "high",
                            conscientiousness: "moderate",
                            extraversion: "balanced",
                            agreeableness: "high",
                            neuroticism: "low"
                        }
                    }

                    const { error: insertError } = await supabase
                        .from('soulprints')
                        .insert({
                            user_id: currentUser.id,
                            soulprint_data: defaultSoulprintData
                        })

                    if (insertError) {
                        console.error('Failed to create soulprint:', insertError)
                        throw new Error('Failed to initialize soulprint')
                    }
                    console.log('✅ Default soulprint created successfully')
                }

                // 3. GUARANTEE API key exists
                // Check localStorage first
                const storedKey = localStorage.getItem("soulprint_internal_key")
                if (storedKey && storedKey.startsWith('sk-soulprint-')) {
                    // Verify key still exists in database
                    const { keys } = await listApiKeys()
                    if (keys && keys.length > 0) {
                        setApiKey(storedKey)
                        setInitializing(false)
                        console.log('✅ Using existing API key from localStorage')
                        return
                    }
                }

                // Generate new API key if needed
                console.log('Generating new API key...')
                const { apiKey: newKey, error: keyError } = await generateApiKey("Internal Chat Key")

                if (newKey) {
                    setApiKey(newKey)
                    localStorage.setItem("soulprint_internal_key", newKey)
                    console.log('✅ New API key generated successfully')
                } else if (keyError) {
                    console.error('Failed to generate API key:', keyError)
                    throw new Error('Failed to generate API key')
                }

            } catch (error) {
                console.error('❌ Initialization error:', error)
                setMessages([{
                    role: "assistant",
                    content: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please refresh the page or contact support.`
                }])
            } finally {
                setInitializing(false)
            }
        }

        init()
    }, [])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Function to set demo personality (only shown for non-demo users)
    async function handleLoadDemoData() {
        setLoading(true)
        try {
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
                // Handle error - stringify if it's an object
                const errorMsg = typeof data.error === 'object'
                    ? JSON.stringify(data.error, null, 2)
                    : data.error
                setMessages(prev => [...prev, { role: "assistant", content: `Error: ${errorMsg}` }])
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
                        <p className="text-xs text-gray-500">
                            {user?.email === 'demo@soulprint.ai'
                                ? 'Demo mode - Pre-configured personality'
                                : 'Personalized with your SoulPrint'
                            }
                        </p>
                    </div>
                </div>
                {/* Only show Set Demo Personality button for non-demo users */}
                {user && user.email !== 'demo@soulprint.ai' && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadDemoData}
                        className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
                    >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Set Demo Personality
                    </Button>
                )}
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
                {!apiKey && (
                    <div className="mb-2 text-xs text-orange-500">
                        ⚠️ API key not available. Please refresh the page or check your settings.
                    </div>
                )}
                <div className="flex gap-2">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !loading && apiKey && input.trim() && handleSend()}
                        placeholder="Type a message..."
                        className="flex-1 rounded-md border border-[#333] bg-[#0A0A0A] px-4 py-2 text-white placeholder:text-gray-600 focus:border-orange-500 focus:outline-none"
                        disabled={loading}
                    />
                    <Button onClick={handleSend} disabled={loading || !input.trim() || !apiKey} className="bg-orange-600 hover:bg-orange-700">
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
