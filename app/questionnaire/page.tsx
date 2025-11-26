"use client";

import { useRouter } from "next/navigation";
import { SquareTerminal, Bot, CodeXml, Book, Settings2, LifeBuoy, SquareUser, Paperclip, Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { questions, getNextQuestion, getProgress } from "@/lib/questions";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
    role: "bot" | "user";
    content: string;
    timestamp: Date;
}

export default function QuestionnairePage() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isComplete, setIsComplete] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial load
    useEffect(() => {
        // Check local storage for existing progress
        const savedAnswers = localStorage.getItem("soulprint_answers");
        const savedQuestionId = localStorage.getItem("soulprint_current_q");

        if (savedAnswers && savedQuestionId) {
            setAnswers(JSON.parse(savedAnswers));
            setCurrentQuestionId(savedQuestionId);
            // Reconstruct messages history (simplified for now, ideally we'd save messages too)
            // For this demo, we'll just start fresh or maybe just reset to start if complex
            // Let's just start fresh for simplicity but keep the logic ready
        }

        const firstQuestion = questions[0];
        setCurrentQuestionId(firstQuestion.id);
        setMessages([{
            role: "bot",
            content: `Welcome! I'm going to ask you ${questions.length} questions to create your personalized SoulPrint. This will help AI understand you better. Let's begin!\n\n${firstQuestion.question}`,
            timestamp: new Date()
        }]);
    }, []);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || !currentQuestionId || isSubmitting) return;

        // UX: Minimum character validation
        if (input.length < 2) {
            // Could show a toast here, but for now just return
            return;
        }

        const currentInput = input;
        setInput(""); // Clear input immediately

        // Add user message
        const newAnswers = { ...answers, [currentQuestionId]: currentInput };
        setAnswers(newAnswers);
        setMessages(prev => [...prev, { role: "user", content: currentInput, timestamp: new Date() }]);

        // Save progress
        localStorage.setItem("soulprint_answers", JSON.stringify(newAnswers));

        const nextQuestion = getNextQuestion(currentQuestionId);

        // Simulate bot thinking/typing
        setIsTyping(true);

        // Randomize delay for natural feel (1-2 seconds)
        const delay = Math.floor(Math.random() * 1000) + 1000;

        setTimeout(async () => {
            setIsTyping(false);

            // Acknowledgments
            const acknowledgments = ["Got it.", "Interesting.", "I hear you.", "Thanks for sharing.", "Noted.", "That makes sense."];
            const randomAck = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];

            if (nextQuestion) {
                setMessages(prev => [...prev, {
                    role: "bot",
                    content: `${randomAck}\n\n${nextQuestion.question}`,
                    timestamp: new Date()
                }]);
                setCurrentQuestionId(nextQuestion.id);
                localStorage.setItem("soulprint_current_q", nextQuestion.id);
            } else {
                // Completion flow
                setMessages(prev => [...prev, {
                    role: "bot",
                    content: "Thanks for sharing. Generating your SoulPrint...",
                    timestamp: new Date()
                }]);

                setIsSubmitting(true);

                try {
                    await submitSoulPrint(newAnswers);

                    setMessages(prev => [...prev, {
                        role: "bot",
                        content: "🎉 Your SoulPrint has been created! Your AI will now understand you better.",
                        timestamp: new Date()
                    }]);
                    setIsComplete(true);
                    localStorage.removeItem("soulprint_answers");
                    localStorage.removeItem("soulprint_current_q");
                } catch (error) {
                    console.error("Submission error:", error);
                    setMessages(prev => [...prev, {
                        role: "bot",
                        content: "Something went wrong generating your SoulPrint. Please try again.",
                        timestamp: new Date()
                    }]);
                    setIsSubmitting(false); // Allow retry
                }
            }
        }, delay);
    };

    const submitSoulPrint = async (finalAnswers: Record<string, string>) => {
        const response = await fetch('/api/soulprint/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: 'test', // Demo mode user ID
                answers: finalAnswers
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to submit soulprint');
        }

        return response.json();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const progress = currentQuestionId ? getProgress(currentQuestionId) : 100;

    return (
        <div className="flex h-screen w-full bg-[#27272A]">
            <nav className="flex w-14 flex-col justify-between border border-[#111111] bg-[#111111]">
                <div className="flex flex-col items-center border-b border-[#111111] p-2">
                    <button className="flex h-9 w-9 items-center justify-center"><div className="h-4 w-4 bg-[url('/images/hero-badge.png')] bg-contain bg-center bg-no-repeat" /></button>
                </div>
                <div className="flex flex-1 flex-col items-center gap-1 p-2">
                    <button
                        onClick={() => router.push('/questionnaire')}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EA580C] opacity-80"
                    >
                        <SquareTerminal className="h-5 w-5 text-[#E5E5E5]" />
                    </button>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]"
                    >
                        <Bot className="h-5 w-5 text-[#E5E5E5]" />
                    </button>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]"><CodeXml className="h-5 w-5 text-[#E5E5E5]" /></button>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]"><Book className="h-5 w-5 text-[#E5E5E5]" /></button>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]"><Settings2 className="h-5 w-5 text-[#E5E5E5]" /></button>
                </div>
                <div className="flex flex-col items-center gap-1 p-2">
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]"><LifeBuoy className="h-5 w-5 text-[#737373]" /></button>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]"><SquareUser className="h-5 w-5 text-[#737373]" /></button>
                </div>
            </nav>

            <div className="flex flex-1 flex-col">
                <header className="flex h-13 items-center justify-between border-b border-[#111111] bg-[#111111] px-4">
                    <div className="flex items-center gap-4">
                        <h1 className="font-koulen text-[24px] leading-[38px] text-[#F5F5F5] lg:text-[32px]"><span className="lg:hidden">SOULPRINT</span></h1>
                        {!isComplete && (
                            <div className="hidden lg:flex items-center gap-2">
                                <div className="h-2 w-48 rounded-full bg-[#27272A]"><div className="h-full rounded-full bg-[#EA580C] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
                                <span className="font-geist text-xs text-[#737373]">{Math.round(progress)}%</span>
                            </div>
                        )}
                    </div>
                    <Button
                        className="h-9 rounded-lg bg-[#EA580C] px-4 font-geist text-sm font-medium text-[#E5E5E5] hover:bg-[#EA580C]/90"
                        disabled={!isComplete}
                        onClick={() => router.push('/dashboard')}
                    >
                        {isComplete ? "View SoulPrint" : "Save"}
                    </Button>
                </header>

                <main className="flex flex-1 flex-col justify-end p-4">
                    <div
                        className="h-full w-full rounded-[14px] p-4 shadow-[0px_4px_4px_2px_rgba(0,0,0,0.25)] flex flex-col"
                        style={{
                            background: `linear-gradient(0deg, rgba(10, 10, 10, 0.7), rgba(10, 10, 10, 0.7)), url('/images/grunge-bg.png')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                    >
                        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-start gap-3"
                                >
                                    {msg.role === "bot" && <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#EA580C]"><Bot className="h-4 w-4 text-white" /></div>}
                                    <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === "bot" ? "bg-[#171717] text-[#FAFAFA]" : "bg-[#EA580C] text-white ml-auto"}`}>
                                        <p className="font-geist text-sm whitespace-pre-line">{msg.content}</p>
                                    </div>
                                </motion.div>
                            ))}

                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex items-start gap-3"
                                >
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#EA580C]"><Bot className="h-4 w-4 text-white" /></div>
                                    <div className="bg-[#171717] rounded-lg p-3">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {!isComplete && (
                            <div className="flex flex-col gap-3 rounded-lg border border-[#737373] bg-[#121212] p-3">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Type your answer here..."
                                    disabled={isTyping || isSubmitting}
                                    className="h-[60px] w-full resize-none bg-transparent font-geist text-sm text-[#FAFAFA] placeholder:text-[#A3A3A3] focus:outline-none disabled:opacity-50"
                                />
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-1">
                                        <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#1A1A1A]"><Paperclip className="h-4 w-4 text-[#737373]" /></button>
                                        <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#1A1A1A]"><Mic className="h-4 w-4 text-[#737373]" /></button>
                                    </div>
                                    <Button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isTyping || isSubmitting}
                                        className="h-9 rounded-lg bg-[#EA580C] px-4 font-geist text-sm font-medium text-[#E5E5E5] hover:bg-[#EA580C]/90 disabled:opacity-50"
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        {isSubmitting ? "Sending..." : "Send"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
