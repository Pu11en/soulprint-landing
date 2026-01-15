"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ProgressStepper, PILLARS } from "@/components/dashboard/progress-stepper"
import { questions, Question } from "@/lib/questions"
import { createClient } from "@/lib/supabase/client"
import { VoiceRecorderV3 } from "@/components/voice-recorder/VoiceRecorderV3"
import Image from "next/image"

// --- PRESETS FOR DEV TESTING ---
const ACE_ANSWERS: Record<string, any> = {
    s1: 100, s2: 0, s3: 100, s4: 100, s5: 0, s6: 0, s7: 0, s8: 0, s9: 0, s10: 100, s11: 0, s12: 50, s13: 100, s14: 100, s15: 0, s16: 0, s17: 100, s18: 0,
    q1: "I don't have a tone. I have a frequency. You either tune in or you break.",
    q2: "Reloading.",
    q3: "We don't ask for permission. We build the thing that makes permission irrelevant.",
    q4: "Weakness.",
    q5: "I don't reset. I reload.",
    q6: "Never.",
    q7: "I waited too long to kill a bad feature. It cost me 6 weeks.",
    q8: "If you aren't risking it all, you aren't playing.",
    q9: "Yes. Because he's going to be richer than me.",
    q10: "The war room.",
    q11: "Win at all costs.",
    q12: "Killers.",
    q13: "Doing it.",
    q14: "Excuses.",
    q15: "Ship it and see what breaks.",
    q16: "Destroy them.",
    q17: "Fuel.",
    q18: "Relentless."
};

const SAGE_ANSWERS: Record<string, any> = {
    s1: 100, s2: 100, s3: 0, s4: 50, s5: 100, s6: 100, s7: 100, s8: 100, s9: 100, s10: 0, s11: 0, s12: 0, s13: 100, s14: 100, s15: 100, s16: 100, s17: 0, s18: 100,
    q1: "That I'm judging them. I'm just listening deeply.",
    q2: "A sacred space where truth can emerge.",
    q3: "We are all walking each other home.",
    q4: "My own needs.",
    q5: "Nature. Silence. Tea.",
    q6: "When a client made a breakthrough I didn't see coming.",
    q7: "I spoke too soon and broke the trust.",
    q8: "Vulnerability is the only risk.",
    q9: "Yes, because I am planting seeds today.",
    q10: "A circle of elders.",
    q11: "Compassion first.",
    q12: "Those who are doing the work.",
    q13: "Reflection.",
    q14: "Surface level chatter.",
    q15: "Journaling.",
    q16: "Pause and reflect.",
    q17: "Transform.",
    q18: "Safe."
};

export default function NewQuestionnairePage() {
    const router = useRouter()
    const supabase = createClient()

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [answers, setAnswers] = useState<Record<string, string | number | object>>({})
    const [textInput, setTextInput] = useState("")
    const [sliderValue, setSliderValue] = useState([50])
    const [voiceRecorded, setVoiceRecorded] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const currentQuestion = questions[currentQuestionIndex]

    // Calculate pillar info based on question category
    const categoryToPillar: Record<string, number> = {
        communication: 1,
        emotional: 2,
        decision: 3,
        social: 4,
        cognitive: 5,
        conflict: 6
    }
    const currentPillar = currentQuestion ? categoryToPillar[currentQuestion.category] || 1 : 1

    // Count questions in current pillar
    const questionsInCurrentPillar = questions.filter(q => q.category === currentQuestion?.category)
    const questionInPillar = questionsInCurrentPillar.findIndex(q => q.id === currentQuestion?.id) + 1
    const totalQuestionsInPillar = questionsInCurrentPillar.length

    // Get pillar name
    const pillarInfo = PILLARS.find(p => p.id === currentPillar)
    const pillarName = pillarInfo?.subtitle || "Unknown"

    const [limitReached, setLimitReached] = useState(false)
    const [hasAnySoulprint, setHasAnySoulprint] = useState(false)

    // Check limits and load saved answers
    useEffect(() => {
        async function checkLimit() {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { count } = await supabase
                    .from('soulprints')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)

                if (count !== null) {
                    setHasAnySoulprint(count > 0)
                    if (count >= 2) {
                        setLimitReached(true)
                    }
                }
            }
        }
        checkLimit()

        const savedAnswers = localStorage.getItem("soulprint_answers")
        const savedIndex = localStorage.getItem("soulprint_current_index")

        if (savedAnswers) {
            setAnswers(JSON.parse(savedAnswers))
        }
        if (savedIndex) {
            setCurrentQuestionIndex(parseInt(savedIndex))
        }
    }, [supabase])

    // Load current question's answer when navigating
    useEffect(() => {
        const savedAnswer = answers[currentQuestion?.id]
        if (currentQuestion?.type === "slider") {
            setSliderValue([typeof savedAnswer === "number" ? savedAnswer : 50])
        } else if (currentQuestion?.type === "voice") {
            setVoiceRecorded(!!savedAnswer)
        } else {
            setTextInput(typeof savedAnswer === "string" ? savedAnswer : "")
        }
    }, [currentQuestionIndex, currentQuestion?.id, currentQuestion?.type])

    // Save answer for current question
    const saveCurrentAnswer = () => {
        // Voice questions are saved via onAnalysisComplete callback
        if (currentQuestion.type === "voice") {
            localStorage.setItem("soulprint_current_index", currentQuestionIndex.toString())
            return answers
        }
        const answer = currentQuestion.type === "slider" ? sliderValue[0] : textInput
        const newAnswers = { ...answers, [currentQuestion.id]: answer }
        setAnswers(newAnswers)
        localStorage.setItem("soulprint_answers", JSON.stringify(newAnswers))
        localStorage.setItem("soulprint_current_index", currentQuestionIndex.toString())
        return newAnswers
    }

    // Handle voice recording completion
    const handleVoiceComplete = (result: any) => {
        const newAnswers = {
            ...answers,
            [currentQuestion.id]: {
                transcript: result.transcript,
                emotionalSignature: result.emotionalSignature
            }
        }
        setAnswers(newAnswers)
        setVoiceRecorded(true)
        localStorage.setItem("soulprint_answers", JSON.stringify(newAnswers))
    }

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            saveCurrentAnswer()
            setCurrentQuestionIndex(currentQuestionIndex - 1)
        }
    }

    const handleNext = async () => {
        if (currentQuestion?.type === "voice" && !voiceRecorded) {
            return
        }
        const updatedAnswers = saveCurrentAnswer()

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1)
        } else {
            // Last question - submit
            setIsSubmitting(true)
            try {
                // Get user
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    router.push('/')
                    return
                }

                // Layer 2 Safety: Verify profile exists before processing
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('id', user.id)
                    .maybeSingle();

                if (!profile) {
                    console.log('🛡️ Layer 2: Self-healing missing profile before submission');
                    await supabase.from('profiles').insert({
                        id: user.id,
                        email: user.email!,
                        full_name: user.user_metadata?.full_name || '',
                        avatar_url: user.user_metadata?.avatar_url || ''
                    });
                }

                // Navigate to completion page
                router.push('/questionnaire/complete')
            } catch (error) {
                console.error('Error:', error)
                setIsSubmitting(false)
            }
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        localStorage.removeItem("soulprint_answers")
        localStorage.removeItem("soulprint_current_index")
        router.push('/')
    }

    const handleDevFill = (archetype: 'ACE' | 'SAGE') => {
        // Fast-track: Generate answers for ALL questions based on archetype
        let preset = archetype === 'ACE' ? ACE_ANSWERS : SAGE_ANSWERS;

        // Add dummy voice if needed (though presets cover text)
        const filledAnswers: Record<string, string | number | object> = { ...preset };

        // Ensure voice questions have a dummy object structure
        questions.forEach(q => {
            if (q.type === "voice" && !filledAnswers[q.id]) {
                filledAnswers[q.id] = {
                    transcript: archetype === 'ACE' ? "Let's build this." : "I am listening.",
                    emotionalSignature: { sentiment: { score: 0.8, label: "positive" } }
                }
            }
        });

        // Set state
        setAnswers(filledAnswers)

        // Jump to last question
        const lastIndex = questions.length - 1
        setCurrentQuestionIndex(lastIndex)

        // Update storage
        localStorage.setItem("soulprint_answers", JSON.stringify(filledAnswers))
        localStorage.setItem("soulprint_current_index", lastIndex.toString())

        // Sync local input state for the final question
        const lastQ = questions[lastIndex]
        if (lastQ.type === "slider") {
            setSliderValue([filledAnswers[lastQ.id] as number])
        } else if (lastQ.type === "voice") {
            setVoiceRecorded(true)
        } else {
            setTextInput(filledAnswers[lastQ.id] as string)
        }
    }

    const isLastQuestion = currentQuestionIndex === questions.length - 1
    const isFirstQuestion = currentQuestionIndex === 0

    if (limitReached) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#111] p-4 text-center">
                <div className="max-w-md space-y-6 rounded-xl border border-[#333] bg-[#222] p-8 shadow-xl">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-900/30 text-orange-500">
                        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <h1 className="font-koulen text-3xl text-white">Limit Reached</h1>
                    <p className="text-gray-400">
                        You have reached the maximum of 2 SoulPrints. Please delete an existing SoulPrint to create a new one.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={() => router.push('/dashboard/profile')}
                            className="bg-[#EA580C] hover:bg-orange-700 text-white"
                        >
                            Manage My SoulPrints
                        </Button>
                        <Button
                            onClick={() => router.push('/dashboard')}
                            variant="ghost"
                            className="text-gray-400 hover:text-white"
                        >
                            Back to Dashboard
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-[#d4d4d8]">
            {/* Sidebar */}
            <Sidebar hasSoulprint={hasAnySoulprint} />

            {/* Main Content */}
            <div className="flex flex-1 flex-col">
                {/* Top Bar */}
                <header className="flex h-[52px] items-center justify-between border-b border-[#111] bg-[#111] px-4">
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <Image
                                src="/images/Soulprintengine-logo.png"
                                alt="SoulPrint"
                                width={28}
                                height={28}
                                className="object-contain"
                            />
                            <span className="font-koulen text-[22px] leading-[26px] text-white tracking-wide">
                                SOULPRINT
                            </span>
                            <span className="font-cinzel font-normal text-[20px] leading-[26px] tracking-[1px] uppercase text-white -ml-1">
                                ENGINE
                            </span>
                        </Link>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="hidden lg:flex items-center gap-2">
                            <Button
                                onClick={() => handleDevFill('ACE')}
                                variant="outline"
                                className="h-9 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                            >
                                FILL: ACE
                            </Button>
                            <Button
                                onClick={() => handleDevFill('SAGE')}
                                variant="outline"
                                className="h-9 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                            >
                                FILL: SAGE
                            </Button>
                        </div>
                        <Button
                            onClick={() => router.push('/dashboard/profile')}
                            variant="ghost"
                            className="h-9 text-gray-400 hover:text-white hover:bg-gray-800"
                        >
                            Exit
                        </Button>
                        <Button
                            onClick={handleLogout}
                            className="h-9 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
                        >
                            Log out
                        </Button>
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-hidden p-4">
                    <div className="flex h-full gap-4">
                        {/* Left Side - Question Area */}
                        <div className="flex flex-1 flex-col rounded-xl bg-[#FAFAFA] p-6 shadow-[0px_4px_4px_2px_rgba(0,0,0,0.25)]">
                            {/* Header */}
                            <div className="mb-6">
                                <p className="font-inter text-sm font-medium text-black opacity-80 mb-2">
                                    {pillarName} | PART {currentPillar} - Question {questionInPillar} of {totalQuestionsInPillar}
                                </p>
                                <h1 className="font-koulen text-[32px] leading-[38px] text-black tracking-wide">
                                    LET'S BUILD YOUR SOULPRINT
                                </h1>
                            </div>

                            {/* Question Card */}
                            <div className="flex-1 rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
                                {/* Question Text */}
                                <p className="font-inter text-base leading-6 text-black opacity-80 mb-6">
                                    {currentQuestion?.question}
                                </p>

                                {/* Answer Area */}
                                {currentQuestion?.type === "slider" ? (
                                    <div className="mt-8">
                                        {/* Percentage Display */}
                                        <div className="mb-4 flex justify-center">
                                            <span className="font-inter text-3xl font-semibold text-orange-600">
                                                {sliderValue[0]}%
                                            </span>
                                        </div>
                                        <Slider
                                            value={sliderValue}
                                            onValueChange={setSliderValue}
                                            max={100}
                                            min={1}
                                            step={1}
                                            className="w-full"
                                        />
                                        <div className="mt-4 flex justify-between text-sm text-gray-500">
                                            <span>{currentQuestion.leftLabel}</span>
                                            <span>{currentQuestion.rightLabel}</span>
                                        </div>
                                    </div>
                                ) : currentQuestion?.type === "voice" ? (
                                    <div className="mt-4">
                                        <p className="mb-4 text-sm text-gray-600">
                                            {currentQuestion.voicePrompt}
                                        </p>
                                        <VoiceRecorderV3
                                            onAnalysisComplete={handleVoiceComplete}
                                            onError={(err) => console.error(err)}
                                            minDuration={0}
                                            maxDuration={currentQuestion.maxDuration || 90}
                                            questionText={currentQuestion.question}
                                            autoSubmit={true}
                                            compact={true}
                                        />
                                        {voiceRecorded && (
                                            <p className="mt-4 text-sm text-green-600 flex items-center gap-2">
                                                <span className="inline-block w-2 h-2 bg-green-600 rounded-full"></span>
                                                Voice recording saved!
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <textarea
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        placeholder={currentQuestion?.placeholder || "Type your answer..."}
                                        className="h-[200px] w-full resize-none rounded-lg border border-gray-200 bg-[#f5f5f5] p-4 font-inter text-base text-black placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                )}
                            </div>

                            {/* Navigation Buttons */}
                            <div className="mt-6 flex justify-end gap-3">
                                {!isFirstQuestion && (
                                    <Button
                                        onClick={handlePrevious}
                                        variant="secondary"
                                        className="h-10 rounded-lg bg-[#f5f5f5] px-6 py-2 text-sm font-medium text-[#171717] hover:bg-gray-200"
                                    >
                                        Previous
                                    </Button>
                                )}
                                <Button
                                    onClick={handleNext}
                                    disabled={isSubmitting || (currentQuestion?.type === "voice" && !voiceRecorded)}
                                    className="h-10 rounded-lg bg-[#EA580C] px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 disabled:opacity-50"
                                >
                                    {isSubmitting ? "Submitting..." : isLastQuestion ? "Finish SoulPrint" : "Next"}
                                </Button>
                            </div>
                        </div>

                        {/* Right Side - Progress Stepper */}
                        <ProgressStepper
                            currentPart={currentPillar}
                            currentQuestion={questionInPillar}
                            totalQuestionsInPart={totalQuestionsInPillar}
                        />
                    </div>
                </main>
            </div>
        </div>
    )
}
