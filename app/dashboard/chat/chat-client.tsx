"use client"

import { useState, useEffect, useRef, type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { listApiKeys } from "@/app/actions/api-keys"
import { getChatHistory, saveChatMessage, clearChatHistory, getChatSessions, type ChatSession } from "@/app/actions/chat-history"
import {
    Send, Bot, User, Loader2, Trash2, Plus, MessageSquare,
    ChevronLeft, ChevronRight, Menu, Globe, Paperclip,
    AudioLines,
    ChevronsUpDown, X, Download, FileJson, FileText, FileCode,
    Sparkles, CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getSoulprintTheme, type SoulprintTheme } from "@/lib/soulprint-theme"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

// Generate personalized suggestions from past chat sessions
function generatePersonalizedSuggestions(sessions: ChatSession[]): SuggestionCard[] {
    if (!sessions || sessions.length === 0) return []
    
    const personalized: SuggestionCard[] = []
    
    // Get the 3 most recent sessions with content
    const recentSessions = sessions
        .filter(s => s.last_message && s.last_message.length > 10)
        .slice(0, 3)
    
    for (const session of recentSessions) {
        const lastMsg = session.last_message || ""
        // Truncate and create a prompt based on the topic
        const topic = lastMsg.slice(0, 50).replace(/\n/g, ' ')
        personalized.push({
            title: `Continue: "${topic}${lastMsg.length > 50 ? '...' : ''}"`,
            description: "Pick up where you left off",
            prompt: `Let's continue our conversation about: ${lastMsg.slice(0, 100)}`,
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
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [initializing, setInitializing] = useState(true)
    const [user, setUser] = useState<{ id?: string; email?: string } | null>(null)
    const [, setPersonality] = useState<string>("Default System")
    const [displayName, setDisplayName] = useState<string>("SoulPrint")
    const [shouldAutoScroll, setShouldAutoScroll] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [expandedFolders, setExpandedFolders] = useState<string[]>([])
    const [exportMenuOpen, setExportMenuOpen] = useState(false)
    const [coachingMode, setCoachingMode] = useState(false)
    const [coachingGoal, setCoachingGoal] = useState<string | null>(null)
    const [soulprintTheme, setSoulprintTheme] = useState<SoulprintTheme>(() => getSoulprintTheme(null))
    const welcomeInputRef = useRef<HTMLTextAreaElement>(null)
    const chatInputRef = useRef<HTMLTextAreaElement>(null)

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
                if (storedKey) {
                    setApiKey(storedKey)
                } else {
                    const { keys } = await listApiKeys()
                    if (keys && keys.length > 0 && keys[0].encrypted_key) {
                        setApiKey(keys[0].encrypted_key)
                    }
                    // If no valid key exists, apiKey remains null and chat will be blocked
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
                            } catch { /* ignore parse errors */ }
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

        } catch {
            setMessages(prev => [...prev, { role: "assistant", content: "Error: Failed to reply." }])
        } finally {
            setLoading(false)
        }
    }

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
        setInput(prompt + " ")
    }

    function autoResizeTextarea(el: HTMLTextAreaElement | null) {
        if (!el) return
        el.style.height = "auto"
        const next = Math.min(el.scrollHeight, 220)
        el.style.height = `${next}px`
    }

    useEffect(() => {
        autoResizeTextarea(welcomeInputRef.current)
        autoResizeTextarea(chatInputRef.current)
    }, [input])

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

    function toggleFolder(folder: string) {
        setExpandedFolders(prev => 
            prev.includes(folder) 
                ? prev.filter(f => f !== folder)
                : [...prev, folder]
        )
    }

    if (initializing) {
        return (
            <div className="flex h-full items-center justify-center bg-zinc-300">
                <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-zinc-600" />
                    <p className="mt-2 text-zinc-600">Updating SoulContext...</p>
                </div>
            </div>
        )
    }

    const showWelcome = messages.length === 0

    return (
        <div className="flex h-full w-full overflow-hidden rounded-xl bg-zinc-100 shadow-[0px_4px_4px_2px_rgba(0,0,0,0.25)]">
            {/* Mobile Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Light Sidebar */}
            <div className={cn(
                "flex flex-col bg-white transition-all duration-300 ease-in-out z-50 border-r border-zinc-200",
                "fixed inset-y-0 left-0 lg:relative lg:inset-auto",
                sidebarOpen 
                    ? "w-[280px] translate-x-0" 
                    : "w-0 -translate-x-full lg:translate-x-0"
            )}>
                {sidebarOpen && (
                    <div className="flex flex-col h-full w-[280px] overflow-hidden">
                        {/* Sidebar Header - Your SoulPrint Identity */}
                        <div className="p-4 bg-gradient-to-br from-zinc-900 to-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#E8632B] flex items-center justify-center shadow-lg">
                                    <Sparkles className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-base font-semibold text-white block truncate">
                                        {displayName}
                                    </span>
                                    <span className="text-xs text-zinc-400">AI Companion</span>
                                </div>
                                <button 
                                    onClick={() => setSidebarOpen(false)}
                                    className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="h-4 w-4 text-zinc-300" />
                                </button>
                            </div>
                        </div>

                        {/* New Conversation Button */}
                        <div className="p-3 border-b border-zinc-100">
                            <Button
                                onClick={handleNewChat}
                                className="w-full bg-[#E8632B] hover:bg-[#d55a26] text-white gap-2 h-10 font-medium shadow-sm"
                            >
                                <Plus className="h-4 w-4" />
                                New Conversation
                            </Button>
                        </div>

                        {/* Conversations List */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">History</span>
                                    {sessions.length > 0 && (
                                        <span className="text-xs text-zinc-400">{sessions.length}</span>
                                    )}
                                </div>

                                {sessions.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <MessageSquare className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                                        <p className="text-sm text-zinc-400">No conversations yet</p>
                                        <p className="text-xs text-zinc-400 mt-1">Start chatting to see history</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {sessions.map((session) => (
                                            <button
                                                key={session.session_id}
                                                onClick={() => {
                                                    setCurrentSessionId(session.session_id);
                                                    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all text-left group",
                                                    currentSessionId === session.session_id
                                                        ? "bg-[#E8632B]/10 border border-[#E8632B]/20"
                                                        : "hover:bg-zinc-50 border border-transparent"
                                                )}
                                            >
                                                <MessageSquare className={cn(
                                                    "h-4 w-4 shrink-0 transition-colors",
                                                    currentSessionId === session.session_id
                                                        ? "text-[#E8632B]"
                                                        : "text-zinc-400 group-hover:text-zinc-600"
                                                )} />
                                                <span className={cn(
                                                    "flex-1 text-sm truncate",
                                                    currentSessionId === session.session_id
                                                        ? "text-[#E8632B] font-medium"
                                                        : "text-zinc-700"
                                                )}>
                                                    {session.last_message?.slice(0, 30) || "New Conversation"}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sidebar Footer - User Account */}
                        <div className="p-3 bg-zinc-50 border-t border-zinc-200">
                            <button 
                                onClick={() => window.open('/dashboard/settings', '_self')}
                                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 transition-colors"
                            >
                                <div className="w-9 h-9 bg-zinc-200 rounded-full flex items-center justify-center">
                                    <User className="h-4 w-4 text-zinc-600" />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="text-sm font-medium text-zinc-800 truncate">
                                        {user?.email?.split('@')[0] || 'User'}
                                    </div>
                                    <div className="text-xs text-zinc-500 truncate">
                                        {user?.email || 'View Account'}
                                    </div>
                                </div>
                                <ChevronsUpDown className="h-4 w-4 text-zinc-400 shrink-0" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Chat Area */}
            <div
                className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-50 relative"
                style={
                    {
                        "--sp-primary": soulprintTheme.colors.primary,
                        "--sp-primary-dark": soulprintTheme.colors.primaryDark,
                        "--sp-accent": soulprintTheme.colors.accent,
                        "--sp-text": soulprintTheme.colors.text,
                        "--sp-bg": soulprintTheme.colors.bg,
                        "--sp-surface": soulprintTheme.colors.surface,
                        "--sp-muted": soulprintTheme.colors.muted,
                        fontFamily: soulprintTheme.fontFamily
                    } as CSSProperties
                }
            >

                {/* Mobile Chat Header */}
                <div className="flex items-center gap-2 p-3 lg:hidden border-b border-zinc-200 bg-white">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-zinc-700 hover:bg-zinc-100"
                        aria-label="Open history"
                    >
                        <MessageSquare className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0 text-center">
                        <div className="text-sm font-semibold truncate text-[color:var(--sp-text)]">{displayName}</div>
                    </div>
                    {messages.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                                className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 hover:bg-zinc-100"
                                title="Export"
                            >
                                <Download className="h-4 w-4" />
                            </button>
                            {exportMenuOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setExportMenuOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg z-50">
                                        <button
                                            onClick={exportAsJSON}
                                            className="w-full px-4 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100 flex items-center gap-2"
                                        >
                                            <FileJson className="h-4 w-4 text-orange-500" />
                                            Export JSON
                                        </button>
                                        <button
                                            onClick={exportAsMarkdown}
                                            className="w-full px-4 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100 flex items-center gap-2"
                                        >
                                            <FileCode className="h-4 w-4 text-blue-500" />
                                            Export Markdown
                                        </button>
                                        <button
                                            onClick={exportAsText}
                                            className="w-full px-4 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100 flex items-center gap-2"
                                        >
                                            <FileText className="h-4 w-4 text-zinc-500" />
                                            Export Text
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Desktop Toggle Button */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 h-16 w-4 bg-zinc-200 hover:bg-zinc-300 items-center justify-center rounded-r-md transition-colors"
                >
                    {sidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>

                {showWelcome ? (
                    /* Welcome Screen - Full screen mobile-first design */
                    <div className="flex-1 flex flex-col px-4 sm:px-6 py-8 sm:py-10 overflow-y-auto">
                        {/* Logo - Big and centered */}
                        <div className="flex items-center justify-center gap-2 mb-8 sm:mb-10">
                            <span className="font-koulen text-4xl sm:text-5xl lg:text-6xl text-black tracking-wide">
                                SOULPRINT
                            </span>
                            <span className="font-inter italic font-thin text-3xl sm:text-4xl lg:text-5xl text-black tracking-tight">
                                Engine
                            </span>
                        </div>

                        {/* Input Card - Full width, bigger on mobile */}
                        <div className="w-full max-w-[658px] mx-auto mb-8 sm:mb-10">
                            <div className="border border-stone-300 rounded-2xl p-4 sm:p-5 bg-white shadow-sm">
                                <textarea
                                    ref={welcomeInputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey && !loading) {
                                            e.preventDefault()
                                            handleSend()
                                        }
                                    }}
                                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                                    placeholder="Ask me anything..."
                                    className="w-full bg-transparent text-zinc-900 placeholder:text-neutral-400 text-base sm:text-lg focus:outline-none min-h-[56px] resize-none leading-relaxed overflow-hidden"
                                    rows={3}
                                    disabled={loading}
                                />
                                
                                {/* Action Buttons Row */}
                                <div className="flex items-center gap-3 mt-4 sm:mt-5">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => alert("File attachments coming soon!")}
                                        className="h-11 w-11 sm:h-10 sm:w-10 text-neutral-500 hover:text-neutral-700 hover:bg-zinc-100 rounded-lg"
                                        title="Attach file (Coming Soon)"
                                    >
                                        <Paperclip className="h-5 w-5" />
                                    </Button>

                                    <div className="flex-1" />

                                    <Button
                                        size="icon"
                                        onClick={handleSend}
                                        disabled={loading || !input.trim()}
                                        className="h-11 w-11 sm:h-10 sm:w-10 rounded-xl bg-[color:var(--sp-primary)] hover:bg-[color:var(--sp-primary-dark)]"
                                    >
                                        <Send className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Suggestion Cards - Vertical stack on mobile, horizontal on larger screens */}
                        <div className="w-full max-w-[658px] mx-auto flex-1 mt-4 sm:mt-0">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                {smartSuggestions.map((suggestion, idx) => (
                                    <button
                                        key={`${suggestion.title}-${idx}`}
                                        onClick={() => handleSuggestionClick(suggestion.prompt)}
                                        className={cn(
                                            "hover:scale-[1.02] active:scale-[0.98] border rounded-xl p-4 sm:p-4 text-left transition-all flex flex-col justify-start shadow-sm",
                                            suggestion.isPersonalized 
                                                ? "bg-[color:var(--sp-bg)] border-[color:var(--sp-accent)] hover:bg-white" 
                                                : "bg-white border-stone-200 hover:bg-zinc-50"
                                        )}
                                    >
                                        <h3 className="text-base sm:text-sm font-semibold text-black leading-snug">
                                            {suggestion.title}
                                        </h3>
                                        <p className="text-sm sm:text-xs text-neutral-500 mt-2 leading-relaxed">
                                            {suggestion.description}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Chat Messages View */
                    <>
                        {/* Desktop Chat Header */}
                        <div className="hidden lg:flex items-center justify-between border-b border-zinc-200 bg-white p-3 min-h-[52px]">
                            <div className="flex items-center gap-3 pl-6">
                                <div
                                    className="flex h-8 w-8 items-center justify-center rounded-full"
                                    style={{ backgroundColor: "var(--sp-accent)", color: "var(--sp-primary)" }}
                                >
                                    <Bot className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-sm text-[color:var(--sp-text)]">{displayName}</h2>
                                    <p className="text-xs text-[color:var(--sp-muted)]">
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
                                            className="text-zinc-500 hover:text-zinc-700"
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
                                                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-50">
                                                    <button
                                                        onClick={exportAsJSON}
                                                        className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 flex items-center gap-2"
                                                    >
                                                        <FileJson className="h-4 w-4 text-orange-500" />
                                                        Export as JSON
                                                    </button>
                                                    <button
                                                        onClick={exportAsMarkdown}
                                                        className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 flex items-center gap-2"
                                                    >
                                                        <FileCode className="h-4 w-4 text-blue-500" />
                                                        Export as Markdown
                                                    </button>
                                                    <button
                                                        onClick={exportAsText}
                                                        className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 flex items-center gap-2"
                                                    >
                                                        <FileText className="h-4 w-4 text-zinc-500" />
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
                                        className="text-zinc-500 hover:text-red-500"
                                    >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Clear
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, i) => (
                                <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                                    {msg.role === "assistant" && (
                                        <div
                                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                                            style={{ backgroundColor: "var(--sp-accent)", color: "var(--sp-primary)" }}
                                        >
                                            <Bot className="h-4 w-4" />
                                        </div>
                                    )}
                                    <div className={cn(
                                        "max-w-[85%] rounded-xl p-4 text-sm leading-relaxed",
                                        msg.role === "user" 
                                            ? "bg-[color:var(--sp-primary)] text-white" 
                                            : "bg-white border border-zinc-200 text-zinc-900"
                                    )}>
                                        {msg.role === "assistant" ? (
                                            <div className="prose prose-sm prose-zinc max-w-none">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        ul: ({ children }) => <ul className="list-disc pl-4 space-y-1">{children}</ul>,
                                                        ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1">{children}</ol>,
                                                        h2: ({ children }) => <h2 className="text-base font-bold text-zinc-900 mt-4 mb-2">{children}</h2>,
                                                        h3: ({ children }) => <h3 className="text-sm font-semibold text-zinc-900 mt-3 mb-1">{children}</h3>,
                                                        strong: ({ children }) => <span className="font-bold text-[color:var(--sp-primary)]">{children}</span>,
                                                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                    {msg.role === "user" && (
                                        <div
                                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white"
                                            style={{ backgroundColor: "var(--sp-primary)" }}
                                        >
                                            <User className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>
                            ))}
                            {loading && (
                                <div className="flex gap-3">
                                    <div
                                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                                        style={{ backgroundColor: "var(--sp-accent)", color: "var(--sp-primary)" }}
                                    >
                                        <Bot className="h-4 w-4" />
                                    </div>
                                    <div className="flex items-center gap-1 rounded-xl bg-white border border-zinc-200 p-3">
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area (Active Chat) */}
                        <div className="border-t border-zinc-200 p-3 sm:p-4 bg-white">
                            <div className="max-w-4xl mx-auto">
                                <div className="flex items-center gap-2 border border-zinc-300 rounded-xl p-2 sm:p-3 bg-zinc-50">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => alert("File attachments coming soon!")}
                                        className="h-10 w-10 sm:h-8 sm:w-8 text-neutral-500 hover:text-neutral-700 shrink-0"
                                        title="Attach file (Coming Soon)"
                                    >
                                        <Paperclip className="h-5 w-5 sm:h-4 sm:w-4" />
                                    </Button>
                                    <textarea
                                        ref={chatInputRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey && !loading) {
                                                e.preventDefault()
                                                handleSend()
                                            }
                                        }}
                                        onInput={(e) => autoResizeTextarea(e.currentTarget)}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-transparent text-zinc-900 placeholder:text-zinc-400 text-sm focus:outline-none min-h-[56px] sm:min-h-[48px] resize-none leading-relaxed overflow-hidden"
                                        rows={3}
                                        disabled={loading}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => alert("Voice input coming soon!")}
                                        className="h-10 w-10 sm:h-8 sm:w-8 text-neutral-500 hover:text-neutral-700 shrink-0"
                                        title="Voice input (Coming Soon)"
                                    >
                                        <AudioLines className="h-5 w-5 sm:h-4 sm:w-4" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        onClick={handleSend}
                                        disabled={loading || !input.trim()}
                                        className="bg-[color:var(--sp-primary)] hover:bg-[color:var(--sp-primary-dark)] h-10 w-10 sm:h-8 sm:w-8 rounded-lg shrink-0"
                                    >
                                        <Send className="h-5 w-5 sm:h-4 sm:w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
