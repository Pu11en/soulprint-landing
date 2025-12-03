import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// Initialize Supabase Admin client (to bypass RLS for key check)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Fallback for dev if service key missing
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
        
        console.log('🔑 Validating API key...');
        console.log('🔑 Key hash:', hashedKey.substring(0, 20) + '...');

        // 2. Validate Key
        let keyData, keyError;

        // Check for fallback demo API key - uses Elon Musk persona
        if (rawKey === "sk-soulprint-demo-fallback-123456") {
            // Use Elon's UUID for demo mode (same as test@soulprint.ai user)
            keyData = { user_id: '4316c8f3-a383-4260-8cbc-daadea2ad142', id: 'demo-fallback-id' };
            keyError = null;
            console.log('🎭 Demo mode activated - using Elon Musk persona');
        } else {
            // Normal API key validation
            const result = await supabaseAdmin
                .from("api_keys")
                .select("user_id, id")
                .eq("key_hash", hashedKey)
                .single();

            keyData = result.data;
            keyError = result.error;
            
            console.log('🔑 DB lookup result:', { keyData, keyError });
        }

        if (keyError || !keyData) {
            console.log('❌ API key validation failed');
            return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
        }
        
        console.log('✅ API key valid for user:', keyData.user_id);

        // 3. Fetch User's SoulPrint (System Message)
        const { data: soulprint, error: soulprintError } = await supabaseAdmin
            .from("soulprints")
            .select("soulprint_data")
            .eq("user_id", keyData.user_id)
            .maybeSingle();

        if (soulprintError) {
            console.error('Error fetching soulprint:', soulprintError);
            return NextResponse.json({
                error: "Failed to fetch user's SoulPrint data. Please ensure your account is properly set up."
            }, { status: 500 });
        }

        console.log('📋 SoulPrint data found:', soulprint ? 'YES' : 'NO');
        if (soulprint?.soulprint_data) {
            console.log('📋 SoulPrint preview:', JSON.stringify(soulprint.soulprint_data).substring(0, 500) + '...');
        }

        if (!soulprint) {
            console.warn('No soulprint found for user:', keyData.user_id);
            // This shouldn't happen with the new initialization, but handle gracefully
        }

        // Safe JSON serialization function to handle circular references
        function safeJsonStringify(obj: unknown): string {
            try {
                const seen = new WeakSet();
                return JSON.stringify(obj, (_key, val) => {
                    if (val != null && typeof val === 'object') {
                        if (seen.has(val)) {
                            return '[Circular]';
                        }
                        seen.add(val);
                    }
                    // Filter out functions and undefined values
                    if (typeof val === 'function' || val === undefined) {
                        return undefined;
                    }
                    return val;
                }, 2);
            } catch (error) {
                console.error('JSON Serialization Error:', error);
                return '{}';
            }
        }

        let systemMessage = "You are a helpful AI assistant.";

        if (soulprint?.soulprint_data) {
            // Parse the soulprint data if it's a string
            let soulprintObj = soulprint.soulprint_data;
            if (typeof soulprintObj === 'string') {
                try {
                    soulprintObj = JSON.parse(soulprintObj);
                } catch (e) {
                    console.error('Failed to parse soulprint_data:', e);
                }
            }
            
            // Use the full_system_prompt if available, otherwise fall back to the whole object
            if (soulprintObj?.full_system_prompt) {
                systemMessage = soulprintObj.full_system_prompt;
                console.log('📋 Using full_system_prompt from SoulPrint');
            } else {
                const traits = JSON.stringify(soulprintObj, null, 2);
                systemMessage = `You are a personalized AI assistant for the user.
Your personality and responses should be shaped by the following SoulPrint identity data:
${traits}

Always stay in character based on these traits.`;
                console.log('📋 Using raw SoulPrint data as system message');
            }
        }

        // 4. Prepare Request to OpenAI
        const body = await req.json();
        const { messages, model = "gpt-4o", stream = false, ...rest } = body;

        const newMessages = [
            { role: "system", content: systemMessage },
            ...messages
        ];

        // 5. Forward to OpenAI
        const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model,
                messages: newMessages,
                stream,
                ...rest,
            }),
        });

        if (!openAIResponse.ok) {
            const responseText = await openAIResponse.text();
            let errorMessage = 'OpenAI API request failed';
            
            // Try to parse as JSON, but handle HTML error pages
            try {
                const error = JSON.parse(responseText);
                errorMessage = error.error?.message || error.message || errorMessage;
                return NextResponse.json({
                    error: errorMessage,
                    details: error
                }, { status: openAIResponse.status });
            } catch {
                // OpenAI returned HTML (error page) instead of JSON
                console.error('OpenAI returned non-JSON response:', responseText.substring(0, 200));
                return NextResponse.json({
                    error: 'OpenAI service temporarily unavailable. Please try again.',
                }, { status: 503 });
            }
        }

        // 6. Handle Response (Streaming vs Non-Streaming)
        if (stream) {
            // Pass through the stream
            return new NextResponse(openAIResponse.body, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            });
        } else {
            const data = await openAIResponse.json();

            // 7. Log Usage (Async)
            // We don't await this to avoid slowing down the response
            const inputTokens = data.usage?.prompt_tokens || 0;
            const outputTokens = data.usage?.completion_tokens || 0;

            supabaseAdmin.from("proxy_usage").insert({
                user_id: keyData.user_id,
                api_key_id: keyData.id,
                model,
                tokens_input: inputTokens,
                tokens_output: outputTokens,
            }).then(({ error }) => {
                if (error) console.error("Failed to log usage:", error);
            });

            return NextResponse.json(data);
        }

    } catch (error: unknown) {
        console.error("Proxy Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
