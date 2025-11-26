"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { randomBytes, createHash } from "crypto"

export async function generateApiKey(label: string = "Default Key") {
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
                    // Server actions can't set cookies easily in this context without middleware response, 
                    // but we are just reading auth here mostly.
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Generate a secure key
    // Format: sk-soulprint-[random-hex]
    const rawKey = 'sk-soulprint-' + randomBytes(24).toString('hex')

    // Hash it for storage
    const hashedKey = createHash('sha256').update(rawKey).digest('hex')

    // Store in Supabase
    // Note: We need the service role key to write to this table if RLS is strict,
    // or ensure the user has insert rights.
    // For now using the client context (RLS should allow user to insert their own keys).

    const { data, error } = await supabase
        .from('api_keys')
        .insert({
            user_id: user?.id, // Use actual user ID (UUID for authenticated users)
            label,
            key_hash: hashedKey,
            // We don't store the raw key!
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating key:", error)
        return { error: error.message }
    }

    // Return the RAW key to the user (one time only)
    return { apiKey: rawKey, id: data.id }
}

export async function listApiKeys() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) { },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user?.id) // Use actual user ID (UUID for authenticated users)
        .order('created_at', { ascending: false })

    if (error) {
        return { error: error.message }
    }

    return { keys: data }
}

export async function revokeApiKey(id: string) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) { },
            },
        }
    )

    const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}
