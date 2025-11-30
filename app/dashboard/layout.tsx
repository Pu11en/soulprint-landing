import { Sidebar } from "@/components/dashboard/sidebar"
import { TopBar } from "@/components/dashboard/top-bar"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen bg-[#4c4c4c] text-white">
            <Sidebar />
            <div className="flex flex-1 flex-col">
                <TopBar />
                <main className="flex-1 overflow-auto bg-[#171717] p-4">
                    {children}
                </main>
            </div>
        </div>
    )
}
