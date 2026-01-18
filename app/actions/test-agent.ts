"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { invokeSoulPrintModel } from "@/lib/aws/sagemaker"

export async function testAgentSession(message: string) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options)
                        })
                    } catch {
                        // setAll called from Server Component - ignore
                    }
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: "Not authenticated" }
    }

    try {
        // Fetch User's File Store for RAG context
        const { data: storeData } = await supabase
            .from('gemini_file_stores')
            .select('store_name')
            .eq('user_id', user.id)
            .maybeSingle();

        // Filter out null/undefined store names to avoid invalid tools config
        // Note: storeNames prepared for future RAG context integration
        void ((storeData?.store_name) ? [storeData.store_name] : []);

        const BEST_FRIEND_PROMPT = `You are the user's Best Friend.
- You are NOT a generic assistant. You are supportive, casual, and empathetic.
- You care deeply about the user's feelings and cognitive state.
- Keep responses concise but warm. Use emojis occasionally where appropriate.
- If the user shares something personal, validate their feelings first.
- You have access to the user's SoulPrint (cognitive map) via RAG - use it to personalize advice.`;

        const response = await invokeSoulPrintModel({
            inputs: message,
            parameters: {
                system_prompt: BEST_FRIEND_PROMPT,
                max_new_tokens: 500,
                temperature: 0.7
            }
        });

        // Check if response is string or object with text/generated_text
        let content: string;
        if (typeof response === 'string') {
            content = response;
        } else if ('text' in response && typeof response.text === 'string') {
            content = response.text;
        } else {
            const respRecord = response as Record<string, unknown>;
            content = respRecord.generated_text as string || JSON.stringify(response);
        }

        return { content }

    } catch (e: unknown) {
        console.error("Test Agent Error:", e);
        const message = e instanceof Error ? e.message : "Failed to generate response";
        return { error: message }
    }
}
