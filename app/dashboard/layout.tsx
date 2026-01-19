import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Check if user has any soulprints
    let hasSoulprint = false
    if (user) {
        const { count } = await supabase
            .from('soulprints')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)

        hasSoulprint = !!count && count > 0
    }

    return (
        <DashboardShell hasSoulprint={hasSoulprint}>
            {children}
        </DashboardShell>
    )
}
