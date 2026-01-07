"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { generateApiKey, listApiKeys } from "@/app/actions/api-keys"
import { getChatHistory, saveChatMessage, clearChatHistory, getChatSessions, type ChatSession } from "@/app/actions/chat-history"
import { Send, Bot, User, Loader2, Trash2, Plus, MessageSquare, ChevronLeft, ChevronRight, Menu } from "lucide-react"
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
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [initializing, setInitializing] = useState(true)
    const [user, setUser] = useState<{ id?: string; email?: string } | null>(null)
    const [personality, setPersonality] = useState<string>("Default System")
    const [displayName, setDisplayName] = useState<string>("SoulPrint")
    const [shouldAutoScroll, setShouldAutoScroll] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true)

    // Use prop for ID
    const selectedSoulprintId = initialSoulprintId

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Initialize: Get user, API Key, load sessions
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
                    const { data: anySP } = await supabase.from('soulprints').select('soulprint_data').eq('user_id', currentUser.id).maybeSingle()
                    existingSoulprint = anySP
                }

                const isDemoUser = currentUser.email?.includes('demo') || currentUser.email === 'elon@soulprint.ai';

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

                // 3. Load Sessions
                await loadSessions()

                // 4. Get API key logic
                if (isDemoUser) {
                    setApiKey('sk-soulprint-demo-internal-key')
                } else {
                    const storedKey = localStorage.getItem("soulprint_internal_key")
                    if (storedKey) {
                        setApiKey(storedKey)
                    } else {
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
    }, [selectedSoulprintId])

    // Load sessions from server
    async function loadSessions() {
        const userSessions = await getChatSessions()
        setSessions(userSessions)
    }

    // Load history when session changes
    useEffect(() => {
        async function loadHistory() {
            if (!currentSessionId) {
                setMessages([])
                return
            }

            setLoading(true)
            const history = await getChatHistory(currentSessionId)

            if (history.length > 0) {
                const formattedHistory = history
                    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                    .map(msg => ({
                        role: msg.role as "user" | "assistant",
                        content: msg.content
                    }))
                setMessages(formattedHistory)
            } else {
                setMessages([])
            }
            setLoading(false)
            setShouldAutoScroll(true) // Scroll to bottom when loading history
        }

        if (user) {
            loadHistory()
        }
    }, [currentSessionId, user])

    // Auto-scroll only when user sends a message (or session loads)
    useEffect(() => {
        if (shouldAutoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
            setShouldAutoScroll(false)
        }
    }, [messages, shouldAutoScroll])

    async function handleSend() {
        if (!input.trim() || !apiKey) return

        const userMsg = input
        setInput("")
        setShouldAutoScroll(true)
        setMessages(prev => [...prev, { role: "user", content: userMsg }])
        setLoading(true)

        // Determine Session ID
        let sessionIdToUse = currentSessionId;
        if (!sessionIdToUse) {
            sessionIdToUse = crypto.randomUUID();
            setCurrentSessionId(sessionIdToUse);
        }

        // Save user message
        await saveChatMessage({
            role: "user",
            content: userMsg,
            session_id: sessionIdToUse
        })

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
                    soulprint_id: selectedSoulprintId,
                    session_id: sessionIdToUse, // Pass session ID to API if needed (though API mostly uses history)
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
            await saveChatMessage({
                role: "assistant",
                content: botMsg,
                session_id: sessionIdToUse
            })

            // Refresh sessions list if it was a new session
            if (!currentSessionId) {
                loadSessions()
            }

        } catch (e) {
            setMessages(prev => [...prev, { role: "assistant", content: "Error: Failed to reply." }])
        } finally {
            setLoading(false)
        }
    }

    async function handleClearHistory() {
        if (confirm("Are you sure? This will delete messages in this session.")) {
            await clearChatHistory(currentSessionId || undefined)
            setMessages([])
            loadSessions() // Refresh list
            if (currentSessionId) setCurrentSessionId(null) // Reset to new chat
        }
    }

    function handleNewChat() {
        setCurrentSessionId(null);
        setMessages([]);
        if (window.innerWidth < 768) setSidebarOpen(false);
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
        <div className="relative flex h-full overflow-hidden rounded-xl border border-[#222]">
            {/* Background (Global) */}
            <div className="absolute inset-0 z-0 opacity-80 pointer-events-none">
                <SoulprintBackground personality={personality} />
            </div>
            <div className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/40" />

            {/* Content Container with Sidebar */}
            <div className="relative z-10 flex h-full w-full bg-[#111]/60 backdrop-blur-sm">

                {/* Session Sidebar */}
                <div className={cn(
                    "flex flex-col border-r border-[#222] bg-[#0A0A0A]/90 transition-all duration-300 ease-in-out md:static absolute inset-y-0 left-0 z-20",
                    sidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full md:w-0 md:translate-x-0 md:opacity-0 md:overflow-hidden"
                )}>
                    <div className="p-4 border-b border-[#222] flex items-center justify-between">
                        <Button
                            onClick={handleNewChat}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white flex gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            New Chat
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {sessions.length === 0 && (
                            <div className="text-xs text-center text-gray-500 py-4">No saved sessions</div>
                        )}
                        {sessions.map((session) => (
                            <button
                                key={session.session_id}
                                onClick={() => {
                                    setCurrentSessionId(session.session_id);
                                    if (window.innerWidth < 768) setSidebarOpen(false);
                                }}
                                className={cn(
                                    "w-full text-left px-3 py-3 rounded-lg text-sm flex items-start gap-3 transition-colors",
                                    currentSessionId === session.session_id
                                        ? "bg-[#222] text-white"
                                        : "text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200"
                                )}
                            >
                                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                                <div className="truncate">
                                    <div className="font-medium truncate">{session.last_message || "New Conversation"}</div>
                                    <div className="text-[10px] text-gray-600 mt-1">
                                        {new Date(session.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                    {/* Toggle Sidebar Button (Mobile/Desktop) */}
                    <div className="absolute left-2 top-2 z-30 md:hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="text-gray-400 hover:text-white bg-black/20 backdrop-blur-sm border border-white/10"
                        >
                            <Menu className="h-4 w-4" />
                        </Button>
                    </div>
                    {/* Toggle Sidebar Button (Desktop only) */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 z-30 hidden md:block">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="h-16 w-4 bg-[#111] border-y border-r border-[#222] rounded-r-md flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#222] transition-colors"
                        >
                            {sidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                    </div>

                    {/* Chat Header */}
                    <div className="flex items-center justify-between border-b border-[#222] p-4 pl-12 md:pl-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                                <Bot className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-white">{displayName}</h2>
                                <p className="text-xs text-gray-500">
                                    {/* Show Session Info if available, else user email */}
                                    {currentSessionId ? 'Active Session' : 'New Session'} • {user?.email}
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

                    {/* Messages Area */}
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

                    {/* Input Area */}
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
        </div>
    )
}
