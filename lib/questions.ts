export interface Question {
    id: string;
    question: string;
    category: "personal" | "communication" | "emotional" | "decision" | "social" | "cognitive" | "conflict";
    placeholder?: string;
    type?: "text" | "voice";  // Default is "text"
    voicePrompt?: string;     // Prompt shown for voice questions
    minDuration?: number;     // Min recording duration for voice (seconds)
    maxDuration?: number;     // Max recording duration for voice (seconds)
    pillarId?: string;        // SoulPrint pillar ID for voice analysis
}

export const questions: Question[] = [
    {
        id: "q1",
        question: "When you're not being heard, what do you do?",
        category: "communication",
        placeholder: "e.g., I repeat myself, I shut down, I write it down..."
    },
    {
        id: "q2",
        question: "Do you write how you talk, or do you mask in text?",
        category: "communication",
        placeholder: "e.g., I'm more formal in text, I use emojis to soften..."
    },
    {
        id: "q3",
        question: "What emotion is hardest for you to express out loud?",
        category: "emotional",
        placeholder: "e.g., Anger, sadness, vulnerability..."
    },
    {
        id: "q4",
        question: "Now, tell me a short story using your voice. Describe a moment when you felt truly understood by someone.",
        category: "emotional",
        type: "voice",
        voicePrompt: "Take a moment to recall a specific time when someone really 'got' you. Describe what happened, how it felt, and why that moment stood out. Speak naturally, as if you're telling a friend.",
        minDuration: 1,
        maxDuration: 120,
        pillarId: "emotional_alignment"
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
