"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageSquare, Menu, Plus, Trash2, X, Send, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { listApiKeys } from "@/app/actions/api-keys"
import { getChatHistory, saveChatMessage, clearChatHistory, getChatSessions, type ChatSession } from "@/app/actions/chat-history"
import { createClient } from "@/lib/supabase/client"

interface Message {
    role: "user" | "assistant" | "system"
    content: string
}

export function MobileChat({ initialSoulprintId }: { initialSoulprintId: string | null }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [initializing, setInitializing] = useState(true)
    const [displayName, setDisplayName] = useState("SoulPrint")
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [selectedSoulprintId] = useState<string | null>(initialSoulprintId)
    const [isAtBottom, setIsAtBottom] = useState(true)

    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Scroll handling
    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        messagesEndRef.current?.scrollIntoView({ behavior })
    }, [])

    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current
        if (!container) return
        const { scrollTop, scrollHeight, clientHeight } = container
        setIsAtBottom(scrollHeight - scrollTop - clientHeight < 100)
    }, [])

    useEffect(() => {
        if (isAtBottom) scrollToBottom("instant")
    }, [messages, isAtBottom, scrollToBottom])

    // Initialize
    useEffect(() => {
        async function init() {
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const result = await listApiKeys()
                if (result.keys) {
                    const activeKey = result.keys.find(k => k.status === "active")
                    if (activeKey?.raw_key) setApiKey(activeKey.raw_key)
                }

                if (selectedSoulprintId) {
                    const { data: soulprint } = await supabase
                        .from('soulprints')
                        .select('soulprint_data')
                        .eq('id', selectedSoulprintId)
                        .single()
                    if (soulprint?.soulprint_data) {
                        const name = (soulprint.soulprint_data as { display_name?: string }).display_name
                        if (name) setDisplayName(name)
                    }
                }

                const sessionsData = await getChatSessions()
                setSessions(sessionsData)
            } catch (err) {
                console.error("Init error:", err)
            } finally {
                setInitializing(false)
            }
        }
        init()
    }, [selectedSoulprintId])

    // Load session
    useEffect(() => {
        async function loadSession() {
            if (!currentSessionId) { setMessages([]); return }
            const history = await getChatHistory(currentSessionId)
            setMessages(history)
        }
        loadSession()
    }, [currentSessionId])

    const handleSend = async () => {
        if (!input.trim() || loading || !apiKey) return
        const userMessage = input.trim()
        setInput("")
        setMessages(prev => [...prev, { role: "user", content: userMessage }])
        setLoading(true)

        const sessionId = currentSessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        if (!currentSessionId) setCurrentSessionId(sessionId)

        try {
            await saveChatMessage({ session_id: sessionId, role: "user", content: userMessage })

            const res = await fetch("/api/llm/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: "gpt-4o", stream: true, soulprint_id: selectedSoulprintId, session_id: sessionId,
                    messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: "user", content: userMessage }]
                })
            })

            if (!res.ok) throw new Error("API error")

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            let assistantContent = ""
            setMessages(prev => [...prev, { role: "assistant", content: "" }])

            while (reader) {
                const { done, value } = await reader.read()
                if (done) break
                const chunk = decoder.decode(value, { stream: true })
                for (const line of chunk.split("\n")) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6)
                        if (data === "[DONE]") continue
                        try {
                            const delta = JSON.parse(data).choices?.[0]?.delta?.content
                            if (delta) {
                                assistantContent += delta
                                setMessages(prev => {
                                    const updated = [...prev]
                                    updated[updated.length - 1] = { role: "assistant", content: assistantContent }
                                    return updated
                                })
                            }
                        } catch {}
                    }
                }
            }

            if (assistantContent) {
                await saveChatMessage({ session_id: sessionId, role: "assistant", content: assistantContent })
            }
        } catch (err) {
            console.error("Send error:", err)
            setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong." }])
        } finally {
            setLoading(false)
        }
    }

    const handleNewChat = () => { setCurrentSessionId(null); setMessages([]); setSidebarOpen(false); setMenuOpen(false) }
    const handleClear = async () => { if (currentSessionId) { await clearChatHistory(currentSessionId); setMessages([]) } setMenuOpen(false) }

    if (initializing) {
        return (
            <div className="flex h-dvh items-center justify-center bg-[#0a0a0a]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] overscroll-none">
            {/* HEADER - Fixed */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 h-14 border-b border-zinc-800 bg-[#111]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
                <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 hover:bg-zinc-800 rounded-full">
                    <MessageSquare className="w-5 h-5 text-zinc-300" />
                </button>
                <span className="text-base font-semibold text-white">{displayName}</span>
                <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 -mr-2 hover:bg-zinc-800 rounded-full">
                    <Menu className="w-5 h-5 text-zinc-300" />
                </button>
            </header>

            {/* Menu Dropdown */}
            {menuOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="fixed right-4 top-16 z-50 w-44 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl py-1">
                        <button onClick={handleNewChat} className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-800 flex items-center gap-3">
                            <Plus className="w-4 h-4 text-orange-500" /> New Chat
                        </button>
                        {messages.length > 0 && (
                            <button onClick={handleClear} className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-3">
                                <Trash2 className="w-4 h-4" /> Clear
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Sidebar */}
            {sidebarOpen && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setSidebarOpen(false)} />
                    <div className="fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                            <span className="font-medium text-white">Chats</span>
                            <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-zinc-800 rounded"><X className="w-5 h-5 text-zinc-400" /></button>
                        </div>
                        <div className="p-3">
                            <button onClick={handleNewChat} className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" /> New Chat
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {sessions.length === 0 ? (
                                <p className="text-center text-zinc-500 text-sm py-8">No chats yet</p>
                            ) : sessions.map(s => (
                                <button key={s.session_id} onClick={() => { setCurrentSessionId(s.session_id); setSidebarOpen(false) }}
                                    className={cn("w-full px-3 py-2 rounded-lg text-left text-sm truncate", currentSessionId === s.session_id ? "bg-orange-600/20 text-orange-400" : "text-zinc-300 hover:bg-zinc-800")}>
                                    {s.last_message?.slice(0, 28) || "New chat"}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* MESSAGES - Scrollable (Vercel pattern) */}
            <div className="relative flex-1 min-h-0">
                <div ref={messagesContainerRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto overscroll-contain touch-pan-y">
                    <div className="flex flex-col gap-3 p-4 min-h-full">
                        {messages.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                <h2 className="text-xl font-semibold text-white mb-1">Hey 👋</h2>
                                <p className="text-zinc-500 text-sm">What&apos;s on your mind?</p>
                            </div>
                        ) : (
                            messages.filter(m => m.role !== "system").map((msg, i) => (
                                <div key={i} className={cn("max-w-[85%]", msg.role === "user" ? "self-end" : "self-start")}>
                                    <div className={cn("rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                                        msg.role === "user" ? "bg-orange-600 text-white rounded-br-sm" : "bg-zinc-800 text-zinc-100 rounded-bl-sm")}>
                                        {msg.content || "..."}
                                    </div>
                                </div>
                            ))
                        )}
                        {loading && (
                            <div className="self-start max-w-[85%]">
                                <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-1" />
                    </div>
                </div>

                {/* Scroll to bottom button */}
                {!isAtBottom && messages.length > 0 && (
                    <button onClick={() => scrollToBottom()} className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 bg-zinc-800 border border-zinc-700 rounded-full shadow-lg">
                        <ArrowDown className="w-4 h-4 text-zinc-300" />
                    </button>
                )}
            </div>

            {/* INPUT - Fixed */}
            <div className="flex-shrink-0 border-t border-zinc-800 bg-[#111] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex items-end gap-2 bg-zinc-800 rounded-2xl px-3 py-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px" }}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                        placeholder="Message"
                        className="flex-1 bg-transparent text-white text-[15px] placeholder:text-zinc-500 resize-none focus:outline-none min-h-[24px] max-h-[120px] py-1"
                        rows={1}
                    />
                    <button onClick={handleSend} disabled={!input.trim() || loading}
                        className={cn("p-2 rounded-full transition-colors", input.trim() ? "bg-orange-600 text-white" : "text-zinc-500")}>
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}
