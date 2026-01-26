"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Send, Loader2, ChevronLeft, Paperclip, Smile, Mic, Menu, Plus, MessageSquare, X, Trash2, Search, Download, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Link from "next/link"
import { useVoiceRecorder } from "./use-voice-recorder"
import "./mobile-chat.css"

// Haptic feedback utility
const haptic = {
    light: () => navigator.vibrate?.(10),
    medium: () => navigator.vibrate?.(25),
    heavy: () => navigator.vibrate?.(50),
    success: () => navigator.vibrate?.([10, 50, 10]),
    error: () => navigator.vibrate?.([50, 30, 50]),
}

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    session_id?: string
}

interface ChatSession {
    session_id: string
    created_at: string
    last_message: string
    message_count: number
}

export function MobileChatClient() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [user, setUser] = useState<{ id?: string; email?: string } | null>(null)
    const [soulprintName, setSoulprintName] = useState("SoulPrint")
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)
    
    // Session management
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [showSidebar, setShowSidebar] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    
    // Filter sessions by search query
    const filteredSessions = sessions.filter(session => 
        session.last_message.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const supabase = createClient()
    const [showScrollButton, setShowScrollButton] = useState(false)
    
    // Voice recording
    const { isRecording, isSupported: voiceSupported, startRecording, stopRecording, transcript } = useVoiceRecorder()
    
    // Update input when voice transcript changes
    useEffect(() => {
        if (transcript) {
            setInput(prev => prev + transcript)
        }
    }, [transcript])

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto"
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"
        }
    }, [input])

    // Handle scroll to show/hide scroll button
    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current
        if (!container) return
        
        const { scrollTop, scrollHeight, clientHeight } = container
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight
        setShowScrollButton(distanceFromBottom > 100)
    }, [])

    const scrollToBottom = useCallback(() => {
        haptic.light()
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [])

    // Load sessions for sidebar
    const loadSessions = useCallback(async (userId: string) => {
        const { data: sessionMessages } = await supabase
            .from("chat_logs")
            .select("session_id, content, created_at, role")
            .eq("user_id", userId)
            .eq("role", "user")
            .not("session_id", "is", null)
            .order("created_at", { ascending: false })

        const sessionsMap = new Map<string, ChatSession>()
        sessionMessages?.forEach(msg => {
            if (msg.session_id && !sessionsMap.has(msg.session_id)) {
                sessionsMap.set(msg.session_id, {
                    session_id: msg.session_id,
                    created_at: msg.created_at,
                    last_message: msg.content.substring(0, 50) + (msg.content.length > 50 ? "..." : ""),
                    message_count: 1
                })
            }
        })

        // Check for legacy messages
        const { data: legacyMsg } = await supabase
            .from("chat_logs")
            .select("content, created_at")
            .eq("user_id", userId)
            .is("session_id", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

        if (legacyMsg) {
            sessionsMap.set("legacy", {
                session_id: "legacy",
                created_at: legacyMsg.created_at,
                last_message: "Previous conversations",
                message_count: 1
            })
        }

        const sessionList = Array.from(sessionsMap.values()).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setSessions(sessionList)
        return sessionList
    }, [supabase])

    // Load messages for a specific session
    const loadSessionMessages = useCallback(async (userId: string, sessionId: string | null) => {
        let query = supabase
            .from("chat_logs")
            .select("id, session_id, role, content, created_at")
            .eq("user_id", userId)

        if (sessionId === "legacy" || sessionId === null) {
            query = query.is("session_id", null)
        } else {
            query = query.eq("session_id", sessionId)
        }

        const { data: history } = await query.order("created_at", { ascending: true })
        
        if (history) {
            setMessages(history.map((m: { id: string; session_id: string | null; role: string; content: string; created_at: string }) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
                timestamp: new Date(m.created_at),
                session_id: m.session_id || undefined
            })))
        } else {
            setMessages([])
        }
    }, [supabase])

    // Create new session
    const createNewSession = useCallback(() => {
        haptic.medium()
        const newSessionId = crypto.randomUUID()
        setCurrentSessionId(newSessionId)
        setMessages([])
        setShowSidebar(false)
    }, [])

    // Switch to a session
    const switchSession = useCallback(async (sessionId: string) => {
        if (!user?.id) return
        haptic.light()
        setCurrentSessionId(sessionId)
        await loadSessionMessages(user.id, sessionId)
        setShowSidebar(false)
    }, [user, loadSessionMessages])

    // Delete a session
    const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation() // Don't trigger session switch
        if (!user?.id) return
        
        haptic.heavy()
        // Confirm deletion
        if (!confirm("Delete this conversation?")) return
        
        haptic.success()
        
        // Delete all messages in this session
        if (sessionId === "legacy") {
            await supabase
                .from("chat_logs")
                .delete()
                .eq("user_id", user.id)
                .is("session_id", null)
        } else {
            await supabase
                .from("chat_logs")
                .delete()
                .eq("user_id", user.id)
                .eq("session_id", sessionId)
        }
        
        // Remove from local state
        setSessions(prev => prev.filter(s => s.session_id !== sessionId))
        
        // If we deleted the current session, switch to another or create new
        if (currentSessionId === sessionId) {
            const remaining = sessions.filter(s => s.session_id !== sessionId)
            if (remaining.length > 0) {
                setCurrentSessionId(remaining[0].session_id)
                await loadSessionMessages(user.id, remaining[0].session_id)
            } else {
                createNewSession()
            }
        }
    }, [user, supabase, currentSessionId, sessions, loadSessionMessages, createNewSession])

    // Export current conversation
    const exportConversation = useCallback(() => {
        if (messages.length === 0) return
        
        haptic.success()
        
        const content = messages.map(msg => {
            const time = msg.timestamp.toLocaleString()
            const role = msg.role === "user" ? "You" : soulprintName
            return `[${time}] ${role}:\n${msg.content}\n`
        }).join("\n---\n\n")
        
        const header = `# ${soulprintName} Conversation\nExported: ${new Date().toLocaleString()}\nMessages: ${messages.length}\n\n---\n\n`
        
        const blob = new Blob([header + content], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${soulprintName}-chat-${new Date().toISOString().split("T")[0]}.txt`
        a.click()
        URL.revokeObjectURL(url)
    }, [messages, soulprintName])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + N: New chat
            if ((e.ctrlKey || e.metaKey) && e.key === "n") {
                e.preventDefault()
                createNewSession()
            }
            // Escape: Close sidebar
            if (e.key === "Escape" && showSidebar) {
                setShowSidebar(false)
            }
            // Ctrl/Cmd + /: Toggle sidebar
            if ((e.ctrlKey || e.metaKey) && e.key === "/") {
                e.preventDefault()
                setShowSidebar(prev => !prev)
            }
        }
        
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [showSidebar, createNewSession])

    // Initialize
    useEffect(() => {
        async function init() {
            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser()
                if (!currentUser) {
                    window.location.href = "/auth/login"
                    return
                }
                setUser(currentUser)

                // Get API key
                const { data: keys } = await supabase
                    .from("api_keys")
                    .select("key")
                    .eq("user_id", currentUser.id)
                    .limit(1)
                
                if (keys && keys.length > 0) {
                    setApiKey(keys[0].key)
                }

                // Get SoulPrint name
                const { data: sp } = await supabase
                    .from("soulprints")
                    .select("soulprint_data")
                    .eq("user_id", currentUser.id)
                    .maybeSingle()
                
                if (sp?.soulprint_data) {
                    const data = typeof sp.soulprint_data === "string" 
                        ? JSON.parse(sp.soulprint_data) 
                        : sp.soulprint_data
                    if (data.metadata?.displayName) {
                        setSoulprintName(data.metadata.displayName)
                    }
                }

                // Load sessions
                const sessionList = await loadSessions(currentUser.id)
                
                // Start with most recent session or create new one
                if (sessionList.length > 0) {
                    const mostRecent = sessionList[0]
                    setCurrentSessionId(mostRecent.session_id)
                    await loadSessionMessages(currentUser.id, mostRecent.session_id)
                } else {
                    // Create a new session for first-time users
                    setCurrentSessionId(crypto.randomUUID())
                }
            } catch (err) {
                console.error("Init error:", err)
            } finally {
                setIsInitializing(false)
            }
        }
        init()
    }, [supabase, loadSessions, loadSessionMessages])

    const sendMessage = useCallback(async () => {
        if (!input.trim() || isLoading || !apiKey) return
        haptic.light()

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
            session_id: currentSessionId || undefined
        }

        setMessages(prev => [...prev, userMessage])
        setInput("")
        setIsLoading(true)

        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = "auto"
        }

        try {
            // Save user message with session_id
            if (user?.id) {
                await supabase.from("chat_logs").insert({
                    user_id: user.id,
                    session_id: currentSessionId,
                    role: "user",
                    content: userMessage.content
                })
            }

            // Call chat API
            const response = await fetch("/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    stream: true
                })
            })

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`)
            }

            // Handle streaming response
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            
            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "",
                timestamp: new Date()
            }
            
            setMessages(prev => [...prev, assistantMessage])

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value)
                    const lines = chunk.split("\n")

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6)
                            if (data === "[DONE]") continue

                            try {
                                const parsed = JSON.parse(data)
                                const content = parsed.choices?.[0]?.delta?.content
                                if (content) {
                                    assistantMessage.content += content
                                    setMessages(prev => 
                                        prev.map(m => 
                                            m.id === assistantMessage.id 
                                                ? { ...m, content: assistantMessage.content }
                                                : m
                                        )
                                    )
                                }
                            } catch {
                                // Skip malformed JSON
                            }
                        }
                    }
                }
            }

            // Save assistant message with session_id
            if (user?.id && assistantMessage.content) {
                await supabase.from("chat_logs").insert({
                    user_id: user.id,
                    session_id: currentSessionId,
                    role: "assistant",
                    content: assistantMessage.content
                })
                
                // Refresh sessions list to show updated last message
                loadSessions(user.id)
            }

        } catch (err) {
            console.error("Send error:", err)
            const errorMessage = err instanceof Error && err.message.includes("401") 
                ? "Invalid API key. Please check your settings."
                : err instanceof Error && err.message.includes("429")
                ? "Rate limit reached. Please wait a moment."
                : "AI is temporarily unavailable. Please try again."
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: "assistant",
                content: errorMessage,
                timestamp: new Date()
            }])
        } finally {
            setIsLoading(false)
        }
    }, [input, isLoading, apiKey, messages, user, supabase, currentSessionId, loadSessions])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    if (isInitializing) {
        return (
            <div className="mobile-chat-container flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        )
    }

    return (
        <div className="mobile-chat-container">
            {/* Session Sidebar */}
            <div className={cn("session-sidebar", showSidebar && "open")}>
                <div className="sidebar-header">
                    <h2>Conversations</h2>
                    <button onClick={() => setShowSidebar(false)} className="sidebar-close">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <button onClick={createNewSession} className="new-chat-btn">
                    <Plus className="h-5 w-5" />
                    <span>New Chat</span>
                </button>
                
                {sessions.length > 2 && (
                    <div className="sidebar-search">
                        <Search className="h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="search-clear">
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                )}
                
                <div className="session-list">
                    {filteredSessions.map(session => (
                        <div
                            key={session.session_id}
                            onClick={() => switchSession(session.session_id)}
                            className={cn(
                                "session-item",
                                currentSessionId === session.session_id && "active"
                            )}
                        >
                            <MessageSquare className="h-4 w-4 flex-shrink-0" />
                            <div className="session-info">
                                <span className="session-preview">{session.last_message}</span>
                                <span className="session-date">
                                    {new Date(session.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <button 
                                onClick={(e) => deleteSession(session.session_id, e)}
                                className="session-delete"
                                title="Delete conversation"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    {filteredSessions.length === 0 && searchQuery && (
                        <p className="no-sessions">No matches found</p>
                    )}
                    {sessions.length === 0 && (
                        <p className="no-sessions">No conversations yet</p>
                    )}
                </div>
            </div>
            
            {/* Sidebar Overlay */}
            {showSidebar && (
                <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />
            )}

            {/* Header - Telegram style */}
            <header className="mobile-chat-header">
                <button onClick={() => setShowSidebar(true)} className="header-menu">
                    <Menu className="h-6 w-6" />
                </button>
                
                <div className="header-center">
                    <span className="header-name">{soulprintName}</span>
                    {isLoading && (
                        <span className="header-status typing">typing...</span>
                    )}
                </div>

                <div className="header-actions">
                    {messages.length > 0 && (
                        <button onClick={exportConversation} className="header-export" title="Export Chat">
                            <Download className="h-5 w-5" />
                        </button>
                    )}
                    <button onClick={createNewSession} className="header-new-chat" title="New Chat">
                        <Plus className="h-5 w-5" />
                    </button>
                </div>
            </header>

            {/* Messages Area */}
            <main 
                ref={messagesContainerRef}
                className="mobile-chat-messages"
                onScroll={handleScroll}
            >
                {messages.length === 0 ? (
                    <div className="mobile-empty-state">
                        <div className="empty-avatar">
                            <img src="/logo.svg" alt="SoulPrint" className="h-14 w-14" />
                        </div>
                        <h2 className="empty-title">{soulprintName}</h2>
                        <p className="empty-subtitle">
                            {!apiKey ? "Setting up..." : "Start a new conversation"}
                        </p>
                        {!apiKey ? (
                            <p className="empty-hint">
                                Go to Settings to create an API key
                            </p>
                        ) : (
                            <>
                                <p className="empty-hint">
                                    Tap a suggestion or type your own
                                </p>
                                <div className="starter-prompts">
                                    {[
                                        "Tell me about yourself",
                                        "What can you help me with?",
                                        "Let's brainstorm ideas",
                                        "How are you today?"
                                    ].map((prompt) => (
                                        <button 
                                            key={prompt}
                                            className="starter-prompt"
                                            onClick={() => {
                                                setInput(prompt)
                                                inputRef.current?.focus()
                                            }}
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <MessageBubble 
                            key={msg.id} 
                            message={msg} 
                            soulprintName={soulprintName}
                            isConsecutive={idx > 0 && messages[idx - 1].role === msg.role}
                        />
                    ))
                )}
                
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <TypingIndicator />
                )}
                
                <div ref={messagesEndRef} />
                
                {/* Scroll to bottom button */}
                {showScrollButton && (
                    <button 
                        className="scroll-to-bottom"
                        onClick={scrollToBottom}
                        title="Scroll to bottom"
                    >
                        <ChevronDown className="h-5 w-5" />
                    </button>
                )}
            </main>

            {/* Input Area - Telegram style */}
            <footer className="mobile-chat-input">
                <button className="input-icon-btn">
                    <Paperclip className="h-5 w-5" />
                </button>
                
                <div className="input-field-wrapper">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Message"
                        disabled={isLoading || !apiKey}
                        rows={1}
                        className="input-field"
                    />
                    <button className="input-emoji-btn">
                        <Smile className="h-5 w-5" />
                    </button>
                </div>

                {input.trim() ? (
                    <button
                        onClick={sendMessage}
                        disabled={isLoading || !apiKey}
                        className="send-btn"
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Send className="h-5 w-5" />
                        )}
                    </button>
                ) : voiceSupported ? (
                    <button 
                        className={cn("voice-logo-btn", isRecording && "recording")}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecording}
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onMouseLeave={() => isRecording && stopRecording()}
                        title="Hold to speak"
                    >
                        {isRecording ? (
                            <Mic className="h-5 w-5 text-white animate-pulse" />
                        ) : (
                            <img src="/logo.svg" alt="Voice" className="h-6 w-6" />
                        )}
                    </button>
                ) : (
                    <button className="voice-logo-btn" disabled title="Voice not supported">
                        <img src="/logo.svg" alt="Voice" className="h-6 w-6 opacity-50" />
                    </button>
                )}
            </footer>
        </div>
    )
}

// Message Bubble Component
function MessageBubble({ 
    message, 
    soulprintName,
    isConsecutive 
}: { 
    message: Message
    soulprintName: string
    isConsecutive: boolean
}) {
    const [copied, setCopied] = useState(false)
    const [liked, setLiked] = useState(false)
    const [showHeart, setShowHeart] = useState(false)
    const lastTapRef = useRef(0)
    const isUser = message.role === "user"
    const time = message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    const handleTap = async () => {
        const now = Date.now()
        const timeSinceLastTap = now - lastTapRef.current
        
        if (timeSinceLastTap < 300) {
            // Double tap - toggle like
            haptic.medium()
            setLiked(prev => !prev)
            setShowHeart(true)
            setTimeout(() => setShowHeart(false), 800)
        } else {
            // Single tap - copy
            try {
                haptic.success()
                await navigator.clipboard.writeText(message.content)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
            } catch (err) {
                console.error("Failed to copy:", err)
            }
        }
        
        lastTapRef.current = now
    }

    return (
        <div className={cn(
            "message-row",
            isUser ? "user" : "assistant",
            isConsecutive && "consecutive"
        )}>
            <div 
                className={cn(
                    "message-bubble",
                    isUser ? "user" : "assistant",
                    isConsecutive && "consecutive",
                    copied && "copied"
                )}
                onClick={handleTap}
                title="Tap to copy, double-tap to like"
            >
                {copied && (
                    <span className="copy-toast">Copied!</span>
                )}
                
                {showHeart && (
                    <span className="heart-burst">❤️</span>
                )}
                
                {!isUser && !isConsecutive && (
                    <span className="bubble-name">{soulprintName}</span>
                )}
                
                {isUser ? (
                    <p className="bubble-text">{message.content}</p>
                ) : (
                    <div className="bubble-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                        </ReactMarkdown>
                    </div>
                )}
                
                <div className="bubble-footer">
                    {liked && <span className="liked-heart">❤️</span>}
                    <span className={cn("bubble-time", isUser ? "user" : "assistant")}>
                        {time}
                    </span>
                </div>
            </div>
        </div>
    )
}

// Typing Indicator
function TypingIndicator() {
    return (
        <div className="message-row assistant">
            <div className="message-bubble assistant typing">
                <span className="typing-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                </span>
            </div>
        </div>
    )
}
