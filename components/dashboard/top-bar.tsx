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

    return (
        <header className="flex h-[52px] items-center justify-between border-b border-[#222] bg-[#171717] px-4">
            {/* Left side - can be empty or show current section */}
            <div className="font-koulen text-[32px] leading-[38px] text-[#f5f5f5]">
                {/* Empty as per design */}
            </div>
            
            {/* Right side - Log out button */}
            <Button
                onClick={handleLogout}
                className="h-9 rounded-md bg-orange-600 px-4 py-2 font-geist text-sm font-medium text-[#e5e5e5] shadow-sm hover:bg-orange-700"
            >
                Log out
            </Button>
        </header>
    )
}
