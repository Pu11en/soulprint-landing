"use client"

import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

const llmOptions = [
    { id: "chatgpt", label: "CHAT GPT" },
    { id: "claude", label: "CLAUDE" },
    { id: "gemini", label: "GEMINI" },
    { id: "local", label: "LOCAL" },
]

export function LLMSelector() {
    return (
        <div className="flex flex-col gap-4">
            <h2 className="mb-4 text-base sm:text-lg font-mono text-gray-400">
                Define the LLM you want to use
                <br />
                -
            </h2>
            <div className="flex flex-col gap-3 sm:gap-4">
                {llmOptions.map((option) => (
                    option.id === "chatgpt" ? (
                        <Link key={option.id} href="/dashboard/chat">
                            <button className="flex h-12 sm:h-10 w-full items-center gap-3 rounded-lg bg-[#222222] px-4 py-2 transition-colors hover:bg-[#2A2A2A]">
                                <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#10A37F]">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12.0002 0.300049C5.3502 0.300049 0.000198364 5.65005 0.000198364 12.3001C0.000198364 18.9501 5.3502 24.3001 12.0002 24.3001C18.6502 24.3001 24.0002 18.9501 24.0002 12.3001C24.0002 5.65005 18.6502 0.300049 12.0002 0.300049ZM12.0002 21.9001C6.6902 21.9001 2.4002 17.6101 2.4002 12.3001C2.4002 6.99005 6.6902 2.70005 12.0002 2.70005C17.3102 2.70005 21.6002 6.99005 21.6002 12.3001C21.6002 17.6101 17.3102 21.9001 12.0002 21.9001Z" fill="white" />
                                    </svg>
                                </div>
                                <span className="text-sm font-medium text-[#E5E5E5]">Chat GPT</span>
                            </button>
                        </Link>
                    ) : (
                        <button
                            key={option.id}
                            className={cn(
                                "group flex h-14 sm:h-auto items-center justify-between rounded-md border border-[#333] bg-[#111] px-4 sm:px-6 py-3 sm:py-4 text-sm font-mono tracking-wider text-gray-300 transition-all hover:border-gray-500 hover:bg-[#1a1a1a]",
                            )}
                        >
                            <span>{option.label}</span>
                            <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                    )
                ))}
            </div>
        </div>
    )
}
