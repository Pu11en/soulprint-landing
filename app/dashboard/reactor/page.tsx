import { IdentityReactor } from "@/components/dashboard/identity-reactor"

export default function ReactorPage() {
    return (
        <div className="flex h-full flex-col gap-4">
            {/* Header */}
            <div className="font-mono text-sm tracking-wider text-gray-500">
                SOULPRINT ENGINE / IDENTITY REACTOR
            </div>

            {/* Main Content */}
            <div className="flex-1">
                <IdentityReactor />
            </div>
        </div>
    )
}
