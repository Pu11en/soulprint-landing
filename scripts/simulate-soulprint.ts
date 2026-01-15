
import { generateSoulPrint } from '../lib/soulprint/generator';
import { chatCompletion, ChatMessage } from '../lib/llm/local-client';
import { QuestionnaireAnswers } from '../lib/soulprint/types';

// --- MOCK DATA ---

// 1. THE ACE (Ben-like): High speed, punchy, metaphors
const ACE_ANSWERS: QuestionnaireAnswers = {
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
};

// 2. THE SAGE (Therapist): Slow, warm, balanced
const SAGE_ANSWERS: QuestionnaireAnswers = {
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
    q18: "Safe.",
    user_id: "test-sage"
};

// 3. THE VISIONARY MAVERICK (User's Persona)
const MAVERICK_ANSWERS: QuestionnaireAnswers = {
    s1: 70, s2: 30, s3: 85, s4: 40, s5: 35, s6: 25, s7: 65, s8: 80, s9: 75, s10: 20, s11: 35, s12: 15, s13: 80, s14: 60, s15: 45, s16: 25, s17: 75, s18: 90,
    q1: "I'm often misunderstood as arrogant because I see the path so clearly and don't care to explain the steps.",
    q2: "Silence is for building. I'm either working or I'm processing the next pivot.",
    q3: "If you're not the lead dog, the view never changes.",
    q4: "Admitting I don't have the answer yet. It feels like a crack in the armor.",
    q5: "A heavy lift or a deep dive into code. Physical or mental grind is my reset.",
    q6: "Seeing my father realize I had surpassed his vision. It was a silent passing of the torch.",
    q7: "Waiting for permission on a feature that I knew was the future. I'll never ask again.",
    q8: "If I'm willing to lose it all to make it happen, that's an acceptable risk.",
    q9: "Yes. He's the one currently judging my pace.",
    q10: "The empty office at 3 AM. That's home.",
    q11: "Integrity over popularity. Always.",
    q12: "Builders. People who have skin in the game.",
    q13: "Deconstruction. Tear it down to see how it was built, then build it better.",
    q14: "Small talk and status meetings.",
    q15: "I write it out. If I can't write it, I don't understand it.",
    q16: "Engage immediately. No use letting a parasite stay in the system.",
    q17: "Direct and loud if necessary. I use conflict to burn off the fluff.",
    q18: "Relentless. Ambitious. Probably a bit intense.",
    user_id: "kidquick360"
};

async function runTribunal() {
    console.log("⚖️ THE TRIBUNAL IS IN SESSION ⚖️");
    console.log("-----------------------------------");

    const profiles = [
        { name: "THE ACE (Ben Clone)", answers: ACE_ANSWERS },
        { name: "THE SAGE (Therapist)", answers: SAGE_ANSWERS },
        { name: "VISIONARY MAVERICK (Account User)", answers: MAVERICK_ANSWERS }
    ];

    for (const p of profiles) {
        console.log(`\n🔍 EXAMINING: ${p.name}`);
        try {
            const sp = await generateSoulPrint(p.answers, p.answers.user_id);

            console.log(`\n--- VOICE VECTORS ---`);
            console.log(JSON.stringify(sp.voice_vectors, null, 2));

            console.log(`\n--- DYNAMIC SYSTEM PROMPT (snippet) ---`);
            console.log(sp.full_system_prompt?.slice(0, 500) + "...");

            // AUTO-JUDGE (Simple Heuristic Check)
            let score = 0;
            if (p.name.includes("ACE")) {
                if (sp.voice_vectors.cadence_speed === 'rapid') score++;
                if (sp.voice_vectors.tone_warmth === 'cold/analytical') score++;
                if (sp.sign_off && sp.sign_off.length > 0) score++;
                if (sp.full_system_prompt?.includes("CORE DIRECTIVE")) score++;
            } else if (p.name.includes("MAVERICK")) {
                if (sp.voice_vectors.cadence_speed === 'rapid' || sp.voice_vectors.cadence_speed === 'moderate') score++;
                if (sp.voice_vectors.tone_warmth === 'cold/analytical' || sp.voice_vectors.tone_warmth === 'neutral') score++;
                if (sp.archetype.toLowerCase().includes('maverick') || sp.archetype.toLowerCase().includes('visionary')) score++;
                if (sp.full_system_prompt?.includes("No AI Slop")) score++;
            } else {
                if (sp.voice_vectors.cadence_speed === 'deliberate' || sp.voice_vectors.cadence_speed === 'moderate') score++;
                if (sp.voice_vectors.tone_warmth === 'warm/empathetic') score++;
                if (sp.full_system_prompt?.includes("Human-Likeness Protocols")) score++;
            }

            console.log(`\n🏆 TRIBUNAL SCORE: ${score}/4 (Passing is 3+)`);

            // --- DIRECT VOICE TEST (LLM Completion) ---
            if (p.name.includes("MAVERICK")) {
                console.log(`\n🧪 CONDUCTING DIRECT VOICE TEST...`);
                const messages: ChatMessage[] = [
                    { role: 'system', content: sp.full_system_prompt || "Be a visionary maverick." },
                    { role: 'user', content: "Our main competitor just launched a feature we've been planning for months. What's the move?" }
                ];
                const response = await chatCompletion(messages);
                console.log(`\n--- MAVERICK RESPONSE ---`);
                console.log(response);
                console.log(`--------------------------`);
            }

        } catch (e) {
            console.error(`FAILED: ${e}`);
        }
    }
}

runTribunal();
