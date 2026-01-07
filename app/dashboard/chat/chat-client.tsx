"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { generateApiKey, listApiKeys } from "@/app/actions/api-keys"
import { getChatHistory, saveChatMessage, clearChatHistory } from "@/app/actions/chat-history"
import { Send, Bot, User, Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

// Dynamic import to avoid SSR issues with canvas
const SoulprintBackground = dynamic(
    () => import("@/components/visualizer/SoulprintBackground"),
    { ssr: false }
)

interface Message {
    role: "user" | "assistant"
    content: string
}

export function ChatClient({ initialSoulprintId }: { initialSoulprintId: string | null }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [initializing, setInitializing] = useState(true)
    const [user, setUser] = useState<{ id?: string; email?: string } | null>(null)
    const [personality, setPersonality] = useState<string>("Default System")
    const [displayName, setDisplayName] = useState<string>("SoulPrint")
    const [shouldAutoScroll, setShouldAutoScroll] = useState(false)

    // Use prop for ID
    const selectedSoulprintId = initialSoulprintId

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Initialize: Get user, API Key, load chat history (Re-run when SoulPrint changes)
    useEffect(() => {
        async function init() {
            setInitializing(true)
            try {
                // 1. Get current user
                const { data: { user: currentUser } } = await supabase.auth.getUser()
                if (!currentUser) {
                    console.error('No user found')
                    setInitializing(false)
                    return
                }
                setUser(currentUser)

                // 2. Load SoulPrint Data based on Prop ID
                let spQuery = supabase
                    .from('soulprints')
                    .select('soulprint_data')
                    .eq('user_id', currentUser.id)

                if (selectedSoulprintId) {
                    spQuery = spQuery.eq('id', selectedSoulprintId)
                }

                let { data: existingSoulprint } = await spQuery.maybeSingle()

                // Fallback: If focused ID not found (e.g. deleted), find ANY
                if (!existingSoulprint && selectedSoulprintId) {
                    // Note: If prop ID is invalid, asking for ANY might switch context implicitly in UI but not in cookie.
                    // But for Chat visuals, it's fine.
                    const { data: anySP } = await supabase.from('soulprints').select('soulprint_data').eq('user_id', currentUser.id).maybeSingle()
                    existingSoulprint = anySP
                }

                const isDemoUser = currentUser.email?.includes('demo') || currentUser.email === 'elon@soulprint.ai';

                if (!existingSoulprint && !isDemoUser) {
                    // Redirect logic handled elsewhere usually, or here
                    // window.location.href = '/questionnaire'
                }

                // Extract personality string for visualizer
                try {
                    if (existingSoulprint) {
                        let soulprintData = existingSoulprint.soulprint_data
                        if (typeof soulprintData === 'string') {
                            soulprintData = JSON.parse(soulprintData)
                        }

                        // Determine display name
                        const name = soulprintData?.name || soulprintData?.archetype || "SoulPrint"
                        setDisplayName(name)

                        const personalityStr =
                            soulprintData?.full_system_prompt ||
                            soulprintData?.profile_summary?.archetype ||
                            soulprintData?.profile_summary?.core_essence ||
                            currentUser.email ||
                            'Default System'
                        setPersonality(personalityStr)
                    } else if (isDemoUser) {
                        setPersonality("Elon Musk Demo Mode");
                        setDisplayName("Elon Musk");
                    }
                } catch (e) {
                    setPersonality(currentUser.email || 'Default System')
                    setDisplayName("SoulPrint")
                }

                // 3. Load chat history (Could filter by soulprint? For now global history)
                // TODO: In future, chat history should be segmented by SoulPrint ID.
                const history = await getChatHistory()
                if (history.length > 0) {
                    const formattedHistory = history
                        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                        .map(msg => ({
                            role: msg.role as "user" | "assistant",
                            content: msg.content
                        }))
                    setMessages(formattedHistory)
                }

                // 4. Get API key logic (Simplified for re-runs)
                if (isDemoUser) {
                    setApiKey('sk-soulprint-demo-internal-key')
                } else {
                    const storedKey = localStorage.getItem("soulprint_internal_key")
                    if (storedKey) {
                        setApiKey(storedKey)
                    } else {
                        // Check DB if needed, but for re-init (switching print), key shouldn't change
                        // Just in case:
                        const { keys } = await listApiKeys()
                        if (keys && keys.length > 0) {
                            setApiKey(keys[0].encrypted_key || "legacy-key-placeholder")
                        }
                    }
                }

            } catch (error) {
                console.error('❌ Initialization error:', error)
            } finally {
                setInitializing(false)
            }
        }

        init()
    }, [selectedSoulprintId]) // Re-run when ID changes

    // Auto-scroll only when user sends a message (not on initial load)
    useEffect(() => {
        if (shouldAutoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages, shouldAutoScroll])

    async function handleSend() {
        if (!input.trim() || !apiKey) return

        const userMsg = input
        setInput("")
        setShouldAutoScroll(true) // Enable auto-scroll when user sends
        setMessages(prev => [...prev, { role: "user", content: userMsg }])
        setLoading(true)

        // Save user message
        await saveChatMessage({ role: "user", content: userMsg })

        try {
            const res = await fetch("/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    stream: true,
                    soulprint_id: selectedSoulprintId, // Pass the NEW ID
                    messages: [
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { role: "user", content: userMsg }
                    ]
                })
            })

            if (!res.ok) throw new Error("Failed to send")

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            let botMsg = ""

            setMessages(prev => [...prev, { role: "assistant", content: "" }])

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    const chunk = decoder.decode(value)
                    const lines = chunk.split("\n")
                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const dataStr = line.slice(6)
                            if (dataStr === "[DONE]") continue
                            try {
                                const data = JSON.parse(dataStr)
                                const content = data.choices[0]?.delta?.content || ""
                                botMsg += content
                                setMessages(prev => {
                                    const newMessages = [...prev]
                                    const lastMsg = newMessages[newMessages.length - 1]
                                    if (lastMsg.role === "assistant") lastMsg.content = botMsg
                                    return newMessages
                                })
                            } catch (e) { }
                        }
                    }
                }
            }
            await saveChatMessage({ role: "assistant", content: botMsg })
        } catch (e) {
            setMessages(prev => [...prev, { role: "assistant", content: "Error: Failed to reply." }])
        } finally {
            setLoading(false)
        }
    }

    async function handleClearHistory() {
        if (confirm("Are you sure?")) {
            await clearChatHistory()
            setMessages([])
        }
    }

    if (initializing) {
        return (
            <div className="flex h-full items-center justify-center text-gray-400">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Updating SoulContext...
            </div>
        )
    }

    return (
        <div className="relative flex h-full flex-col rounded-xl border border-[#222] overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 z-0 opacity-80 pointer-events-none">
                <SoulprintBackground personality={personality} />
            </div>
            <div className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/40" />

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full bg-[#111]/60 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-[#222] p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                            <Bot className="h-5 w-5" />
                        </div>
                        <div>
                            {/* Updated Label */}
                            <h2 className="font-semibold text-white">{displayName}</h2>
                            <p className="text-xs text-gray-500">
                                {user?.email ? `Personalized for ${user.email}` : ''}
                            </p>
                        </div>
                    </div>
                    {messages.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleClearHistory} className="text-gray-400 hover:text-red-400">
                            <Trash2 className="h-4 w-4 mr-1" />
                            Clear
                        </Button>
                    )}
                </div>

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
                            <div className={cn("max-w-[80%] rounded-lg p-3 text-sm", msg.role === "user" ? "bg-orange-600 text-white" : "bg-[#222] text-gray-200")}>
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

                <div className="border-t border-[#222] p-4">
                    <div className="flex gap-2">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
                            placeholder="Type a message..."
                            className="flex-1 rounded-md border border-[#333] bg-[#0A0A0A]/80 px-4 py-2 text-white placeholder:text-gray-600 focus:border-orange-500 focus:outline-none"
                            disabled={loading}
                        />
                        <Button onClick={handleSend} disabled={loading || !input.trim()} className="bg-orange-600 hover:bg-orange-700">
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
