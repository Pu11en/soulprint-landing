import { ChatClient } from "./chat-client"
import { MobileChat } from "./mobile-chat"
import { getSelectedSoulPrintId } from "@/app/actions/soulprint-selection"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function ChatPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        const { count } = await supabase
            .from('soulprints')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)

        if (!count || count === 0) {
            redirect('/dashboard/welcome')
        }
    }

    // This runs on the server. When router.refresh() is called, this re-runs
    // and fetches the latest cookie value.
    const soulprintId = await getSelectedSoulPrintId() || null

    return (
        <>
            {/* Mobile: Clean, fluid chat experience */}
            <div className="lg:hidden h-full">
                <MobileChat initialSoulprintId={soulprintId} />
            </div>
            
            {/* Desktop: Full featured chat with sidebar */}
            <div className="hidden lg:block h-full">
                <ChatClient initialSoulprintId={soulprintId} />
            </div>
        </>
    )
}
