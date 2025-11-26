export interface Question {
    id: string;
    question: string;
    category: "personal" | "communication" | "emotional" | "decision" | "social" | "cognitive" | "conflict";
    placeholder?: string;
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
