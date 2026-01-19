"use client"

interface ProgressStepperProps {
    currentPart: number
    currentQuestion?: number
    totalQuestionsInPart?: number
}

export const PILLARS = [
    { id: 1, name: "PART ONE", subtitle: "Communication Style", category: "communication" },
    { id: 2, name: "PART TWO", subtitle: "Emotional Alignment", category: "emotional" },
    { id: 3, name: "PART THREE", subtitle: "Decision-Making & Risk", category: "decision" },
    { id: 4, name: "PART FOUR", subtitle: "Social & Cultural Identity", category: "social" },
    { id: 5, name: "PART FIVE", subtitle: "Cognitive Processing", category: "cognitive" },
    { id: 6, name: "PART SIX", subtitle: "Assertiveness & Conflict", category: "conflict" },
]

// Mobile Progress Indicator - compact horizontal display
interface MobileProgressProps {
    currentPart: number
    currentQuestion?: number
    totalQuestionsInPart?: number
    pillarName: string
}

export function MobileProgress({ currentPart, currentQuestion, totalQuestionsInPart, pillarName }: MobileProgressProps) {
    const overallProgress = ((currentPart - 1) / PILLARS.length) * 100 +
        (currentQuestion && totalQuestionsInPart ? (currentQuestion / totalQuestionsInPart / PILLARS.length) * 100 : 0)

    return (
        <div className="lg:hidden mb-4">
            {/* Progress bar */}
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden mb-3">
                <div
                    className="h-full bg-[#E8632B] rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(overallProgress, 100)}%` }}
                />
            </div>

            {/* Step indicators */}
            <div className="flex items-center justify-between gap-1 mb-2">
                {PILLARS.map((pillar, index) => {
                    const isCompleted = index + 1 < currentPart
                    const isCurrent = index + 1 === currentPart

                    return (
                        <div
                            key={pillar.id}
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                                isCompleted
                                    ? "bg-[#E8632B] text-white"
                                    : isCurrent
                                        ? "bg-white border-2 border-[#E8632B] text-[#E8632B]"
                                        : "bg-gray-200 text-gray-400"
                            }`}
                        >
                            {index + 1}
                        </div>
                    )
                })}
            </div>

            {/* Current part info */}
            <p className="text-sm text-gray-600 font-medium">
                Part {currentPart}: {pillarName}
                {currentQuestion && totalQuestionsInPart && (
                    <span className="text-gray-400 ml-2">
                        ({currentQuestion}/{totalQuestionsInPart})
                    </span>
                )}
            </p>
        </div>
    )
}

// Desktop Progress Stepper - hidden on mobile
export function ProgressStepper({ currentPart }: ProgressStepperProps) {
    return (
        <div className="hidden lg:block w-full max-w-[407px] rounded-xl bg-white p-8 shadow-sm border border-gray-100">
            <div className="flex">
                {/* Timeline line and circles */}
                <div className="relative mr-6 flex flex-col items-center">
                    {/* Vertical line */}
                    <div className="absolute left-1/2 top-2 h-[calc(100%-16px)] w-[2px] -translate-x-1/2 bg-gray-200" />

                    {PILLARS.map((pillar, index) => {
                        const isCompleted = index + 1 < currentPart
                        const isCurrent = index + 1 === currentPart

                        return (
                            <div
                                key={pillar.id}
                                className="relative z-10 mb-[76px] last:mb-0"
                            >
                                <div
                                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-colors ${
                                        isCompleted
                                            ? "border-orange-500 bg-orange-500"
                                            : isCurrent
                                                ? "border-orange-500 bg-white"
                                                : "border-gray-300 bg-white"
                                    }`}
                                >
                                    {isCurrent && (
                                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Text content */}
                <div className="flex flex-col">
                    {PILLARS.map((pillar, index) => {
                        const isCompleted = index + 1 < currentPart
                        const isCurrent = index + 1 === currentPart

                        return (
                            <div
                                key={pillar.id}
                                className="mb-[55px] last:mb-0"
                            >
                                <p className={`font-inter text-sm font-semibold tracking-wide transition-colors ${
                                    isCurrent ? "text-black" : isCompleted ? "text-gray-600" : "text-gray-400"
                                }`}>
                                    {pillar.name}
                                </p>
                                <p className={`font-inter text-sm tracking-wide transition-colors ${
                                    isCurrent ? "text-gray-600" : isCompleted ? "text-gray-500" : "text-gray-300"
                                }`}>
                                    {pillar.subtitle}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
