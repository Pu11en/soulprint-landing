"use client"

import { cn } from "@/lib/utils"

interface QuestionnaireStep {
    id: number
    title: string
    subtitle: string
    isCompleted: boolean
    isCurrent: boolean
}

interface QuestionnaireProgressProps {
    currentStep: number
    completedSteps: number[]
}

const QUESTIONNAIRE_STEPS = [
    { id: 1, title: "PART ONE", subtitle: "Communication" },
    { id: 2, title: "PART TWO", subtitle: "BRAND LANGUAGE LAYER" },
    { id: 3, title: "PART THREE", subtitle: "Risk Analysis" },
    { id: 4, title: "PART FOUR", subtitle: "Processing" },
    { id: 5, title: "PART FIVE", subtitle: "Conflict" },
    { id: 6, title: "PART SIX", subtitle: "Core" },
]

export function QuestionnaireProgress({ 
    currentStep, 
    completedSteps 
}: QuestionnaireProgressProps) {
    const steps: QuestionnaireStep[] = QUESTIONNAIRE_STEPS.map(step => ({
        ...step,
        isCompleted: completedSteps.includes(step.id),
        isCurrent: step.id === currentStep
    }))

    return (
        <div className="relative bg-white border border-black/10 rounded-sm p-6 w-full max-w-[431px]">
            {/* Vertical timeline line */}
            <div className="absolute left-[54px] top-[36px] w-0.5 h-[calc(100%-72px)] bg-[#878791]" />

            {/* Steps */}
            <div className="relative flex flex-col gap-6 ml-[45px]">
                {steps.map((step) => (
                    <div key={step.id} className="relative flex items-start gap-4">
                        {/* Circle indicator */}
                        <div 
                            className={cn(
                                "absolute -left-[45px] w-[18px] h-[17px] rounded-full border-2 border-orange-600 z-10",
                                step.isCompleted ? "bg-[#D6D3D1]" : "bg-white"
                            )}
                        />
                        
                        {/* Step content */}
                        <div className="flex flex-col">
                            <span className="font-mono text-base leading-6 text-black">
                                {step.title}
                            </span>
                            <span className="font-mono text-base leading-6 text-black">
                                {step.subtitle}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function StepCompletionCard({
    partNumber,
    onNext
}: {
    partNumber: string
    partName?: string
    onNext: () => void
}) {
    return (
        <div className="bg-white border border-black/10 rounded-[10px] p-6 w-full max-w-[659px]">
            <p className="font-geist font-semibold text-base leading-6 text-black/80 mb-8">
                You have completed {partNumber}. Press Next to continue to the next section.
            </p>
            
            <div className="flex justify-end">
                <button
                    onClick={onNext}
                    className="flex items-center justify-center px-6 py-2 h-10 bg-orange-600 text-white font-geist font-medium text-sm rounded-lg shadow-[0px_1px_2px_rgba(0,0,0,0.05)] hover:bg-orange-700 transition-colors"
                >
                    Next
                </button>
            </div>
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SoulPrintReadyCard(_props: {
    onDeploy?: () => void
}) {
    const aiPlatforms = [
        { name: "ChatGPT", icon: "/images/chatgpt-icon.png" },
        { name: "Gemini", icon: "/images/gemini-icon.png" },
        { name: "Claude", icon: "/images/claude-icon.png" },
        { name: "Perplexity", icon: "/images/perplexity-icon.png" },
    ]

    return (
        <div className="bg-white border border-black/10 rounded-[10px] p-8 w-full max-w-[668px]">
            {/* Header message */}
            <p className="font-geist font-semibold text-base leading-6 text-black/80 mb-8">
                Your SoulPrint is ready. You are set to deploy your SoulPrint to your own LLM. 
                For the best experience use Chat GPT Plus or the equivalent.
            </p>

            {/* AI Platform Icons */}
            <div className="flex justify-center gap-6 my-12">
                {aiPlatforms.map((platform) => (
                    <div 
                        key={platform.name}
                        className="w-20 h-20 bg-white border border-[#D6D3D1] rounded-2xl flex items-center justify-center hover:border-orange-600 transition-colors cursor-pointer"
                    >
                        {/* Placeholder - replace with actual icons */}
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-500">
                            {platform.name.slice(0, 2)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer message */}
            <p className="font-geist font-semibold text-base leading-6 text-black/80">
                This token expires in 24 hours. Please return tomorrow to activate your SoulPrint.
            </p>
        </div>
    )
}
