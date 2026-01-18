"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { randomBytes, createHash } from "crypto"

export async function generateApiKey(label: string = "Default Key", status: 'active' | 'inactive' = 'active') {
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

    // Validate user authentication
    if (!user || !user.email) {
        return {
            error: "Authentication required",
            details: "User not authenticated."
        }
    }

    // 1. Enforce Single Key Policy & Cleanup
    const { data: existingKeys } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (existingKeys && existingKeys.length > 0) {
        const activeKey = existingKeys[0]

        // Delete duplicates (older keys)
        if (existingKeys.length > 1) {
            const idsToDelete = existingKeys.slice(1).map(k => k.id)
            await supabase.from('api_keys').delete().in('id', idsToDelete)
        }

        // If existing key has viewable value, return it
        if (activeKey.encrypted_key) {
            return {
                apiKey: activeKey.encrypted_key,
                id: activeKey.id,
                status: activeKey.status
            }
        }

        // If legacy key (no raw value stored), delete and regenerate so user can view it
        await supabase.from('api_keys').delete().eq('id', activeKey.id)
    }

    // 2. Generate new key
    const rawKey = 'sk-soulprint-' + randomBytes(24).toString('hex')
    const hashedKey = createHash('sha256').update(rawKey).digest('hex')

    // Store in Supabase
    // Note: Storing rawKey in 'encrypted_key' for MVP visibility. 
    // Ideally encrypt this with a server secret.
    const { data, error } = await supabase
        .from('api_keys')
        .insert({
            user_id: user.id,
            label,
            key_hash: hashedKey,
            encrypted_key: rawKey,
            status
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating key:", error)
        return { error: error.message }
    }

    return { apiKey: rawKey, id: data.id, status: data.status }
}

export async function ensureDefaultApiKey() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() }
            }
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { count } = await supabase
        .from('api_keys')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

    if (count === 0) {
        await generateApiKey("Default Key (Auto)", "inactive")
    }
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

    // Validate user authentication
    if (!user || !user.email) {
        return {
            error: "Authentication required",
            keys: []
        }
    }

    const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id) // Use UUID as primary identifier
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching keys:", error)
        return {
            error: error.message,
            code: error.code,
            details: error.details,
            keys: []
        }
    }

    // Map to include displayable key
    const keys = data.map(k => ({
        ...k,
        display_key: k.encrypted_key // Expose the stored key for UI
    }))

    return { keys }
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

    const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id)

    if (error) {
        console.error("Error revoking key:", error)
        return {
            error: error.message,
            code: error.code,
            details: error.details
        }
    }

    return { success: true }
}
