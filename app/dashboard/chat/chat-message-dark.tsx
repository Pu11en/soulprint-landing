/**
 * Telegram-style dark theme chat message component
 * 
 * Features:
 * - Dark mode with subtle background pattern
 * - User messages: Purple/magenta gradient on right with tail
 * - Bot messages: Dark surface on left with tail
 * - No avatars (cleaner Telegram style)
 * - Timestamps on messages
 * - Smooth animations
 */
import { memo } from "react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from "@/lib/utils"

interface Message {
    role: "user" | "assistant"
    content: string
    timestamp?: Date
}

interface ChatMessageDarkProps {
    message: Message
    soulprintName?: string
}

export const ChatMessageDark = memo(function ChatMessageDark({ 
    message, 
    soulprintName = "SoulPrint" 
}: ChatMessageDarkProps) {
    const isUser = message.role === "user"
    const time = message.timestamp 
        ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null

    return (
        <div 
            className={cn(
                "flex w-full mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200",
                isUser ? "justify-end" : "justify-start"
            )}
        >
            <div className={cn(
                "relative max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]",
                isUser ? "pr-2" : "pl-2"
            )}>
                {/* Message bubble */}
                <div className={cn(
                    "relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                    isUser 
                        ? "bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] text-white rounded-br-md"
                        : "bg-[#1E1E2E] text-zinc-100 rounded-bl-md border border-zinc-800/50"
                )}>
                    {/* Sender name for assistant */}
                    {!isUser && (
                        <div className="text-xs font-medium text-[#A78BFA] mb-1">
                            {soulprintName}
                        </div>
                    )}

                    {/* Message content */}
                    {isUser ? (
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    ) : (
                        <div className="prose prose-sm prose-invert max-w-none">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    ul: ({ children }) => (
                                        <ul className="list-disc pl-4 space-y-1 my-2">{children}</ul>
                                    ),
                                    ol: ({ children }) => (
                                        <ol className="list-decimal pl-4 space-y-1 my-2">{children}</ol>
                                    ),
                                    h2: ({ children }) => (
                                        <h2 className="text-base font-bold text-white mt-4 mb-2">{children}</h2>
                                    ),
                                    h3: ({ children }) => (
                                        <h3 className="text-sm font-semibold text-white mt-3 mb-1">{children}</h3>
                                    ),
                                    strong: ({ children }) => (
                                        <span className="font-bold text-[#A78BFA]">{children}</span>
                                    ),
                                    p: ({ children }) => (
                                        <p className="mb-2 last:mb-0 text-zinc-100">{children}</p>
                                    ),
                                    a: ({ href, children }) => (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#A78BFA] underline hover:text-[#C4B5FD] transition-colors"
                                        >
                                            {children}
                                        </a>
                                    ),
                                    code: ({ children, className }) => {
                                        const isInline = !className
                                        return isInline ? (
                                            <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-[#F472B6] text-xs font-mono">
                                                {children}
                                            </code>
                                        ) : (
                                            <code className="block p-3 rounded-lg bg-zinc-900 text-zinc-100 text-xs font-mono overflow-x-auto">
                                                {children}
                                            </code>
                                        )
                                    },
                                    pre: ({ children }) => (
                                        <pre className="my-2 rounded-lg overflow-hidden">{children}</pre>
                                    ),
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-2 border-[#A78BFA] pl-3 my-2 text-zinc-300 italic">
                                            {children}
                                        </blockquote>
                                    )
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}

                    {/* Timestamp */}
                    {time && (
                        <div className={cn(
                            "text-[10px] mt-1 text-right",
                            isUser ? "text-white/60" : "text-zinc-500"
                        )}>
                            {time}
                        </div>
                    )}
                </div>

                {/* Message tail */}
                <div 
                    className={cn(
                        "absolute bottom-0 w-3 h-3",
                        isUser 
                            ? "right-0 bg-[#7C3AED]" 
                            : "left-0 bg-[#1E1E2E]"
                    )}
                    style={{
                        clipPath: isUser 
                            ? "polygon(0 0, 100% 100%, 0 100%)"
                            : "polygon(100% 0, 100% 100%, 0 100%)"
                    }}
                />
            </div>
        </div>
    )
}, (prevProps, nextProps) => {
    return prevProps.message.content === nextProps.message.content &&
        prevProps.message.role === nextProps.message.role &&
        prevProps.soulprintName === nextProps.soulprintName
})

/**
 * Typing indicator for dark theme
 */
export function TypingIndicatorDark({ soulprintName = "SoulPrint" }: { soulprintName?: string }) {
    return (
        <div className="flex w-full mb-2 justify-start animate-in fade-in duration-200">
            <div className="relative pl-2 max-w-[85%]">
                <div className="relative px-4 py-3 rounded-2xl rounded-bl-md bg-[#1E1E2E] border border-zinc-800/50">
                    <div className="text-xs font-medium text-[#A78BFA] mb-2">
                        {soulprintName}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                </div>
                {/* Tail */}
                <div 
                    className="absolute bottom-0 left-0 w-3 h-3 bg-[#1E1E2E]"
                    style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
                />
            </div>
        </div>
    )
}
