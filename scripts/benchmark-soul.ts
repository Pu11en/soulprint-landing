import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { SoulEngine } from '../lib/soulprint/soul-engine';
import { SoulPrintData } from '../lib/soulprint/types';
import { ChatMessage } from '@/lib/llm/local-client';

async function runBenchmark() {
    console.log("🚀 Starting SoulEngine Latency Benchmark...");

    // 1. Setup
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Missing Supabase Credentials in .env");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const mockSoulPrint: SoulPrintData = {
        soulprint_version: "3.0",
        generated_at: new Date().toISOString(),
        name: "Benchmark Bot",
        archetype: "The Tester",
        identity_signature: "I measure things.",
        voice_vectors: { cadence_speed: 'rapid' },
        // Mock minimal pillars
        pillars: {
            communication_style: { summary: "Direct", ai_instruction: "Be brief.", markers: [] },
            emotional_alignment: { summary: "None", ai_instruction: "Be stoic.", markers: [] },
            decision_making: { summary: "Fast", ai_instruction: "Decide now.", markers: [] },
            social_cultural: { summary: "None", ai_instruction: "None", markers: [] },
            cognitive_processing: { summary: "Linear", ai_instruction: "A-B-C", markers: [] },
            assertiveness_conflict: { summary: "High", ai_instruction: "Fight me.", markers: [] },
        }
    } as any;

    const engine = new SoulEngine(supabase, "test-user-benchmark", mockSoulPrint);

    // 2. Test Short Circuit (Phatic)
    console.log("\n🧪 TEST 1: Short-Circuit (Phatic Input: 'Hello')");
    const start1 = performance.now();
    const prompt1 = await engine.constructSystemPrompt([{ role: 'user', content: 'Hello' }]);
    const end1 = performance.now();
    console.log(`⏱️  Time: ${(end1 - start1).toFixed(2)}ms`);
    if (prompt1.includes("Short-response mode")) {
        console.log("✅ Passed: Detected Phatic/Short-Circuit.");
    } else {
        console.log("❌ Failed: Did not trigger short-circuit.");
    }

    // 3. Test Deep Cognition
    console.log("\n🧠 TEST 2: Cognitive Loop (Context Input)");
    // We mock a convo that looks like "Wife Trouble" context
    const conversation: ChatMessage[] = [
        { role: 'user', content: "She just doesn't listen to me about the schedule." },
        { role: 'assistant', content: "That sounds frustrating. Is it happening often?" },
        { role: 'user', content: "Every single day. I feel ignored." }
    ];

    const start2 = performance.now();
    const prompt2 = await engine.constructSystemPrompt(conversation);
    const end2 = performance.now();

    console.log(`⏱️  Thinking Time: ${(end2 - start2).toFixed(2)}ms`); // This is the overhead

    if (prompt2.includes("## LONG-TERM MEMORY")) {
        console.log("✅ Passed: Memories injected.");
    } else {
        console.log("⚠️ Note: No memories found (Expected if vector DB is empty for this test user).");
    }

    console.log("\n📊 RESULT SUMMARY");
    console.log(`- Fast Path Latency: ${(end1 - start1).toFixed(0)} ms`);
    console.log(`- Smart Path Latency: ${(end2 - start2).toFixed(0)} ms`);
    console.log(`- "Intelligence Cost": ${(end2 - start2 - (end1 - start1)).toFixed(0)} ms extra`);

}

runBenchmark().catch(console.error);
