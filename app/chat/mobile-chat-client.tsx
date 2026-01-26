"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Send, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import "./mobile-chat.css"

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
}

export function MobileChatClient() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [user, setUser] = useState<{ id?: string; email?: string } | null>(null)
    const [soulprintName, setSoulprintName] = useState("SoulPrint")
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)
    
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const supabase = createClient()

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

                // Load chat history
                const { data: history } = await supabase
                    .from("chat_logs")
                    .select("*")
                    .eq("user_id", currentUser.id)
                    .order("created_at", { ascending: true })
                    .limit(50)
                
                if (history) {
                    setMessages(history.map((m: { id: string; role: string; content: string; created_at: string }) => ({
                        id: m.id,
                        role: m.role as "user" | "assistant",
                        content: m.content,
                        timestamp: new Date(m.created_at)
                    })))
                }
            } catch (err) {
                console.error("Init error:", err)
            } finally {
                setIsInitializing(false)
            }
        }
        init()
    }, [supabase])

    const sendMessage = useCallback(async () => {
        if (!input.trim() || isLoading || !apiKey) return

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: input.trim(),
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput("")
        setIsLoading(true)

        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = "auto"
        }

        try {
            // Save user message
            if (user?.id) {
                await supabase.from("chat_logs").insert({
                    user_id: user.id,
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

            // Save assistant message
            if (user?.id && assistantMessage.content) {
                await supabase.from("chat_logs").insert({
                    user_id: user.id,
                    role: "assistant",
                    content: assistantMessage.content
                })
            }

        } catch (err) {
            console.error("Send error:", err)
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "Sorry, something went wrong. Please try again.",
                timestamp: new Date()
            }])
        } finally {
            setIsLoading(false)
        }
    }, [input, isLoading, apiKey, messages, user, supabase])

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
            {/* Header - Clean, minimal */}
            <header className="mobile-chat-header">
                <div className="mobile-logo">
                    <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="mobile-header-title">{soulprintName}</span>
            </header>

            {/* Messages Area */}
            <main className="mobile-chat-messages">
                {messages.length === 0 ? (
                    <div className="mobile-empty-state">
                        <div className="mobile-logo large mb-4">
                            <Sparkles className="h-10 w-10 text-white" />
                        </div>
                        <p className="text-zinc-500 text-sm">Start a conversation</p>
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
            </main>

            {/* Input Area */}
            <footer className="mobile-chat-input">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message"
                    disabled={isLoading || !apiKey}
                    rows={1}
                    className="mobile-textarea"
                />
                <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim() || !apiKey}
                    className="mobile-send-btn"
                >
                    {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Send className="h-5 w-5" />
                    )}
                </button>
            </footer>
        </div>
    )
}

// Message Bubble Component - Telegram style with consecutive message support
function MessageBubble({ 
    message, 
    soulprintName,
    isConsecutive 
}: { 
    message: Message
    soulprintName: string
    isConsecutive: boolean
}) {
    const isUser = message.role === "user"
    const time = message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    return (
        <div className={cn(
            "mobile-message",
            isUser ? "user" : "assistant",
            isConsecutive && "consecutive"
        )}>
            <div className={cn(
                "mobile-bubble",
                isUser ? "user" : "assistant",
                isConsecutive && "consecutive"
            )}>
                {!isUser && !isConsecutive && (
                    <span className="mobile-bubble-name">{soulprintName}</span>
                )}
                
                {isUser ? (
                    <p className="mobile-bubble-text">{message.content}</p>
                ) : (
                    <div className="mobile-bubble-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                        </ReactMarkdown>
                    </div>
                )}
                
                <span className={cn("mobile-bubble-time", isUser ? "user" : "assistant")}>
                    {time}
                </span>
            </div>
        </div>
    )
}

// Typing Indicator - Simple dots
function TypingIndicator() {
    return (
        <div className="mobile-message assistant">
            <div className="mobile-bubble assistant typing">
                <div className="mobile-typing">
                    <span className="mobile-typing-dot" />
                    <span className="mobile-typing-dot" />
                    <span className="mobile-typing-dot" />
                </div>
            </div>
        </div>
    )
}
