import { generateSoulPrint } from './lib/soulprint/generator';
import { checkHealth } from './lib/llm/local-client';
import { QuestionnaireAnswers } from './lib/gemini/types';

// Mock Answers (Elon Musk Style)
const mockAnswers: QuestionnaireAnswers = {
    s1: 85, q1: "I don't have a tone, I have a mission. People mistake intensity for aggression.",
    s2: 20, q2: "Inefficiency. If you're not adding value, you're subtracting it.",
    s3: 95, q3: "We're going to Mars, get on or get out of the way.",
    s4: 30, q4: "Fear. It's irrational but biological.",
    s5: 10, q5: "Solve the problem. Emotions are just feedback loops.",
    s6: 20, q6: "When a rocket explodes. It's a data point, but it hurts.",
    s7: 10, q7: "Not moving fast enough on the Model 3 ramp.",
    s8: 0, q8: "Risk is the price of entry for the future.",
    s9: 10, q9: "Yes, because the alternative is stagnation.",
    s10: 100, q10: "Engineering. Physics. The first principles crowd.",
    s11: 100, q11: "Work hard. Very hard.",
    s12: 10, q12: "Engineers who tell me I'm wrong with data.",
    s13: 100, q13: "First principles. Boil it down to the fundamental truths.",
    s14: 80, q14: "Bureaucracy. Rules that exist for the sake of rules.",
    s15: 50, q15: "Physics. Does it violate the laws of physics? No? Then it's possible.",
    s16: 10, q16: "Counter-attack. Truth is the only defense.",
    s17: 80, q17: "Use it. Anger is energy.",
    s18: 90, q18: "Relentless."
};

async function runTest() {
    console.log('🔍 Checking Local LLM Health...');
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        console.error('❌ Local LLM is NOT reachable. Make sure Ollama is running.');
        process.exit(1);
    }
    console.log('✅ Local LLM is online.');

    console.log('\n🚀 Starting SoulPrint Generation Test...');
    const startTime = Date.now();

    try {
        const result = await generateSoulPrint(mockAnswers);
        const duration = (Date.now() - startTime) / 1000;

        console.log('\n✨ Generation Complete!');
        console.log(`⏱️ Time taken: ${duration.toFixed(2)}s`);
        console.log('---------------------------------------------------');
        console.log('Archetype:', result.archetype);
        console.log('Identity Signature:', result.identity_signature);
        console.log('Full System Prompt Length:', result.full_system_prompt?.length || 0, 'chars');
        console.log('---------------------------------------------------');
        
        // Validate structure
        if (result.pillars && result.full_system_prompt && result.full_system_prompt.length > 100) {
            console.log('✅ Structure Validation Passed');
        } else {
            console.error('❌ Structure Validation Failed');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

runTest();
