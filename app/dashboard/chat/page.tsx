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

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [initializing, setInitializing] = useState(true)
    const [user, setUser] = useState<{ id?: string; email?: string } | null>(null)
    const [personality, setPersonality] = useState<string>("Default System")
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Initialize: Get user, API Key, load chat history
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
                console.log('✅ Current user:', currentUser.email)

                // 2. Check if soulprint exists for this user
                const { data: existingSoulprint } = await supabase
                    .from('soulprints')
                    .select('soulprint_data')
                    .eq('user_id', currentUser.email)
                    .maybeSingle()

                if (!existingSoulprint) {
                    console.log('No soulprint found for user:', currentUser.email)
                    // Redirect to questionnaire if no soulprint
                    window.location.href = '/questionnaire'
                    return
                }
                console.log('✅ Soulprint found for user')

                // Extract personality string for visualizer
                try {
                    let soulprintData = existingSoulprint.soulprint_data
                    if (typeof soulprintData === 'string') {
                        soulprintData = JSON.parse(soulprintData)
                    }
                    // Use archetype or core_essence as personality seed
                    const personalityStr = 
                        soulprintData?.profile_summary?.archetype ||
                        soulprintData?.profile_summary?.core_essence ||
                        soulprintData?.full_system_prompt?.substring(0, 100) ||
                        currentUser.email ||
                        'Default System'
                    setPersonality(personalityStr)
                    console.log('✅ Personality set:', personalityStr.substring(0, 50) + '...')
                } catch (e) {
                    console.log('Could not parse personality, using default')
                    setPersonality(currentUser.email || 'Default System')
                }

                // 3. Load chat history
                const history = await getChatHistory()
                if (history.length > 0) {
                    const formattedHistory = history
                        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                        .map(msg => ({
                            role: msg.role as "user" | "assistant",
                            content: msg.content
                        }))
                    setMessages(formattedHistory)
                    console.log('✅ Loaded chat history:', formattedHistory.length, 'messages')
                }

                // 4. Get API key - check if user has one in database first
                const { keys, error: keysError } = await listApiKeys()
                
                if (keysError) {
                    console.error('Error fetching keys:', keysError)
                }

                // Check localStorage for the raw key
                const storedKey = localStorage.getItem("soulprint_internal_key")
                
                if (keys && keys.length > 0 && storedKey && storedKey.startsWith('sk-soulprint-')) {
                    // User has keys in DB and a stored key - use it
                    setApiKey(storedKey)
                    console.log('✅ Using existing API key')
                } else if (keys && keys.length > 0) {
                    // User has keys but no localStorage - need to generate new one
                    console.log('Keys exist in DB but not in localStorage, generating new key...')
                    localStorage.removeItem("soulprint_internal_key") // Clear any stale key
                    const { apiKey: newKey, error: keyError } = await generateApiKey("Internal Chat Key")
                    if (newKey) {
                        setApiKey(newKey)
                        localStorage.setItem("soulprint_internal_key", newKey)
                        console.log('✅ New API key generated')
                    } else {
                        console.error('Failed to generate key:', keyError)
                    }
                } else {
                    // No keys at all - generate one
                    console.log('No API keys found, generating new key...')
                    localStorage.removeItem("soulprint_internal_key")
                    const { apiKey: newKey, error: keyError } = await generateApiKey("Internal Chat Key")
                    if (newKey) {
                        setApiKey(newKey)
                        localStorage.setItem("soulprint_internal_key", newKey)
                        console.log('✅ New API key generated')
                    } else {
                        console.error('Failed to generate key:', keyError)
                        throw new Error('Failed to generate API key')
                    }
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

    async function handleSend() {
        if (!input.trim() || !apiKey) return

        const userMsg = input
        setInput("")
        setMessages(prev => [...prev, { role: "user", content: userMsg }])
        setLoading(true)

        // Save user message to database
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
                // Save assistant message to database
                await saveChatMessage({ role: "assistant", content: botMsg })
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: "assistant", content: "Error: Failed to send message." }])
        } finally {
            setLoading(false)
        }
    }

    async function handleClearHistory() {
        if (confirm("Are you sure you want to clear your chat history?")) {
            await clearChatHistory()
            setMessages([])
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
        <div className="relative flex h-[calc(100vh-8rem)] flex-col rounded-xl border border-[#222] overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 z-0 opacity-60 pointer-events-none">
                <SoulprintBackground personality={personality} />
            </div>
            {/* Gradient overlay for text contrast */}
            <div className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/60" />
            
            {/* Main content - above background */}
            <div className="relative z-10 flex flex-col h-full bg-[#111]/60 backdrop-blur-sm">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#222] p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                            <Bot className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-white">SoulPrint GPT-4</h2>
                            <p className="text-xs text-gray-500">
                                {user?.email ? `Personalized for ${user.email}` : 'Loading...'}
                            </p>
                        </div>
                    </div>
                    {messages.length > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleClearHistory}
                            className="text-gray-400 hover:text-red-400"
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Clear
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
                        className="flex-1 rounded-md border border-[#333] bg-[#0A0A0A]/80 px-4 py-2 text-white placeholder:text-gray-600 focus:border-orange-500 focus:outline-none"
                        disabled={loading}
                    />
                    <Button onClick={handleSend} disabled={loading || !input.trim() || !apiKey} className="bg-orange-600 hover:bg-orange-700">
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            </div>
        </div>
    )
}
