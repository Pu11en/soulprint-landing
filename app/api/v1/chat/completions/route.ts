import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
// import { gemini, DEFAULT_MODEL } from "@/lib/gemini/client"; // Removed
import { checkHealth, streamChatCompletion, chatCompletion, ChatMessage } from "@/lib/llm/local-client";
import { loadMemory, buildSystemPrompt } from "@/lib/letta/soulprint-memory";

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
        let keyData;
        let keyError;

        if (rawKey === "sk-soulprint-demo-fallback-123456" || rawKey === "sk-soulprint-demo-internal-key") {
            // Use Elon's UUID for demo mode
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

            // Use Unified Client for resilient generation
            const { unifiedChatCompletion } = await import("@/lib/llm/unified-client");
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
