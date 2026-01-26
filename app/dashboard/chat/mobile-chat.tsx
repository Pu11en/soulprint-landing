"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageSquare, Menu, Send, Mic, MicOff, Plus, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { listApiKeys } from "@/app/actions/api-keys"
import { getChatHistory, saveChatMessage, clearChatHistory, getChatSessions, type ChatSession } from "@/app/actions/chat-history"
import { createClient } from "@/lib/supabase/client"
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
    const [selectedSoulprintId, setSelectedSoulprintId] = useState<string | null>(initialSoulprintId)
    
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const {
        isListening,
        transcript,
        interimTranscript,
        isSupported,
        startListening,
        stopListening,
        resetTranscript,
    } = useSpeechRecognition()

    // Auto-scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [])

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom()
        }
    }, [messages, scrollToBottom])

    // Update input when transcript changes
    useEffect(() => {
        if (transcript) {
            setInput(prev => prev + (prev ? " " : "") + transcript)
            resetTranscript()
        }
    }, [transcript, resetTranscript])

    // Initialize
    useEffect(() => {
        async function init() {
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                
                if (!user) return

                // Get API key
                const result = await listApiKeys()
                if (result.keys) {
                    const activeKey = result.keys.find(k => k.status === "active")
                    if (activeKey?.raw_key) {
                        setApiKey(activeKey.raw_key)
                    }
                }

                // Get soulprint name
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

                // Get sessions
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

    // Load session messages
    useEffect(() => {
        async function loadSession() {
            if (!currentSessionId) {
                setMessages([])
                return
            }
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

        // Generate session ID if needed
        const sessionId = currentSessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        if (!currentSessionId) setCurrentSessionId(sessionId)

        try {
            // Save user message
            await saveChatMessage({
                session_id: sessionId,
                role: "user",
                content: userMessage
            })

            // Call API
            const res = await fetch("/api/llm/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    stream: true,
                    soulprint_id: selectedSoulprintId,
                    session_id: sessionId,
                    messages: [
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { role: "user", content: userMessage }
                    ]
                })
            })

            if (!res.ok) throw new Error("API error")

            // Stream response
            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            let assistantContent = ""

            setMessages(prev => [...prev, { role: "assistant", content: "" }])

            while (reader) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split("\n")

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6)
                        if (data === "[DONE]") continue
                        try {
                            const parsed = JSON.parse(data)
                            const delta = parsed.choices?.[0]?.delta?.content
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

            // Save assistant message
            if (assistantContent) {
                await saveChatMessage({
                    session_id: sessionId,
                    role: "assistant",
                    content: assistantContent
                })
            }

        } catch (err) {
            console.error("Send error:", err)
            setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }])
        } finally {
            setLoading(false)
        }
    }

    const handleNewChat = () => {
        setCurrentSessionId(null)
        setMessages([])
        setSidebarOpen(false)
        setMenuOpen(false)
    }

    const handleClear = async () => {
        if (!currentSessionId) return
        await clearChatHistory(currentSessionId)
        setMessages([])
        setMenuOpen(false)
    }

    const handleVoice = () => {
        if (isListening) {
            stopListening()
        } else {
            startListening()
        }
    }

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value)
        e.target.style.height = "auto"
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
    }

    if (initializing) {
        return (
            <div className="flex h-full items-center justify-center bg-black">
                <div className="flex items-center gap-2 text-zinc-400">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                    <span>Loading...</span>
                </div>
            </div>
        )
    }

    const hasMessages = messages.length > 0

    return (
        <div className="flex flex-col h-full bg-black">
            {/* Header */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors"
                >
                    <MessageSquare className="w-5 h-5 text-zinc-300" />
                </button>
                
                <span className="text-base font-medium text-white">{displayName}</span>
                
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors"
                >
                    <Menu className="w-5 h-5 text-zinc-300" />
                </button>
            </header>

            {/* Menu Dropdown */}
            {menuOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-4 top-14 z-50 w-48 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl py-1">
                        <button
                            onClick={handleNewChat}
                            className="w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 flex items-center gap-3"
                        >
                            <Plus className="w-4 h-4 text-orange-500" />
                            New Chat
                        </button>
                        {hasMessages && (
                            <button
                                onClick={handleClear}
                                className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-3"
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear Chat
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Sidebar */}
            {sidebarOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40 bg-black/60" 
                        onClick={() => setSidebarOpen(false)} 
                    />
                    <div className="fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                            <span className="font-medium text-white">Conversations</span>
                            <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-zinc-800 rounded">
                                <X className="w-5 h-5 text-zinc-400" />
                            </button>
                        </div>
                        <div className="p-3">
                            <button
                                onClick={handleNewChat}
                                className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                New Chat
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {sessions.length === 0 ? (
                                <p className="text-center text-zinc-500 text-sm py-8">No conversations yet</p>
                            ) : (
                                sessions.map(session => (
                                    <button
                                        key={session.session_id}
                                        onClick={() => {
                                            setCurrentSessionId(session.session_id)
                                            setSidebarOpen(false)
                                        }}
                                        className={cn(
                                            "w-full px-3 py-2.5 rounded-lg text-left text-sm truncate transition-colors",
                                            currentSessionId === session.session_id
                                                ? "bg-orange-600/20 text-orange-400"
                                                : "text-zinc-300 hover:bg-zinc-800"
                                        )}
                                    >
                                        {session.last_message?.slice(0, 30) || "New conversation"}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
                {!hasMessages ? (
                    <div className="h-full flex flex-col items-center justify-center px-6">
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-semibold text-white mb-2">Hey there 👋</h1>
                            <p className="text-zinc-400">What&apos;s on your mind?</p>
                        </div>
                    </div>
                ) : (
                    <div className="px-4 py-4 space-y-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "max-w-[85%]",
                                    msg.role === "user" ? "ml-auto" : "mr-auto"
                                )}
                            >
                                <div
                                    className={cn(
                                        "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                                        msg.role === "user"
                                            ? "bg-orange-600 text-white rounded-br-md"
                                            : "bg-zinc-800 text-zinc-100 rounded-bl-md"
                                    )}
                                >
                                    {msg.role === "assistant" ? (
                                        <div className="prose prose-sm prose-invert max-w-none [&>*:last-child]:mb-0">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content || "..."}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <span className="whitespace-pre-wrap">{msg.content}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && messages[messages.length - 1]?.role !== "assistant" && (
                            <div className="max-w-[85%] mr-auto">
                                <div className="bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900 p-3">
                <div className={cn(
                    "flex items-end gap-2 rounded-2xl bg-zinc-800 px-3 py-2",
                    isListening && "ring-2 ring-red-500"
                )}>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                        placeholder={isListening ? "Listening..." : "Message"}
                        className="flex-1 bg-transparent text-white text-[15px] placeholder:text-zinc-500 resize-none focus:outline-none min-h-[24px] max-h-[120px] py-1"
                        rows={1}
                        disabled={loading}
                    />
                    
                    {input.trim() ? (
                        <button
                            onClick={handleSend}
                            disabled={loading}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-600 hover:bg-orange-500 text-white transition-colors disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    ) : isSupported ? (
                        <button
                            onClick={handleVoice}
                            className={cn(
                                "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                                isListening 
                                    ? "bg-red-500 text-white" 
                                    : "text-zinc-400 hover:text-zinc-200"
                            )}
                        >
                            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                    ) : null}
                </div>
                
                {isListening && (
                    <div className="flex items-center justify-center gap-2 mt-2 text-xs text-red-400">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        {interimTranscript || "Listening..."}
                    </div>
                )}
            </div>
        </div>
    )
}
