"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

const COOKIE_NAME = "soulprint_focus_id"

import { createServerClient } from "@supabase/ssr"

export async function switchSoulPrint(soulprintId: string) {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, soulprintId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax"
    })

    // Update DB for persistent API context
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: { getAll() { return cookieStore.getAll() } }
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('profiles').update({ current_soulprint_id: soulprintId }).eq('id', user.id)
    }

    revalidatePath("/dashboard")
}

export async function listMySoulPrints() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: { getAll() { return cookieStore.getAll() } }
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('soulprints')
        .select('id, soulprint_data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    // Note: Auto-focus repair is handled client-side to avoid cookie modification in Server Components
    // If the current focus is invalid, the client will detect and repair it

    // Map to simpler format for UI, extracting name from json if possible
    return data?.map(sp => ({
        id: sp.id,
        name: sp.soulprint_data?.name || sp.soulprint_data?.archetype || "Unknown SoulPrint",
        archetype: sp.soulprint_data?.archetype
    })) || []
}

export async function getSelectedSoulPrintId() {
    const cookieStore = await cookies()
    const currentId = cookieStore.get(COOKIE_NAME)?.value

    // Safety check: Validate this ID actually belongs to the user
    // This prevents "Unrecognized Name" errors if cookies get stale/mixed
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: { getAll() { return cookieStore.getAll() } }
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Fetch user's soulprints to validate
    const { data: soulprints } = await supabase
        .from('soulprints')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (soulprints && soulprints.length > 0) {
        // If we have an ID, check if it's valid
        const isValid = currentId && soulprints.some(s => s.id === currentId)

        if (!isValid) {
            // Invalid or missing cookie ID - return the most recent soulprint
            // Client will handle repair via Server Action
            return soulprints[0].id
        }
    } else {
        // User has no soulprints
        return null
    }

    return currentId
}
