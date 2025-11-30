"use client";

import { useRouter } from "next/navigation";
import { SquareTerminal, Bot, CodeXml, Book, Settings2, LifeBuoy, SquareUser, Paperclip, Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateApiKey } from "@/app/actions/api-keys";
import { useState, useEffect, useRef } from "react";
import { questions, getNextQuestion, getProgress, Question } from "@/lib/questions";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { VoiceRecorderV3 } from "@/components/voice-recorder/VoiceRecorderV3";

interface Message {
    role: "bot" | "user";
    content: string;
    timestamp: Date;
}

// Layer definitions for the gamification system
const SOULPRINT_LAYERS = [
    { id: "emotional", name: "Emotional Circuit", status: "in-progress" },
    { id: "cognitive", name: "Cognitive Rhythm", status: "locked" },
    { id: "internal", name: "Internal Core", status: "locked" },
    { id: "shadow", name: "Shadow Pattern", status: "locked" },
    { id: "perimeter", name: "The Perimeter", status: "locked" },
];

// Terminal status panel component
function TerminalStatusPanel({ 
    progress, 
    currentPhase,
    activeChannels,
    currentProcess 
}: { 
    progress: number;
    currentPhase: string;
    activeChannels: string[];
    currentProcess: string[];
}) {
    const filledBlocks = Math.floor(progress / 25);
    const progressBlocks = "■".repeat(filledBlocks) + "□".repeat(4 - filledBlocks);
    
    return (
        <div className="bg-neutral-900 border-4 border-[#2c2c2c] rounded-sm font-mono text-sm">
            {/* Terminal header */}
            <div className="bg-[#2c2c2c] border-b border-neutral-800 px-4 py-2 flex justify-between items-center">
                <span className="text-white text-xs">[SOULPRINT VECTOR]</span>
                <span className="text-white text-xs">[{progressBlocks}]</span>
            </div>
            
            {/* Terminal content */}
            <div className="p-4 space-y-4">
                <div>
                    <p className="text-white text-sm mb-1">Active Channels:</p>
                    {activeChannels.map((channel, idx) => (
                        <p key={idx} className="text-[#878791] text-xs uppercase">- {channel}</p>
                    ))}
                </div>
                
                <div>
                    <p className="text-white text-sm mb-1">Current Process:</p>
                    {currentProcess.map((process, idx) => (
                        <p key={idx} className="text-[#878791] text-xs uppercase">→ {process}</p>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Layer unlock status component
function LayerUnlockPanel({ 
    layers, 
    currentLayerIndex,
    patternDepth,
    stability 
}: { 
    layers: typeof SOULPRINT_LAYERS;
    currentLayerIndex: number;
    patternDepth: number;
    stability: number;
}) {
    return (
        <div className="bg-[#121218] border border-[#8c8c96] rounded-sm font-mono">
            <div className="px-4 py-3 border-b border-[#8c8c96]">
                <p className="text-white text-sm">Active Layer: {layers[currentLayerIndex]?.name.toUpperCase() || "CORE"}</p>
            </div>
            <div className="p-4 space-y-1">
                {layers.map((layer, idx) => {
                    let status = "LOCKED";
                    let statusColor = "text-[#878791]";
                    
                    if (idx < currentLayerIndex) {
                        status = "COMPLETE";
                        statusColor = "text-orange-500";
                    } else if (idx === currentLayerIndex) {
                        status = "IN PROGRESS";
                        statusColor = "text-green-500";
                    }
                    
                    return (
                        <p key={layer.id} className="text-[#878791] text-xs">
                            [<span className="uppercase">{layer.name}</span>]
                            <span className="ml-2">...</span>
                            <span className={statusColor}>{status}</span>
                        </p>
                    );
                })}
            </div>
            <div className="px-4 pb-4 pt-2 border-t border-[#8c8c96]/30 space-y-1">
                <p className="text-[#878791] text-xs">Pattern Depth: {patternDepth.toFixed(1)}</p>
                <p className="text-[#878791] text-xs">Stability: {stability}%</p>
                <p className="text-[#878791] text-xs">Signal Drift: Minimal</p>
            </div>
        </div>
    );
}

// Trace log component
function TraceLog({ messages }: { messages: string[] }) {
    return (
        <div className="font-mono text-xs space-y-0.5 opacity-60">
            <p className="text-[#878791]">[TRACE LOG]</p>
            {messages.map((msg, idx) => (
                <p key={idx} className="text-[#878791]">:: {msg}</p>
            ))}
        </div>
    );
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
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [traceMessages, setTraceMessages] = useState<string[]>([]);
    const [voiceAnalysisData, setVoiceAnalysisData] = useState<any | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    // Get current question object
    const currentQuestion: Question | undefined = currentQuestionId 
        ? questions.find(q => q.id === currentQuestionId) 
        : undefined;
    
    // Check if current question is a voice question
    const isVoiceQuestion = currentQuestion?.type === 'voice';

    // Initial load
    useEffect(() => {
        async function initializeUser() {
            try {
                // Get current authenticated user
                const { data: { user } } = await supabase.auth.getUser();

                if (!user || !user.email) {
                    console.error('No authenticated user found');
                    router.push('/dashboard');
                    return;
                }

                setUserEmail(user.email);

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
                    content: `Welcome ${user.email}! I'm going to ask you ${questions.length} questions to create your personalized SoulPrint. This will help AI understand you better. Let's begin!\n\n${firstQuestion.question}`,
                    timestamp: new Date()
                }]);
            } catch (error) {
                console.error('Error initializing user:', error);
                router.push('/dashboard');
            }
        }

        initializeUser();
    }, [router, supabase]);

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
                        content: "🎉 Your SoulPrint has been created! Redirecting to chat...",
                        timestamp: new Date()
                    }]);
                    setIsComplete(true);
                    localStorage.removeItem("soulprint_answers");
                    localStorage.removeItem("soulprint_current_q");
                    localStorage.removeItem("soulprint_voice_analysis");
                    
                    // Auto-redirect to chat after 2 seconds
                    setTimeout(() => {
                        router.push('/dashboard/chat');
                    }, 2000);
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

    const submitSoulPrint = async (finalAnswers: Record<string, string>, voiceData?: any) => {
        if (!userEmail) {
            throw new Error('User not authenticated');
        }

        // Build the full payload including voice analysis
        const payload: any = {
            user_id: userEmail,
            answers: finalAnswers,
            timestamp: new Date().toISOString(),
        };

        // Include voice analysis data if available
        const voiceAnalysis = voiceData || voiceAnalysisData;
        if (voiceAnalysis) {
            payload.voiceAnalysis = {
                transcript: voiceAnalysis.transcript,
                confidence: voiceAnalysis.confidence,
                wordCount: voiceAnalysis.wordCount,
                emotionalSignatureCurve: voiceAnalysis.emotionalSignature,
                llmCadenceInstructions: voiceAnalysis.llmInstructions,
                processingTime: voiceAnalysis.processingTime,
            };
            // Also include the n8n-formatted payload if available
            if (voiceAnalysis.n8nPayload) {
                payload.voiceAnalysisN8N = voiceAnalysis.n8nPayload;
            }
        }

        // Submit soulprint answers
        const response = await fetch('/api/soulprint/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to submit soulprint');
        }

        // Generate API key for the user
        try {
            const { apiKey, error: keyError } = await generateApiKey("SoulPrint Questionnaire Key");

            if (keyError) {
                console.error('Failed to generate API key:', keyError);
                // Don't throw error - soulprint was created successfully
            } else if (apiKey) {
                console.log('✅ API key generated successfully for user:', userEmail);
                localStorage.setItem("soulprint_internal_key", apiKey);
            }
        } catch (keyError) {
            console.error('Error generating API key:', keyError);
            // Don't fail the whole process if API key generation fails
        }

        return response.json();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Handler for voice analysis completion (AssemblyAI V3)
    const handleVoiceAnalysisComplete = async (result: any) => {
        if (!currentQuestionId) return;
        
        // Store the full voice analysis data for n8n
        setVoiceAnalysisData(result);
        
        // Store transcript as the answer for this question
        const voiceAnswer = result.transcript || "[Voice recording analyzed]";
        const newAnswers = { ...answers, [currentQuestionId]: voiceAnswer };
        setAnswers(newAnswers);
        
        // Add user message showing they submitted voice with transcript preview
        const transcriptPreview = result.transcript 
            ? `"${result.transcript.slice(0, 100)}${result.transcript.length > 100 ? '...' : ''}"`
            : "[Voice recording submitted]";
        setMessages(prev => [...prev, { 
            role: "user", 
            content: `🎤 ${transcriptPreview}`, 
            timestamp: new Date() 
        }]);
        
        // Save progress
        localStorage.setItem("soulprint_answers", JSON.stringify(newAnswers));
        // Also save voice analysis for persistence
        localStorage.setItem("soulprint_voice_analysis", JSON.stringify(result));
        
        const nextQuestion = getNextQuestion(currentQuestionId);
        
        // Simulate bot processing voice
        setIsTyping(true);
        setTraceMessages([
            "voice signal captured",
            `transcription: ${result.wordCount} words at ${result.emotionalSignature?.tempo?.wpm || 0} WPM`,
            `sentiment: ${result.emotionalSignature?.sentiment?.overall?.positive || 0}% positive`,
            `fillers detected: ${result.emotionalSignature?.fillers?.total || 0}`,
            "emotional signature curve™ extracted"
        ]);
        
        setTimeout(async () => {
            setIsTyping(false);
            
            // Build feedback from analysis
            const sig = result.emotionalSignature;
            const voiceFeedback = sig 
                ? `I've captured your voice signature. You spoke at ${sig.tempo?.wpm || 'N/A'} words per minute with ${sig.pauses?.count || 0} natural pauses. Your sentiment was ${sig.sentiment?.overall?.positive > 50 ? 'predominantly positive' : sig.sentiment?.overall?.negative > 30 ? 'thoughtfully cautious' : 'neutral and measured'}.`
                : "I've captured your voice signature and analyzed your communication cadence.";
            
            if (nextQuestion) {
                setMessages(prev => [...prev, {
                    role: "bot",
                    content: `${voiceFeedback}\n\n${nextQuestion.question}`,
                    timestamp: new Date()
                }]);
                setCurrentQuestionId(nextQuestion.id);
                localStorage.setItem("soulprint_current_q", nextQuestion.id);
            } else {
                // Completion flow - include voice data
                setMessages(prev => [...prev, {
                    role: "bot",
                    content: `${voiceFeedback}\n\nThanks for sharing. Generating your SoulPrint...`,
                    timestamp: new Date()
                }]);
                
                setIsSubmitting(true);
                
                try {
                    await submitSoulPrint(newAnswers, result);
                    
                    setMessages(prev => [...prev, {
                        role: "bot",
                        content: "🎉 Your SoulPrint has been created! Redirecting to chat...",
                        timestamp: new Date()
                    }]);
                    setIsComplete(true);
                    localStorage.removeItem("soulprint_answers");
                    localStorage.removeItem("soulprint_current_q");
                    localStorage.removeItem("soulprint_voice_analysis");
                    
                    setTimeout(() => {
                        router.push('/dashboard/chat');
                    }, 2000);
                } catch (error) {
                    console.error("Submission error:", error);
                    setMessages(prev => [...prev, {
                        role: "bot",
                        content: "Something went wrong generating your SoulPrint. Please try again.",
                        timestamp: new Date()
                    }]);
                    setIsSubmitting(false);
                }
            }
        }, 2000); // Longer delay for voice processing feedback
    };

    const handleVoiceError = (error: string) => {
        setMessages(prev => [...prev, {
            role: "bot",
            content: `There was an issue with the voice recording: ${error}. Please try again or type your response instead.`,
            timestamp: new Date()
        }]);
    };

    const progress = currentQuestionId ? getProgress(currentQuestionId) : 100;
    
    // Calculate current layer based on progress
    const currentLayerIndex = Math.min(Math.floor(progress / 20), SOULPRINT_LAYERS.length - 1);
    
    // Dynamic process messages based on typing state
    const activeChannels = isTyping 
        ? ["Cognitive", "Emotional", "Linguistic"] 
        : ["Cognitive", "Emotional"];
    
    const currentProcess = isTyping 
        ? ["Parsing linguistic tone markers", "Updating SoulPrint geometry", "Encrypting local signature"]
        : ["Awaiting input", "Monitoring signal stability"];

    // Get phase title based on progress
    const getPhaseTitle = () => {
        if (isComplete) return "SOULPRINT ENGAGED";
        if (progress < 33) return "INITIALIZING SCAN...";
        if (progress < 66) return "BUILDING YOUR SOULPRINT";
        return "FINALIZING PATTERN";
    };

    // Update trace messages when user sends
    useEffect(() => {
        if (Object.keys(answers).length > 0) {
            setTraceMessages([
                "channel scan complete",
                "writing fragment to local vault",
                "updating reactive mesh"
            ]);
        }
    }, [answers]);

    return (
        <div className="flex h-screen w-full bg-[#08080c]">
            {/* Left sidebar navigation */}
            <nav className="hidden md:flex w-14 flex-col justify-between border-r border-[#2c2c2c] bg-[#08080c]">
                <div className="flex flex-col items-center border-b border-[#2c2c2c] p-2">
                    <button className="flex h-9 w-9 items-center justify-center">
                        <div className="h-4 w-4 bg-[url('/images/hero-badge.png')] bg-contain bg-center bg-no-repeat" />
                    </button>
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
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]">
                        <CodeXml className="h-5 w-5 text-[#E5E5E5]" />
                    </button>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]">
                        <Book className="h-5 w-5 text-[#E5E5E5]" />
                    </button>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]">
                        <Settings2 className="h-5 w-5 text-[#E5E5E5]" />
                    </button>
                </div>
                <div className="flex flex-col items-center gap-1 p-2">
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]">
                        <LifeBuoy className="h-5 w-5 text-[#737373]" />
                    </button>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#1A1A1A]">
                        <SquareUser className="h-5 w-5 text-[#737373]" />
                    </button>
                </div>
            </nav>

            {/* Main content area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top header bar - cyberpunk style */}
                <header className="flex h-14 items-center justify-between border-b border-[#2c2c2c] bg-[#08080c] px-4 md:px-6">
                    <div className="flex items-center gap-4">
                        <h1 className="font-mono text-lg md:text-xl font-bold text-white tracking-wider">
                            {getPhaseTitle()}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[#878791] hidden sm:block">
                            SCANNING IDENTITY CHANNELS...
                        </span>
                        {isComplete && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center"
                            >
                                <span className="text-white text-xs">✓</span>
                            </motion.div>
                        )}
                    </div>
                </header>

                {/* Main grid layout */}
                <main className="flex-1 overflow-hidden p-4 md:p-6">
                    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-4">
                        
                        {/* Left panel - Question/Chat terminal */}
                        <div className="flex flex-col bg-[#08080c] border-4 border-[#2c2c2c] rounded-sm overflow-hidden">
                            {/* Terminal header */}
                            <div className="bg-[#2c2c2c] border-b border-neutral-800 px-4 py-2 flex justify-between items-center flex-shrink-0">
                                <span className="text-white font-mono text-xs">[SOULPRINT VECTOR]</span>
                                <span className="text-[#878791] font-mono text-xs">
                                    Q{Object.keys(answers).length + 1}/{questions.length}
                                </span>
                            </div>
                            
                            {/* Chat/Question area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map((msg, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        {msg.role === "bot" ? (
                                            <div className="max-w-[85%]">
                                                <p className="font-mono text-sm text-neutral-50 whitespace-pre-line leading-relaxed">
                                                    {msg.content}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="max-w-[85%] bg-gradient-to-r from-[#19191e] to-[#08080c] border border-[#2c2c2c] rounded px-4 py-3">
                                                <p className="font-mono text-sm text-neutral-300 whitespace-pre-line">
                                                    {msg.content}
                                                </p>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}

                                {isTyping && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex justify-start"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-[#878791]">Processing</span>
                                            <div className="flex gap-1">
                                                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input area - terminal style */}
                            {!isComplete && (
                                <div className="border-t border-[#2c2c2c] p-4 flex-shrink-0">
                                    {isVoiceQuestion ? (
                                        /* Voice Recording Interface */
                                        <div className="bg-gradient-to-r from-[#19191e] to-[#08080c] rounded border border-[#2c2c2c] p-4">
                                            <div className="mb-4">
                                                <p className="font-mono text-xs text-orange-400 mb-2">
                                                    🎤 VOICE INPUT MODE
                                                </p>
                                                {currentQuestion?.voicePrompt && (
                                                    <p className="font-mono text-xs text-[#878791] mb-4">
                                                        {currentQuestion.voicePrompt}
                                                    </p>
                                                )}
                                            </div>
                                            <VoiceRecorderV3
                                                minDuration={currentQuestion?.minDuration || 5}
                                                maxDuration={currentQuestion?.maxDuration || 120}
                                                questionText={currentQuestion?.voicePrompt}
                                                onAnalysisComplete={handleVoiceAnalysisComplete}
                                            />
                                        </div>
                                    ) : (
                                        /* Text Input Interface */
                                        <div className="bg-gradient-to-r from-[#19191e] to-[#08080c] rounded border border-[#2c2c2c]">
                                            <textarea
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyPress={handleKeyPress}
                                                placeholder={currentQuestion?.placeholder || "_"}
                                                disabled={isTyping || isSubmitting}
                                                className="w-full h-24 resize-none bg-transparent font-mono text-sm text-neutral-50 placeholder:text-[#878791] focus:outline-none p-4 disabled:opacity-50"
                                            />
                                            <div className="flex items-center justify-between px-4 pb-3">
                                                <div className="flex gap-2">
                                                    <button className="flex h-8 w-8 items-center justify-center rounded hover:bg-[#2c2c2c] transition-colors">
                                                        <Paperclip className="h-4 w-4 text-[#878791]" />
                                                    </button>
                                                    <button className="flex h-8 w-8 items-center justify-center rounded hover:bg-[#2c2c2c] transition-colors">
                                                        <Mic className="h-4 w-4 text-[#878791]" />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={handleSend}
                                                    disabled={!input.trim() || isTyping || isSubmitting}
                                                    className="font-mono text-xs border border-white text-white px-4 py-1.5 hover:bg-white hover:text-black transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white"
                                                >
                                                    Execute
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right panel - Status panels */}
                        <div className="hidden lg:flex flex-col gap-4 overflow-y-auto">
                            {/* Status terminal */}
                            <TerminalStatusPanel
                                progress={progress}
                                currentPhase={getPhaseTitle()}
                                activeChannels={activeChannels}
                                currentProcess={currentProcess}
                            />

                            {/* Layer unlock panel */}
                            <LayerUnlockPanel
                                layers={SOULPRINT_LAYERS}
                                currentLayerIndex={currentLayerIndex}
                                patternDepth={1.0 + (progress / 100) * 0.5}
                                stability={Math.min(82 + Math.floor(progress / 10), 100)}
                            />

                            {/* Trace log */}
                            {traceMessages.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-[#121218] border border-[#2c2c2c] rounded-sm p-4"
                                >
                                    <TraceLog messages={traceMessages} />
                                </motion.div>
                            )}

                            {/* Soulprint visualizer placeholder */}
                            <div className="bg-[#121218] border border-[#8c8c96] rounded-sm p-4 flex-1 min-h-[150px] flex items-center justify-center">
                                <div className="relative w-32 h-32">
                                    <motion.div
                                        className="absolute inset-0 border-2 border-orange-500/30 rounded-full"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                    />
                                    <motion.div
                                        className="absolute inset-2 border border-orange-500/50 rounded-full"
                                        animate={{ rotate: -360 }}
                                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                    />
                                    <motion.div
                                        className="absolute inset-4 border border-orange-500/70 rounded-full"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full opacity-80" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
