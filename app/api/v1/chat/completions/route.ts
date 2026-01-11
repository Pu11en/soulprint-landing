import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { checkHealth, streamChatCompletion, chatCompletion, ChatMessage } from "@/lib/llm/local-client";
import { loadMemory, buildSystemPrompt } from "@/lib/letta/soulprint-memory";
import { rateLimiters, getRateLimitHeaders, getClientIP } from "@/lib/security";
import { env } from "@/lib/env";

// Initialize Supabase Admin client (to bypass RLS for key check)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Demo keys - only active when demo mode is enabled
const DEMO_KEYS = env.demo.enabled
    ? ['sk-soulprint-demo-fallback-123456', 'sk-soulprint-demo-internal-key']
    : [];

export async function POST(req: NextRequest) {
    try {
        // 0. Rate Limiting
        const clientIP = getClientIP(req.headers);
        const rateLimitResult = rateLimiters.chat(clientIP);

        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again later." },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimitResult)
                }
            );
        }

        // 1. Extract API Key
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer sk-soulprint-")) {
            return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
        }

        const rawKey = authHeader.replace("Bearer ", "");
        const hashedKey = createHash("sha256").update(rawKey).digest("hex");

        // 2. Validate API Key & Get User
        let keyData;
        let keyError;

        // Check if it's a demo key (only works when demo mode is enabled)
        if (DEMO_KEYS.includes(rawKey)) {
            // Use demo user ID
            keyData = { user_id: 'dadb8b23-5684-4d86-9021-e457267e75c7', id: 'demo-fallback-id' };
            keyError = null;
        } else {
            const result = await supabaseAdmin
                .from("api_keys")
                .select("user_id, id")
                .eq("key_hash", hashedKey)
                .single();
            keyData = result.data;
            keyError = result.error;
        }

        if (keyError || !keyData) {
            return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
        }

        // ===================================
        // 🚦 USAGE LIMIT CHECK (Gate Logic)
        // ===================================
        // Skip limit for Demo User (Elon)
        if (keyData.user_id !== 'dadb8b23-5684-4d86-9021-e457267e75c7') {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('usage_count, usage_limit')
                .eq('id', keyData.user_id)
                .single();

            const limit = profile?.usage_limit ?? 20; // Default hard limit
            const count = profile?.usage_count ?? 0;

            if (count >= limit) {
                return NextResponse.json({
                    error: "SoulPrint Trial Limit Reached (20 Interactions). Access is currently restricted."
                }, { status: 403 });
            }

            // Increment Usage (Blocking to ensure enforcement)
            await supabaseAdmin
                .from('profiles')
                .update({ usage_count: count + 1 })
                .eq('id', keyData.user_id);
        }


        // 3. Parse Request Body
        const body = await req.json();
        const { messages, model = 'hermes3', stream = false, soulprint_id } = body;

        // 4. Fetch User's SoulPrint (System Message)
        let targetSoulprintId = soulprint_id;

        // If no ID provided in body, check the user's "current" selection
        if (!targetSoulprintId) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('current_soulprint_id')
                .eq('id', keyData.user_id)
                .single();

            if (profile?.current_soulprint_id) {
                targetSoulprintId = profile.current_soulprint_id;
            }
        }

        let soulprintQuery = supabaseAdmin
            .from("soulprints")
            .select("soulprint_data")
            .eq("user_id", keyData.user_id);

        if (targetSoulprintId) {
            soulprintQuery = soulprintQuery.eq('id', targetSoulprintId);
        }

        const { data: soulprint } = await soulprintQuery.maybeSingle();

        // ============================================================
        // 🚀 UNIFIED LLM PATH (Local Hermes 3 -> Gemini Fallback)
        // ============================================================
        try {
            // Build Context
            let soulprintObj = soulprint?.soulprint_data;
            if (typeof soulprintObj === 'string') {
                try { soulprintObj = JSON.parse(soulprintObj); } catch (e) { }
            }

            // Prepare Messages (Prepend System Prompt if found)
            const memory = await loadMemory(keyData.user_id);
            const systemPrompt = buildSystemPrompt(soulprintObj, memory);

            const processedMessages: ChatMessage[] = [
                { role: 'system', content: systemPrompt },
                ...messages.map((m: any) => ({ role: m.role, content: m.content }))
            ];

            const { unifiedChatCompletion, unifiedStreamChatCompletion } = await import("@/lib/llm/unified-client");

            if (stream) {
                const streamResponse = new ReadableStream({
                    async start(controller) {
                        const encoder = new TextEncoder();
                        try {
                            for await (const chunk of unifiedStreamChatCompletion(processedMessages)) {
                                const data = JSON.stringify({
                                    choices: [{ delta: { content: chunk } }]
                                });
                                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                            }
                            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                        } catch (e) {
                            console.error("Streaming error:", e);
                        } finally {
                            controller.close();
                        }
                    }
                });

                return new Response(streamResponse, {
                    headers: {
                        "Content-Type": "text/event-stream",
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                    },
                });
            }

            // Non-streaming path
            const content = await unifiedChatCompletion(processedMessages);

            return NextResponse.json({
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: 'soulprint-hybrid',
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content },
                    finish_reason: 'stop'
                }]
            });

        } catch (llmError: any) {
            console.error('❌ LLM Generation Failed:', llmError);
            return NextResponse.json({
                error: `Generation failed: ${llmError.message || 'Unknown error'}`
            }, { status: 503 });
        }

    } catch (error: unknown) {
        console.error('❌ Chat API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: `API error: ${errorMessage}`,
        }, { status: 500 });
    }
}
