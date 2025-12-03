export interface Question {
    id: string;
    question: string;
    category: "communication" | "emotional" | "decision" | "social" | "cognitive" | "conflict";
    type: "text" | "voice" | "slider";
    placeholder?: string;
    leftLabel?: string;     // For slider: left extreme label
    rightLabel?: string;    // For slider: right extreme label
    voicePrompt?: string;   // Prompt shown for voice questions
    minDuration?: number;   // Min recording duration for voice (seconds)
    maxDuration?: number;   // Max recording duration for voice (seconds)
    pillarId?: string;      // SoulPrint pillar ID for voice analysis
}

export const questions: Question[] = [
    // PILLAR 1: Communication Style
    {
        id: "s1",
        question: "When you’re not being heard:",
        category: "communication",
        type: "slider",
        leftLabel: "Defend your stance",
        rightLabel: "Engage discussion"
    },
    {
        id: "q1",
        question: "What’s the first thing people misunderstand about your tone?",
        category: "communication",
        type: "text",
        placeholder: "e.g., They think I'm angry when I'm just passionate..."
    },
    {
        id: "s2",
        question: "Your natural pacing:",
        category: "communication",
        type: "slider",
        leftLabel: "Fast and concise",
        rightLabel: "Slow and deliberate"
    },
    {
        id: "q2",
        question: "What does silence mean to you in a conversation?",
        category: "communication",
        type: "text",
        placeholder: "e.g., It's uncomfortable, it's thinking time..."
    },
    {
        id: "s3",
        question: "When interrupted:",
        category: "communication",
        type: "slider",
        leftLabel: "Hold back and wait",
        rightLabel: "Push through and speak"
    },
    {
        id: "q3",
        question: "Finish this sentence: “If I had one sentence to explain myself without apology, it would be…”",
        category: "communication",
        type: "text",
        placeholder: "I am..."
    },

    // PILLAR 2: Emotional Alignment
    {
        id: "s4",
        question: "Emotional expression:",
        category: "emotional",
        type: "slider",
        leftLabel: "Contain internally",
        rightLabel: "Express outwardly"
    },
    {
        id: "q4",
        question: "What emotion is hardest for you to express out loud?",
        category: "emotional",
        type: "text",
        placeholder: "e.g., Vulnerability, anger, joy..."
    },
    {
        id: "s5",
        question: "When someone you care about is hurting:",
        category: "emotional",
        type: "slider",
        leftLabel: "Fix the issue",
        rightLabel: "Sit with them in it"
    },
    {
        id: "q5",
        question: "How do you reset after emotional conflict?",
        category: "emotional",
        type: "text",
        placeholder: "e.g., I need space, I need to talk it out..."
    },
    {
        id: "s6",
        question: "Emotional boundary style:",
        category: "emotional",
        type: "slider",
        leftLabel: "Guarded",
        rightLabel: "Open"
    },
    {
        id: "q6",
        question: "Describe a time your emotions surprised you.",
        category: "emotional",
        type: "text",
        placeholder: "I was..."
    },

    // PILLAR 3: Decision-Making & Risk
    {
        id: "s7",
        question: "Decision instinct:",
        category: "decision",
        type: "slider",
        leftLabel: "Gut feeling",
        rightLabel: "Full analysis"
    },
    {
        id: "q7",
        question: "Describe a moment when hesitation cost you something.",
        category: "decision",
        type: "text",
        placeholder: "I waited too long to..."
    },
    {
        id: "s8",
        question: "Response to uncertainty:",
        category: "decision",
        type: "slider",
        leftLabel: "Charge forward",
        rightLabel: "Slow down and evaluate"
    },
    {
        id: "q8",
        question: "What does “acceptable risk” mean to you?",
        category: "decision",
        type: "text",
        placeholder: "It means..."
    },
    {
        id: "s9",
        question: "Recovery after mistakes:",
        category: "decision",
        type: "slider",
        leftLabel: "Move on quickly",
        rightLabel: "Reflect deeply"
    },
    {
        id: "q9",
        question: "Do you trust your future self with the consequences of your choices? Why?",
        category: "decision",
        type: "text",
        placeholder: "Yes/No because..."
    },

    // PILLAR 4: Social & Cultural Identity
    {
        id: "s10",
        question: "Group presence:",
        category: "social",
        type: "slider",
        leftLabel: "Observer",
        rightLabel: "Participant"
    },
    {
        id: "q10",
        question: "What community or culture feels like home to you?",
        category: "social",
        type: "text",
        placeholder: "e.g., The gaming community, my hometown..."
    },
    {
        id: "s11",
        question: "Social connection preference:",
        category: "social",
        type: "slider",
        leftLabel: "Small trusted circle",
        rightLabel: "Broad network"
    },
    {
        id: "q11",
        question: "What values were you raised with that you kept or rejected?",
        category: "social",
        type: "text",
        placeholder: "I kept hard work, but rejected..."
    },
    {
        id: "s12",
        question: "Code-switching:",
        category: "social",
        type: "slider",
        leftLabel: "Same self everywhere",
        rightLabel: "Adapt depending on environment"
    },
    {
        id: "q12",
        question: "What kind of people make you feel rooted and safe?",
        category: "social",
        type: "text",
        placeholder: "People who are..."
    },

    // PILLAR 5: Cognitive Processing
    {
        id: "s13",
        question: "Thinking style:",
        category: "cognitive",
        type: "slider",
        leftLabel: "Concrete and literal",
        rightLabel: "Abstract and conceptual"
    },
    {
        id: "q13",
        question: "When you’re learning something new, what helps it stick?",
        category: "cognitive",
        type: "text",
        placeholder: "e.g., Doing it myself, reading about it..."
    },
    {
        id: "s14",
        question: "Responding to complexity:",
        category: "cognitive",
        type: "slider",
        leftLabel: "Zoom into details",
        rightLabel: "Pull back to see the whole"
    },
    {
        id: "q14",
        question: "What kind of information drains you fastest?",
        category: "cognitive",
        type: "text",
        placeholder: "e.g., Spreadsheets, emotional dumping..."
    },
    {
        id: "s15",
        question: "Best processing mode:",
        category: "cognitive",
        type: "slider",
        leftLabel: "Move faster speaking out loud",
        rightLabel: "Move faster writing it down"
    },
    {
        id: "q15",
        question: "When something doesn’t make sense, what’s your default move?",
        category: "cognitive",
        type: "text",
        placeholder: "I ask questions, I research..."
    },

    // PILLAR 6: Assertiveness & Conflict
    {
        id: "s16",
        question: "When someone crosses a line:",
        category: "conflict",
        type: "slider",
        leftLabel: "Call it out immediately",
        rightLabel: "Let it sit until later"
    },
    {
        id: "q16",
        question: "When someone challenges you publicly, what’s your instinct?",
        category: "conflict",
        type: "text",
        placeholder: "To fight back, to diffuse..."
    },
    {
        id: "s17",
        question: "Anger style:",
        category: "conflict",
        type: "slider",
        leftLabel: "Quieter",
        rightLabel: "Sharper or louder"
    },
    {
        id: "q17",
        question: "Do you avoid conflict, use it, or transform it?",
        category: "conflict",
        type: "text",
        placeholder: "I..."
    },
    {
        id: "s18",
        question: "Being misunderstood:",
        category: "conflict",
        type: "slider",
        leftLabel: "Walk away",
        rightLabel: "Correct and clarify"
    },
    {
        id: "q18",
        question: "How would a close friend describe your conflict style?",
        category: "conflict",
        type: "text",
        placeholder: "They would say..."
    }
];

export function getNextQuestion(currentQuestionId: string | null): Question | null {
    if (!currentQuestionId) return questions[0];
    const currentIndex = questions.findIndex(q => q.id === currentQuestionId);
    if (currentIndex === -1 || currentIndex === questions.length - 1) return null;
    return questions[currentIndex + 1];
}

export function getQuestionById(id: string): Question | undefined {
    return questions.find(q => q.id === id);
}

export function getTotalQuestions(): number {
    return questions.length;
}

export function getProgress(currentQuestionId: string): number {
    const currentIndex = questions.findIndex(q => q.id === currentQuestionId);
    if (currentIndex === -1) return 100;
    return ((currentIndex + 1) / questions.length) * 100;
}
