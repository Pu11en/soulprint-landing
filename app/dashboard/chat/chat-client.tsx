"use client"

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { listApiKeys } from "@/app/actions/api-keys"
import { getChatHistory, saveChatMessage, clearChatHistory, getChatSessions, type ChatSession } from "@/app/actions/chat-history"
import {
    Bot, Loader2, Trash2, Plus, MessageSquare,
    ChevronLeft, ChevronRight,
    ChevronsUpDown, X, Download, FileJson, FileText, FileCode,
    Sparkles, User
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getSoulprintTheme, type SoulprintTheme } from "@/lib/soulprint-theme"
import { TelegramChatMessage } from "./telegram-chat-message"
import { TelegramChatInput } from "./telegram-chat-input"
// import { toast } from "@/components/ui/use-toast"

interface Message {
    role: "user" | "assistant"
    content: string
}

interface SuggestionCard {
    title: string
    description: string
    prompt: string
    isPersonalized?: boolean
}

const defaultSuggestions: SuggestionCard[] = [
    {
        title: "Summarize Text",
        description: "Turn Articles into easy-to-read summaries.",
        prompt: "Please summarize the following text for me:"
    },
    {
        title: "Social Media Post",
        description: "Get help creating your next social media post.",
        prompt: "Help me create an engaging social media post about:"
    },
    {
        title: "Analyze Spreadsheet",
        description: "Take a deep dive into your excel documents.",
        prompt: "Help me analyze this spreadsheet data:"
    }
]

// Generate personalized suggestions from past chat sessions (based on user's messages)
function generatePersonalizedSuggestions(sessions: ChatSession[]): SuggestionCard[] {
    if (!sessions || sessions.length === 0) return []

    const personalized: SuggestionCard[] = []

    // Get the 3 most recent sessions with meaningful user content
    const recentSessions = sessions
        .filter(s => s.last_message && s.last_message.length > 10 && s.session_id !== 'legacy')
        .slice(0, 3)

    for (const session of recentSessions) {
        const userMsg = session.last_message || ""
        // Clean up and summarize the user's question/topic
        const cleanedTopic = userMsg
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

        // Create a cleaner title - capitalize first letter, limit length
        const displayTitle = cleanedTopic.length > 40
            ? cleanedTopic.slice(0, 40).trim() + '...'
            : cleanedTopic

        personalized.push({
            title: displayTitle.charAt(0).toUpperCase() + displayTitle.slice(1),
            description: "Continue this conversation",
            prompt: userMsg, // Send the original user message as context
            isPersonalized: true
        })
    }

    return personalized
}

export function ChatClient({ initialSoulprintId }: { initialSoulprintId: string | null }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [smartSuggestions, setSmartSuggestions] = useState<SuggestionCard[]>(defaultSuggestions)
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [initializing, setInitializing] = useState(true)
    const [user, setUser] = useState<{ id?: string; email?: string } | null>(null)
    const [, setPersonality] = useState<string>("Default System")
    const [displayName, setDisplayName] = useState<string>("SoulPrint")
    const [shouldAutoScroll, setShouldAutoScroll] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [exportMenuOpen, setExportMenuOpen] = useState(false)
    const [coachingMode] = useState(false)
    const [coachingGoal] = useState<string | null>(null)
    const [soulprintTheme, setSoulprintTheme] = useState<SoulprintTheme>(() => getSoulprintTheme(null))

    // Initialize sidebar state based on screen width
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
            setSidebarOpen(true)
        }
    }, [])

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
                        setSoulprintTheme(getSoulprintTheme(soulprintData))

                        const personalityStr =
                            soulprintData?.full_system_prompt ||
                            soulprintData?.profile_summary?.archetype ||
                            soulprintData?.profile_summary?.core_essence ||
                            currentUser.email ||
                            'Default System'
                        setPersonality(personalityStr)
                    }
                } catch {
                    setPersonality(currentUser.email || 'Default System')
                    setDisplayName("SoulPrint")
                    setSoulprintTheme(getSoulprintTheme(null))
                }

                // 3. Load Sessions
                await loadSessions()

                // 4. Get API key
                const storedKey = localStorage.getItem("soulprint_internal_key")
                if (storedKey && storedKey.startsWith('sk-soulprint-')) {
                    console.log('[Chat] Using stored API key from localStorage')
                    setApiKey(storedKey)
                } else {
                    console.log('[Chat] Fetching API key from server...')
                    const { keys, error: keyError } = await listApiKeys()
                    if (keyError) {
                        console.error('[Chat] Failed to list API keys:', keyError)
                    }
                    if (keys && keys.length > 0 && keys[0].encrypted_key) {
                        console.log('[Chat] Got API key from server, storing in localStorage')
                        localStorage.setItem("soulprint_internal_key", keys[0].encrypted_key)
                        setApiKey(keys[0].encrypted_key)
                    } else {
                        console.error('[Chat] No valid API key found. Keys:', keys)
                    }
                }

            } catch (error) {
                console.error('❌ Initialization error:', error)
            } finally {
                setInitializing(false)
            }
        }

        init()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSoulprintId])

    // Load sessions from server
    async function loadSessions() {
        const userSessions = await getChatSessions()
        setSessions(userSessions)

        // Generate personalized suggestions based on chat history
        const personalized = generatePersonalizedSuggestions(userSessions)
        if (personalized.length > 0) {
            // Show personalized suggestions first, then fill with defaults
            const combined = [...personalized, ...defaultSuggestions].slice(0, 3)
            setSmartSuggestions(combined)
        } else {
            setSmartSuggestions(defaultSuggestions)
        }
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



    const handleSend = useCallback(async (userMsg: string) => {
        if (!userMsg.trim()) {
            console.warn('[Chat] Empty message, skipping')
            return
        }
        
        if (!apiKey) {
            console.error('[Chat] No API key available! Cannot send message.')
            alert('No API key found. Please refresh the page or check your settings.')
            return
        }
        
        console.log('[Chat] Sending message with API key:', apiKey.substring(0, 20) + '...')

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
                    session_id: sessionIdToUse,
                    coaching_mode: coachingMode,
                    coaching_goal: coachingGoal,
                    messages: [
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { role: "user", content: userMsg }
                    ]
                })
            })

            if (!res.ok) {
                const errorText = await res.text()
                console.error('Chat API Error:', res.status, errorText)
                
                // Specific error handling
                if (res.status === 401) {
                    throw new Error("Invalid API key. Please check your Settings.")
                } else if (res.status === 429) {
                    throw new Error("Rate limit exceeded. Please try again in a moment.")
                } else if (res.status === 500) {
                    throw new Error("AI service temporarily unavailable. Please try again.")
                } else {
                    throw new Error(`Server error: ${res.status}`)
                }
            }

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            let botMsg = ""
            let buffer = "" // Buffer for incomplete lines

            setMessages(prev => [...prev, { role: "assistant", content: "" }])

            if (reader) {
                let streamTimeout = setTimeout(() => {
                    if (botMsg.length === 0) {
                        console.error('Stream timeout - no content received')
                        setMessages(prev => {
                            const newMessages = [...prev]
                            const lastMsg = newMessages[newMessages.length - 1]
                            if (lastMsg.role === "assistant") {
                                lastMsg.content = "🤖 I'm experiencing connection issues. Please try again."
                            }
                            return newMessages
                        })
                    }
                }, 30000) // 30 second timeout

                // Helper to process SSE lines
                const processLine = (line: string) => {
                    const trimmedLine = line.trim()
                    console.log('[Chat] Processing line:', trimmedLine.substring(0, 80))
                    if (trimmedLine.startsWith("data: ")) {
                        const dataStr = trimmedLine.slice(6)
                        if (dataStr === "[DONE]") {
                            console.log('[Chat] Received [DONE] signal')
                            return
                        }
                        try {
                            const data = JSON.parse(dataStr)
                            const content = data.choices?.[0]?.delta?.content || ""
                            console.log('[Chat] Chunk content:', JSON.stringify(content))
                            if (content) {
                                if (botMsg.length === 0) {
                                    clearTimeout(streamTimeout)
                                    console.log('[Chat] First content received')
                                }
                                botMsg += content
                                console.log('[Chat] Total so far:', botMsg.length, 'chars')
                                setMessages(prev => {
                                    // Create entirely new array with new message object (don't mutate!)
                                    return prev.map((msg, idx) => 
                                        idx === prev.length - 1 && msg.role === "assistant"
                                            ? { ...msg, content: botMsg }
                                            : msg
                                    )
                                })
                            }
                        } catch (parseError) {
                            console.warn('[Chat] Stream parse error:', parseError, 'Data:', dataStr.substring(0, 100))
                        }
                    }
                }

                let chunkCount = 0
                while (true) {
                    const { done, value } = await reader.read()
                    chunkCount++
                    console.log(`[Chat] Read chunk #${chunkCount}, done=${done}, bytes=${value?.length || 0}`)
                    
                    if (done) {
                        clearTimeout(streamTimeout)
                        // Flush decoder and add any remaining bytes to buffer
                        buffer += decoder.decode()
                        // Process any remaining content in buffer before exiting
                        if (buffer.trim()) {
                            console.log('[Chat] Processing remaining buffer:', buffer.substring(0, 100))
                            processLine(buffer)
                        }
                        console.log('[Chat] Stream complete. Total response:', botMsg.length, 'chars, chunks:', chunkCount)
                        break
                    }
                    
                    // Append new chunk to buffer and process complete lines
                    const decoded = decoder.decode(value, { stream: true })
                    console.log('[Chat] Decoded chunk:', decoded.substring(0, 100))
                    buffer += decoded
                    const lines = buffer.split("\n")
                    
                    // Keep the last incomplete line in buffer
                    buffer = lines.pop() || ""
                    console.log(`[Chat] Split into ${lines.length} complete lines, buffer remainder: ${buffer.length} chars`)
                    
                    for (const line of lines) {
                        processLine(line)
                    }
                }
            }
            
            // Validate we got content
            if (botMsg.trim().length === 0) {
                throw new Error("Received empty response from AI service")
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

        } catch (error) {
            console.error('Chat send error:', error)
            const errorMessage = error instanceof Error ? error.message : "Failed to send message"
            
            setMessages(prev => [...prev, { 
                role: "assistant", 
                content: `⚠️ ${errorMessage}\n\nPlease try again or contact support if this persists.` 
            }])
            
            // toast.error("Message Failed", errorMessage)
        } finally {
            setLoading(false)
        }
    }, [apiKey, currentSessionId, selectedSoulprintId, coachingMode, coachingGoal, messages])

    async function handleClearHistory() {
        if (confirm("Are you sure? This will delete messages in this session.")) {
            await clearChatHistory(currentSessionId || undefined)
            setMessages([])
            loadSessions()
            if (currentSessionId) setCurrentSessionId(null)
        }
    }

    function handleNewChat() {
        setCurrentSessionId(null);
        setMessages([]);
        if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
    }

    function handleSuggestionClick(prompt: string) {
        handleSend(prompt)
    }

    // Export functions
    function exportAsJSON() {
        const exportData = {
            exportedAt: new Date().toISOString(),
            soulprint: displayName,
            sessionId: currentSessionId,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        }
        downloadFile(
            JSON.stringify(exportData, null, 2),
            `soulprint-chat-${new Date().toISOString().split('T')[0]}.json`,
            'application/json'
        )
        setExportMenuOpen(false)
    }

    function exportAsMarkdown() {
        let md = `# SoulPrint Chat Export\n\n`
        md += `**Date:** ${new Date().toLocaleDateString()}\n`
        md += `**SoulPrint:** ${displayName}\n\n`
        md += `---\n\n`

        messages.forEach(msg => {
            const speaker = msg.role === 'user' ? '**You**' : `**${displayName}**`
            md += `${speaker}:\n\n${msg.content}\n\n---\n\n`
        })

        downloadFile(
            md,
            `soulprint-chat-${new Date().toISOString().split('T')[0]}.md`,
            'text/markdown'
        )
        setExportMenuOpen(false)
    }

    function exportAsText() {
        let txt = `SoulPrint Chat Export\n`
        txt += `Date: ${new Date().toLocaleDateString()}\n`
        txt += `SoulPrint: ${displayName}\n`
        txt += `${'='.repeat(50)}\n\n`

        messages.forEach(msg => {
            const speaker = msg.role === 'user' ? 'You' : displayName
            txt += `[${speaker}]\n${msg.content}\n\n`
        })

        downloadFile(
            txt,
            `soulprint-chat-${new Date().toISOString().split('T')[0]}.txt`,
            'text/plain'
        )
        setExportMenuOpen(false)
    }

    function downloadFile(content: string, filename: string, mimeType: string) {
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    if (initializing) {
        return (
            <div className="flex h-full items-center justify-center bg-[#0a0a0a]">
                <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
                    <p className="mt-2 text-zinc-400">Updating SoulContext...</p>
                </div>
            </div>
        )
    }

    const showWelcome = messages.length === 0

    return (
        <div className="flex h-full w-full overflow-hidden rounded-xl bg-[#0a0a0a] shadow-[0px_4px_4px_2px_rgba(0,0,0,0.5)]">
            {/* Mobile Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Dark Sidebar */}
            <div className={cn(
                "flex flex-col bg-[#111111] transition-all duration-300 ease-in-out z-50 border-r border-zinc-800",
                "fixed inset-y-0 left-0 lg:relative lg:inset-auto",
                sidebarOpen
                    ? "w-[280px] translate-x-0"
                    : "w-0 -translate-x-full lg:translate-x-0"
            )}>
                {sidebarOpen && (
                    <div className="flex flex-col h-full w-[280px] overflow-hidden pt-[env(safe-area-inset-top)]">
                        {/* Sidebar Header - Your SoulPrint Identity */}
                        <div className="p-4 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-b border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center shadow-lg">
                                    <Sparkles className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-base font-semibold text-white block truncate">
                                        {displayName}
                                    </span>
                                    <span className="text-xs text-zinc-500">AI Companion</span>
                                </div>
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="h-4 w-4 text-zinc-400" />
                                </button>
                            </div>
                        </div>

                        {/* New Conversation Button */}
                        <div className="p-3 border-b border-zinc-800">
                            <Button
                                onClick={handleNewChat}
                                className="w-full bg-orange-600 hover:bg-orange-500 text-white gap-2 h-10 font-medium shadow-sm"
                            >
                                <Plus className="h-4 w-4" />
                                New Conversation
                            </Button>
                        </div>

                        {/* Conversations List - Limited to 5 recent, expandable */}
                        <div className="flex-1 overflow-hidden flex flex-col relative">
                            <div className="p-3 flex-1 flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recent</span>
                                    {sessions.length > 0 && (
                                        <span className="text-xs text-zinc-500">{sessions.length}</span>
                                    )}
                                </div>

                                {sessions.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <MessageSquare className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                                        <p className="text-sm text-zinc-500">No conversations yet</p>
                                        <p className="text-xs text-zinc-600 mt-1">Start chatting to see history</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            {sessions.slice(0, 5).map((session) => (
                                                <button
                                                    key={session.session_id}
                                                    onClick={() => {
                                                        setCurrentSessionId(session.session_id);
                                                        if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full px-3 py-2 rounded-lg flex items-center gap-3 transition-all text-left group",
                                                        currentSessionId === session.session_id
                                                            ? "bg-orange-600/10 border border-orange-600/20"
                                                            : "hover:bg-zinc-800 border border-transparent"
                                                    )}
                                                >
                                                    <MessageSquare className={cn(
                                                        "h-4 w-4 shrink-0 transition-colors",
                                                        currentSessionId === session.session_id
                                                            ? "text-orange-500"
                                                            : "text-zinc-500 group-hover:text-zinc-300"
                                                    )} />
                                                    <span className={cn(
                                                        "flex-1 text-sm truncate",
                                                        currentSessionId === session.session_id
                                                            ? "text-orange-500 font-medium"
                                                            : "text-zinc-300"
                                                    )}>
                                                        {session.last_message?.slice(0, 25) || "New Conversation"}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                        {sessions.length > 5 && (
                                            <button
                                                onClick={() => {
                                                    const el = document.getElementById('full-history-drawer');
                                                    if (el) el.classList.toggle('hidden');
                                                }}
                                                className="w-full mt-2 px-3 py-2 text-xs text-orange-500 hover:bg-orange-600/10 rounded-lg transition-colors flex items-center justify-center gap-1 font-medium"
                                            >
                                                View all ({sessions.length})
                                                <ChevronRight className="h-3 w-3" />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Full History Drawer - Hidden by default */}
                            {sessions.length > 5 && (
                                <div id="full-history-drawer" className="hidden absolute inset-0 bg-[#111111] z-10 flex flex-col">
                                    <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-zinc-200">All Conversations</span>
                                        <button
                                            onClick={() => {
                                                const el = document.getElementById('full-history-drawer');
                                                if (el) el.classList.add('hidden');
                                            }}
                                            className="p-1 hover:bg-zinc-800 rounded"
                                        >
                                            <X className="h-4 w-4 text-zinc-400" />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                                        {sessions.map((session) => (
                                            <button
                                                key={session.session_id}
                                                onClick={() => {
                                                    setCurrentSessionId(session.session_id);
                                                    const el = document.getElementById('full-history-drawer');
                                                    if (el) el.classList.add('hidden');
                                                    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full px-3 py-2 rounded-lg flex items-center gap-3 transition-all text-left group",
                                                    currentSessionId === session.session_id
                                                        ? "bg-orange-600/10 border border-orange-600/20"
                                                        : "hover:bg-zinc-800 border border-transparent"
                                                )}
                                            >
                                                <MessageSquare className={cn(
                                                    "h-4 w-4 shrink-0 transition-colors",
                                                    currentSessionId === session.session_id
                                                        ? "text-orange-500"
                                                        : "text-zinc-500 group-hover:text-zinc-300"
                                                )} />
                                                <span className={cn(
                                                    "flex-1 text-sm truncate",
                                                    currentSessionId === session.session_id
                                                        ? "text-orange-500 font-medium"
                                                        : "text-zinc-300"
                                                )}>
                                                    {session.last_message?.slice(0, 25) || "New Conversation"}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar Footer - User Account */}
                        <div className="p-3 bg-[#0a0a0a] border-t border-zinc-800">
                            <button
                                onClick={() => window.open('/dashboard/settings', '_self')}
                                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                            >
                                <div className="w-9 h-9 bg-zinc-700 rounded-full flex items-center justify-center">
                                    <User className="h-4 w-4 text-zinc-300" />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="text-sm font-medium text-zinc-200 truncate">
                                        {user?.email?.split('@')[0] || 'User'}
                                    </div>
                                    <div className="text-xs text-zinc-500 truncate">
                                        {user?.email || 'View Account'}
                                    </div>
                                </div>
                                <ChevronsUpDown className="h-4 w-4 text-zinc-500 shrink-0" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Chat Area */}
            <div
                className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0a0a] relative"
                style={
                    {
                        "--sp-primary": "#EA580C",
                        "--sp-primary-dark": "#C2410C",
                        "--sp-accent": "#FDBA74",
                        "--sp-text": "#F5F5F5",
                        "--sp-bg": "#0a0a0a",
                        "--sp-surface": "#111111",
                        "--sp-muted": "#71717A",
                        fontFamily: soulprintTheme.fontFamily
                    } as CSSProperties
                }
            >

                {/* Mobile Chat Header - Sticky */}
                <div className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden border-b border-zinc-800 bg-[#111111]">
                    {/* Left: Chat icon - opens sidebar/history */}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="inline-flex items-center justify-center rounded-full w-9 h-9 text-zinc-300 hover:bg-zinc-800 transition-colors"
                        aria-label="Chat history"
                    >
                        <MessageSquare className="h-5 w-5" />
                    </button>

                    {/* Center: AI Name */}
                    <div className="flex-1 min-w-0 text-center">
                        <div className="text-base font-semibold truncate text-zinc-100">{displayName}</div>
                    </div>

                    {/* Right: Menu icon - opens action menu */}
                    <div className="relative">
                        <button
                            onClick={() => setExportMenuOpen(!exportMenuOpen)}
                            className="inline-flex items-center justify-center rounded-full w-9 h-9 text-zinc-300 hover:bg-zinc-800 transition-colors"
                            aria-label="Menu"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        {exportMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setExportMenuOpen(false)}
                                />
                                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl z-50">
                                    {/* New Chat */}
                                    <button
                                        onClick={() => { handleNewChat(); setExportMenuOpen(false); }}
                                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-3"
                                    >
                                        <Plus className="h-4 w-4 text-orange-500" />
                                        New Chat
                                    </button>
                                    
                                    {messages.length > 0 && (
                                        <>
                                            <div className="h-px bg-zinc-800 my-1" />
                                            {/* Export Options */}
                                            <button
                                                onClick={exportAsJSON}
                                                className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-3"
                                            >
                                                <FileJson className="h-4 w-4 text-blue-400" />
                                                Export JSON
                                            </button>
                                            <button
                                                onClick={exportAsMarkdown}
                                                className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-3"
                                            >
                                                <FileCode className="h-4 w-4 text-purple-400" />
                                                Export Markdown
                                            </button>
                                            <button
                                                onClick={exportAsText}
                                                className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-3"
                                            >
                                                <FileText className="h-4 w-4 text-zinc-400" />
                                                Export Text
                                            </button>
                                            <div className="h-px bg-zinc-800 my-1" />
                                            {/* Clear Chat */}
                                            <button
                                                onClick={() => { handleClearHistory(); setExportMenuOpen(false); }}
                                                className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-3"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Clear Chat
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Desktop Toggle Button */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 h-16 w-4 bg-zinc-800 hover:bg-zinc-700 items-center justify-center rounded-r-md transition-colors text-zinc-400"
                >
                    {sidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>

                {showWelcome ? (
                    /* Welcome Screen - Dark theme */
                    <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-10 xl:px-16 py-6 overflow-y-auto">
                        <div className="w-full max-w-[1100px] flex flex-col items-center">
                            {/* Logo - At top of content group */}
                            <div className="flex items-center justify-center mb-8 sm:mb-10">
                                <span className="font-koulen text-5xl sm:text-6xl lg:text-7xl text-white tracking-wide">
                                    SOULPRINT ENGINE
                                </span>
                            </div>

                            {/* Input Card - Telegram Style */}
                            <div className="w-full mb-8 sm:mb-10">
                                <div className="border border-zinc-700 rounded-2xl overflow-hidden bg-zinc-900 shadow-lg">
                                    <TelegramChatInput
                                        onSend={handleSend}
                                        disabled={loading}
                                        placeholder="Ask me anything..."
                                    />
                                </div>
                            </div>

                            {/* Suggestion Cards - Dark theme */}
                            <div className="w-full">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                                    {smartSuggestions.map((suggestion, idx) => (
                                        <button
                                            key={`${suggestion.title}-${idx}`}
                                            onClick={() => handleSuggestionClick(suggestion.prompt)}
                                            className={cn(
                                                "hover:scale-[1.02] active:scale-[0.98] border rounded-xl p-5 sm:p-6 text-left transition-all flex flex-col justify-start shadow-lg min-h-[120px]",
                                                suggestion.isPersonalized
                                                    ? "bg-orange-600/10 border-orange-600/30 hover:bg-orange-600/20"
                                                    : "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                                            )}
                                        >
                                            <h3 className="text-lg sm:text-base font-semibold text-white leading-snug">
                                                {suggestion.title}
                                            </h3>
                                            <p className="text-base sm:text-sm text-zinc-400 mt-3 leading-relaxed">
                                                {suggestion.description}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Chat Messages View */
                    <>
                        {/* Desktop Chat Header */}
                        <div className="hidden lg:flex items-center justify-between border-b border-zinc-800 bg-[#111111] p-3 min-h-[52px]">
                            <div className="flex items-center gap-3 pl-6">
                                <div
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600"
                                >
                                    <Bot className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-sm text-zinc-100">{displayName}</h2>
                                    <p className="text-xs text-zinc-500">
                                        {currentSessionId ? 'Active Session' : 'New Session'}
                                    </p>
                                </div>
                            </div>
                            {messages.length > 0 && (
                                <div className="flex items-center gap-2">
                                    {/* Export Dropdown */}
                                    <div className="relative">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExportMenuOpen(!exportMenuOpen)}
                                            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                                        >
                                            <Download className="h-4 w-4 mr-1" />
                                            Export
                                        </Button>
                                        {exportMenuOpen && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-40"
                                                    onClick={() => setExportMenuOpen(false)}
                                                />
                                                <div className="absolute right-0 mt-1 w-48 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 py-1 z-50">
                                                    <button
                                                        onClick={exportAsJSON}
                                                        className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                                                    >
                                                        <FileJson className="h-4 w-4 text-orange-500" />
                                                        Export as JSON
                                                    </button>
                                                    <button
                                                        onClick={exportAsMarkdown}
                                                        className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                                                    >
                                                        <FileCode className="h-4 w-4 text-blue-400" />
                                                        Export as Markdown
                                                    </button>
                                                    <button
                                                        onClick={exportAsText}
                                                        className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                                                    >
                                                        <FileText className="h-4 w-4 text-zinc-400" />
                                                        Export as Text
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearHistory}
                                        className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                                    >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Clear
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Messages Area - Telegram Style */}
                        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                            {messages.map((msg, i) => (
                                <TelegramChatMessage 
                                    key={i} 
                                    message={msg} 
                                    displayName={displayName}
                                    showAvatar={i === 0 || messages[i - 1]?.role !== msg.role}
                                />
                            ))}
                            {loading && (
                                <div className="flex gap-2 max-w-[90%] mr-auto">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center self-end">
                                        <span className="text-white text-xs font-bold">
                                            {displayName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="bg-[#212121] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-1">
                                            <span className="h-2 w-2 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: "0ms" }} />
                                            <span className="h-2 w-2 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: "150ms" }} />
                                            <span className="h-2 w-2 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area - Telegram Style */}
                        <TelegramChatInput
                            onSend={handleSend}
                            disabled={loading}
                            placeholder="Message"
                        />
                    </>
                )}
            </div>
        </div>
    )
}
