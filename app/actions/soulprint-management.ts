"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

/**
 * Update the custom name for a SoulPrint
 */
export async function updateSoulPrintName(soulprintId: string, newName: string) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: { getAll() { return cookieStore.getAll() } }
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: "Not authenticated" }
    }

    // Fetch current soulprint data
    const { data: current, error: fetchError } = await supabase
        .from('soulprints')
        .select('soulprint_data')
        .eq('id', soulprintId)
        .eq('user_id', user.id)
        .single()

    if (fetchError || !current) {
        return { error: "SoulPrint not found" }
    }

    // Update the name within the soulprint_data JSON
    const updatedData = {
        ...current.soulprint_data,
        name: newName.trim()
    }

    const { error: updateError } = await supabase
        .from('soulprints')
        .update({
            soulprint_data: updatedData,
            updated_at: new Date().toISOString()
        })
        .eq('id', soulprintId)
        .eq('user_id', user.id)

    if (updateError) {
        console.error("Failed to update SoulPrint name:", updateError)
        return { error: updateError.message }
    }

    revalidatePath("/dashboard")
    return { success: true, name: newName.trim() }
}

/**
 * Delete a SoulPrint
 */
export async function deleteSoulPrint(soulprintId: string) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: { getAll() { return cookieStore.getAll() } }
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: "Not authenticated" }
    }

    const { error } = await supabase
        .from('soulprints')
        .delete()
        .eq('id', soulprintId)
        .eq('user_id', user.id)

    if (error) {
        console.error("Failed to delete SoulPrint:", error)
        return { error: error.message }
    }

    revalidatePath("/dashboard")
    return { success: true }
}
