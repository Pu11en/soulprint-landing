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

        // 2. Validate Key
        const { data: keyData, error: keyError } = await supabaseAdmin
            .from("api_keys")
            .select("user_id, id")
            .eq("key_hash", hashedKey)
            .single();
        if (keyError || !keyData) {
            return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
        }

        // 3. Fetch User's SoulPrint (System Message)
        const { data: soulprint, error: soulprintError } = await supabaseAdmin
            .from("soulprints")
            .select("soulprint_data")
            .eq("user_id", keyData.user_id)
            .single();

        if (soulprintError) {
            console.error('Error fetching soulprint:', soulprintError);
        }

        // Safe JSON serialization function to handle circular references
        function safeJsonStringify(obj: any): string {
            try {
                const seen = new WeakSet();
                return JSON.stringify(obj, (key, val) => {
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
            const traits = safeJsonStringify(soulprint.soulprint_data);
            systemMessage = `You are a personalized AI assistant for the user.
Your personality and responses should be shaped by the following SoulPrint identity data:
${traits}

Always stay in character based on these traits.`;
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
            const error = await openAIResponse.json();
            return NextResponse.json(error, { status: openAIResponse.status });
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

    } catch (error: any) {
        console.error("Proxy Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
