"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function DashboardRedirect() {
    const router = useRouter()
    const supabase = createClient()
    const [status, setStatus] = useState("Initializing...")

    useEffect(() => {
        async function checkRoute() {
            try {
                setStatus("Checking authentication...")
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    // Not logged in -> Login
                    setStatus("Not authenticated.")
                    return
                }

                setStatus("Checking SoulPrint status...")
                // Check if soulprint exists (using UUID)
                const { data: soulprint } = await supabase
                    .from('soulprints')
                    .select('user_id')
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (soulprint) {
                    setStatus("SoulPrint found. Redirecting to Chat...")
                    router.push('/dashboard/chat')
                } else {
                    setStatus("No SoulPrint found. Redirecting to Questionnaire...")
                    router.push('/questionnaire')
                }

            } catch (error) {
                console.error('Redirect error:', error)
                setStatus("Error checking status.")
            }
        }

        checkRoute()
    }, [router, supabase])

    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <p className="font-mono text-sm">{status}</p>
        </div>
    )
}
