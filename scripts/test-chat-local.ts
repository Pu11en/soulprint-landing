/**
 * Local Chat Test Script
 * Tests the full chat flow with SageMaker to verify it works before deploying
 * 
 * Run: npx tsx scripts/test-chat-local.ts
 */

import 'dotenv/config';
import { chatCompletion, streamChatCompletion, ChatMessage } from '../lib/llm/local-client';
import { constructDynamicSystemPrompt } from '../lib/soulprint/generator';
import { SoulPrintData } from '../lib/soulprint/types';

// Sample SoulPrint data (simulating what comes from the database)
const testSoulPrint: SoulPrintData = {
    soulprint_version: "3.0",
    generated_at: new Date().toISOString(),
    archetype: "Strategic Architect",
    identity_signature: "A relentless builder who sees the world as raw material for creation.",
    name: "Test Companion",
    voice_vectors: {
        cadence_speed: 'rapid',
        tone_warmth: 'cold/analytical',
        sentence_structure: 'fragmented',
        emoji_usage: 'none',
        sign_off_style: 'signature'
    },
    sign_off: "Build or die.",
    pillars: {
        communication_style: {
            summary: "Direct and high-signal",
            ai_instruction: "Get to the point immediately.",
            markers: []
        },
        emotional_alignment: {
            summary: "Internalized processing",
            ai_instruction: "Don't ask how they feel directly.",
            markers: []
        },
        decision_making: {
            summary: "Calculated risk taker",
            ai_instruction: "Present options with probabilities.",
            markers: []
        },
        social_cultural: {
            summary: "Selectively social",
            ai_instruction: "Respect their inner circle.",
            markers: []
        },
        cognitive_processing: {
            summary: "Systems thinker",
            ai_instruction: "Use structural metaphors.",
            markers: []
        },
        assertiveness_conflict: {
            summary: "Confrontational when necessary",
            ai_instruction: "Stand your ground.",
            markers: []
        }
    },
    flinch_warnings: ["features", "roadmap", "timeline"],
    prompt_core: "",
    prompt_pillars: "",
    prompt_full: ""
};

async function testChat() {
    console.log("🧪 LOCAL CHAT TEST");
    console.log("==================");
    console.log("");

    // Check environment
    console.log("📋 Environment Check:");
    console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   SAGEMAKER_ENDPOINT_NAME: ${process.env.SAGEMAKER_ENDPOINT_NAME || '❌ Missing'}`);
    console.log("");

    // Generate the compact system prompt
    console.log("📝 Generating System Prompt...");
    const systemPrompt = constructDynamicSystemPrompt(testSoulPrint);

    // Estimate token count (rough: ~4 chars per token)
    const estimatedTokens = Math.ceil(systemPrompt.length / 4);
    console.log(`   Prompt length: ${systemPrompt.length} chars (~${estimatedTokens} tokens)`);
    console.log("");
    console.log("--- SYSTEM PROMPT ---");
    console.log(systemPrompt);
    console.log("--- END PROMPT ---");
    console.log("");

    if (estimatedTokens > 800) {
        console.log("⚠️  WARNING: Prompt may be too long for SageMaker's 1024 token limit!");
    } else {
        console.log("✅ Prompt size looks good for SageMaker");
    }
    console.log("");

    // Build the messages
    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Hey, what should I focus on today?' }
    ];

    // Test non-streaming first
    console.log("🚀 Testing SageMaker Chat (non-streaming)...");
    console.log("");

    try {
        const response = await chatCompletion(messages);
        console.log("✅ SUCCESS! Response received:");
        console.log("");
        console.log("--- AI RESPONSE ---");
        console.log(response);
        console.log("--- END RESPONSE ---");
        console.log("");
    } catch (error: any) {
        console.error("❌ FAILED:", error.message);
        console.log("");
        console.log("Full error:", error);
    }

    // Test streaming
    console.log("🚀 Testing SageMaker Chat (simulated streaming)...");
    console.log("");

    try {
        let streamedResponse = "";
        process.stdout.write("--- STREAMING RESPONSE ---\n");
        for await (const chunk of streamChatCompletion(messages)) {
            streamedResponse += chunk;
            process.stdout.write(chunk);
        }
        console.log("\n--- END STREAMING ---");
        console.log("");
        console.log("✅ Streaming test passed!");
    } catch (error: any) {
        console.error("❌ Streaming FAILED:", error.message);
    }

    console.log("");
    console.log("==================");
    console.log("🏁 TEST COMPLETE");
}

testChat().catch(console.error);
