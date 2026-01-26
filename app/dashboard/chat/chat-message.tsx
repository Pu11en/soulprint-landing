import { memo } from "react"
import { Bot, User } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from "@/lib/utils"

interface Message {
    role: "user" | "assistant"
    content: string
}

interface ChatMessageProps {
    message: Message
}

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
    return (
        <div className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
            {message.role === "assistant" && (
                <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-600"
                >
                    <Bot className="h-4 w-4 text-white" />
                </div>
            )}
            <div className={cn(
                "max-w-[85%] rounded-xl p-4 text-sm leading-relaxed",
                message.role === "user"
                    ? "bg-orange-600 text-white"
                    : "bg-zinc-800 border border-zinc-700 text-zinc-100"
            )}>
                {message.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                ul: ({ children }) => <ul className="list-disc pl-4 space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1">{children}</ol>,
                                h2: ({ children }) => <h2 className="text-base font-bold text-zinc-100 mt-4 mb-2">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-sm font-semibold text-zinc-100 mt-3 mb-1">{children}</h3>,
                                strong: ({ children }) => <span className="font-bold text-orange-400">{children}</span>,
                                p: ({ children }) => <p className="mb-2 last:mb-0 text-zinc-200">{children}</p>,
                                a: ({ href, children }) => (
                                    <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-orange-400 underline hover:text-orange-300"
                                    >
                                        {children}
                                    </a>
                                )
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    message.content
                )}
            </div>
            {message.role === "user" && (
                <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-600 text-white"
                >
                    <User className="h-4 w-4" />
                </div>
            )}
        </div>
    )
}, (prevProps, nextProps) => {
    return prevProps.message.content === nextProps.message.content &&
        prevProps.message.role === nextProps.message.role
})
