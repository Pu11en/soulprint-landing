"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export function TopBar() {
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        async function getUser() {
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.email) {
                setUserEmail(user.email)
            }
        }
        getUser()
    }, [supabase])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        localStorage.removeItem("soulprint_internal_key")
        localStorage.removeItem("soulprint_answers")
        localStorage.removeItem("soulprint_current_q")
        router.push('/')
    }

    // Get initials from email
    const initials = userEmail 
        ? userEmail.substring(0, 2).toUpperCase()
        : '??'

    return (
        <header className="flex h-16 items-center justify-end gap-4 border-b border-[#333] bg-[#0A0A0A] px-6">
            <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600/20 text-xs font-medium text-orange-500">
                    {initials}
                </div>
                <div className="hidden text-sm text-gray-400 md:block">
                    {userEmail || 'Loading...'}
                </div>
            </div>
            <div className="h-4 w-px bg-[#333]" />
            <Button
                variant="ghost"
                className="text-gray-400 hover:text-white"
                onClick={handleLogout}
            >
                Log out
            </Button>
        </header>
    )
}
