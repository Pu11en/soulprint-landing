import { Metadata, Viewport } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ChatWrapper } from "./chat-wrapper"

export const metadata: Metadata = {
    title: "SoulPrint Chat",
    description: "Chat with your AI companion",
}

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
}

export default async function ChatPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    // Get user profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single()

    // Check if user has imported data - REQUIRED to access chat
    const { count: importCount } = await supabase
        .from("imported_chats")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)

    const hasImportedData = (importCount || 0) > 0

    // Redirect to onboarding if no imported data
    if (!hasImportedData) {
        redirect("/onboarding/export")
    }

    return (
        <ChatWrapper 
            userName={profile?.full_name || user.email?.split("@")[0] || "User"}
            hasImportedData={hasImportedData}
        />
    )
}
