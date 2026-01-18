import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { streamChatCompletion, chatCompletion, ChatMessage } from "@/lib/llm/local-client";
import { SoulEngine } from "@/lib/soulprint/soul-engine";
import { generateEmbedding } from "@/lib/soulprint/memory/retrieval";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// Initialize Supabase Admin client (to bypass RLS for key check)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
    try {
        // 1. Extract API Key
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer sk-soulprint-")) {
            return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
        }

        const rawKey = authHeader.replace("Bearer ", "");
        const hashedKey = createHash("sha256").update(rawKey).digest("hex");

        // 2. Validate API Key & Get User
        const { data: keyData, error: keyError } = await supabaseAdmin
            .from("api_keys")
            .select("user_id, id")
            .eq("key_hash", hashedKey)
            .single();

        if (keyError || !keyData) {
            return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
        }

        // ===================================
        // 🚦 RATE LIMIT CHECK
        // ===================================
        const rateCheck = await checkRateLimit(keyData.user_id);
        if (rateCheck && !rateCheck.success) {
            return NextResponse.json(rateLimitResponse(), { status: 429 });
        }

        // ===================================
        // 🚦 USAGE LIMIT CHECK (Gate Logic)
        // ===================================
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


        // 3. Parse Request Body
        const body = await req.json();
        const { messages, stream = false, soulprint_id } = body;

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
        // 🚀 SOUL ENGINE (Agentic Logic)
        // ============================================================

        // Initialize SoulEngine with user's data
        const engine = new SoulEngine(supabaseAdmin, keyData.user_id, soulprint?.soulprint_data || {});

        // Agentic Step: Construct System Prompt (Short-Circuit included)
        const systemPrompt = await engine.constructSystemPrompt(messages);

        const processedMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
        ];

        if (stream) {
            const encoder = new TextEncoder();
            const streamResponse = new ReadableStream({
                async start(controller) {
                    let fullResponse = "";
                    try {
                        for await (const chunk of streamChatCompletion(processedMessages)) {
                            fullResponse += chunk;
                            const data = JSON.stringify({
                                choices: [{ delta: { content: chunk } }]
                            });
                            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                        }
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                        controller.close();

                        // Background Persistence (Fire & Forget)
                        (async () => {
                            try {
                                const lastUserMsg = messages[messages.length - 1];
                                const [userEmbedding, assistantEmbedding] = await Promise.all([
                                    generateEmbedding(lastUserMsg.content),
                                    generateEmbedding(fullResponse)
                                ]);

                                await supabaseAdmin.from('chat_logs').insert([
                                    {
                                        user_id: keyData.user_id,
                                        role: 'user',
                                        content: lastUserMsg.content,
                                        embedding: userEmbedding
                                    },
                                    {
                                        user_id: keyData.user_id,
                                        role: 'assistant',
                                        content: fullResponse,
                                        embedding: assistantEmbedding
                                    }
                                ]);
                            } catch (e) {
                                console.error("Async Memory Persistence Failed:", e);
                            }
                        })();

                    } catch (e) {
                        console.error("Streaming error:", e);
                        controller.error(e);
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
        const content = await chatCompletion(processedMessages);

        // Persist Non-streaming
        // (Simplified: Reusing same fire-and-forget logic if needed, but for simplicity here strictly following stream pattern)
        try {
            const lastUserMsg = messages[messages.length - 1];
            const [userEmbedding, assistantEmbedding] = await Promise.all([
                generateEmbedding(lastUserMsg.content),
                generateEmbedding(content)
            ]);

            await supabaseAdmin.from('chat_logs').insert([
                { user_id: keyData.user_id, role: 'user', content: lastUserMsg.content, embedding: userEmbedding },
                { user_id: keyData.user_id, role: 'assistant', content: content, embedding: assistantEmbedding }
            ]);
        } catch (e) { console.error("Persistence failed", e); }

        return NextResponse.json({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'soulprint-v2-local',
            choices: [{
                index: 0,
                message: { role: 'assistant', content },
                finish_reason: 'stop'
            }]
        });

    } catch (error: unknown) {
        console.error('❌ Chat API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: `API error: ${errorMessage}`,
        }, { status: 500 });
    }
}
