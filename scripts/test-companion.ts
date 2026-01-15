
import dotenv from 'dotenv';
import path from 'path';

// 1. Load Environment Variables FIRST
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Verify keys are loaded
if (!process.env.OPENAI_API_KEY) {
    console.error("❌ CRITICAL: OPENAI_API_KEY missing from .env.local");
    process.exit(1);
}

// 2. Import Modules AFTER env load
import { generateSoulPrint } from '../lib/soulprint/generator';
import { streamChatCompletion, ChatMessage } from '../lib/llm/local-client';
import { QuestionnaireAnswers, SoulPrintData } from '../lib/soulprint/types';
import { SoulEngine } from '../lib/soulprint/soul-engine';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';

// --- PRESET DATA ---
const PRESETS: Record<string, { name: string, answers: QuestionnaireAnswers }> = {
    ace: {
        name: "THE ACE",
        answers: {
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
            q18: "Relentless.",
            user_id: "test-ace"
        }
    }
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve));
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials. Test cannot proceed.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function startChat(soulprint: SoulPrintData) {
    console.log("\n--- CHAT STARTED (SoulEngine v2) ---");
    console.log("(Type 'exit' to quit)\n");

    const userId = "test-user-cli-" + Date.now();
    const engine = new SoulEngine(supabase, userId, soulprint);
    const messages: ChatMessage[] = [];

    while (true) {
        const userInput = await askQuestion("You: ");
        if (userInput.toLowerCase() === 'exit') break;

        messages.push({ role: 'user', content: userInput });
        process.stdout.write("\nSoulPrint: ");

        const systemPrompt = await engine.constructSystemPrompt(messages);

        const fullContext: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        let fullResponse = "";
        try {
            for await (const chunk of streamChatCompletion(fullContext)) {
                process.stdout.write(chunk);
                fullResponse += chunk;
            }
            console.log("\n");
            messages.push({ role: 'assistant', content: fullResponse });
        } catch (e) {
            console.error("\n[Error]", e);
        }
    }
    rl.close();
}

async function main() {
    console.log("🧬 SOULPRINT COMPANION TESTER v2 (Engine Integrated) 🧬");

    // Default to Ace for speed
    const selection = 'ace';
    console.log(`Loading preset: ${PRESETS[selection].name}`);
    const answers = PRESETS[selection].answers;

    try {
        console.log("\n🧠 Generating SoulPrint...");
        const soulprint = await generateSoulPrint(answers, answers.user_id);

        console.log("\n--- GENERATED IDENTITY ---");
        console.log(`Archetype: ${soulprint.archetype}`);

        const startChoice = await askQuestion("\nStart chat? (y/n): ");
        if (startChoice.toLowerCase() === 'y') {
            await startChat(soulprint);
        } else {
            rl.close();
        }

    } catch (e) {
        console.error("Test failed:", e);
        rl.close();
    }
}

main();
