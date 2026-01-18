"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Generate a short, readable slug
function generateSlug(): string {
    const adjectives = ['bold', 'calm', 'deep', 'keen', 'sage', 'warm', 'wise', 'pure', 'true', 'free']
    const nouns = ['soul', 'mind', 'self', 'core', 'path', 'flow', 'wave', 'spark', 'glow', 'light']
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const num = Math.floor(Math.random() * 1000)
    return `${adj}-${noun}-${num}`
}

export async function togglePublicProfile(soulprintId: string): Promise<{ success: boolean; isPublic: boolean; shareUrl?: string; error?: string }> {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, isPublic: false, error: "Not authenticated" }
    }

    // Get current soulprint
    const { data: soulprint, error: fetchError } = await supabase
        .from("soulprints")
        .select("is_public, share_slug, user_id")
        .eq("id", soulprintId)
        .single()

    if (fetchError || !soulprint) {
        return { success: false, isPublic: false, error: "SoulPrint not found" }
    }

    // Verify ownership
    if (soulprint.user_id !== user.id) {
        return { success: false, isPublic: false, error: "Not authorized" }
    }

    const newIsPublic = !soulprint.is_public
    let shareSlug = soulprint.share_slug

    // Generate slug if making public and no slug exists
    if (newIsPublic && !shareSlug) {
        shareSlug = generateSlug()

        // Ensure slug is unique
        let attempts = 0
        while (attempts < 5) {
            const { data: existing } = await supabase
                .from("soulprints")
                .select("id")
                .eq("share_slug", shareSlug)
                .single()

            if (!existing) break
            shareSlug = generateSlug()
            attempts++
        }
    }

    // Update soulprint
    const { error: updateError } = await supabase
        .from("soulprints")
        .update({
            is_public: newIsPublic,
            share_slug: shareSlug
        })
        .eq("id", soulprintId)

    if (updateError) {
        return { success: false, isPublic: soulprint.is_public || false, error: updateError.message }
    }

    revalidatePath("/dashboard/profile")

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://soulprint.studio"
    const shareUrl = newIsPublic ? `${baseUrl}/s/${shareSlug}` : undefined

    return { success: true, isPublic: newIsPublic, shareUrl }
}

export async function getPublicProfileStatus(soulprintId: string): Promise<{ isPublic: boolean; shareUrl?: string }> {
    const supabase = await createClient()

    const { data } = await supabase
        .from("soulprints")
        .select("is_public, share_slug")
        .eq("id", soulprintId)
        .single()

    if (!data) {
        return { isPublic: false }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://soulprint.studio"
    const shareUrl = data.is_public && data.share_slug ? `${baseUrl}/s/${data.share_slug}` : undefined

    return { isPublic: data.is_public || false, shareUrl }
}
