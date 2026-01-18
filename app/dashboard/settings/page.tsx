"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Shield, Bot, Cpu, Brain, LogOut, Trash2 } from "lucide-react"

interface SettingsCard {
    id: string
    title: string
    icon: React.ReactNode
    buttonText: string
    buttonVariant: "default" | "outline" | "disabled" | "locked"
    isActive?: boolean
}

export default function SettingsPage() {
    const router = useRouter()
    const supabase = createClient()
    const [hasSoulprint, setHasSoulprint] = useState(false)
    const [loading, setLoading] = useState(true)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/')
                return
            }

            // Check if user has a soulprint
            const { data: soulprint } = await supabase
                .from('soulprints')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle()

            setHasSoulprint(!!soulprint)
            setLoading(false)
        }
        checkUser()
    }, [router, supabase])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        localStorage.removeItem("soulprint_internal_key")
        localStorage.removeItem("soulprint_answers")
        localStorage.removeItem("soulprint_current_q")
        router.push('/')
    }

    const handleDeleteAccount = async () => {
        setDeleting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Delete user's soulprints first
            await supabase.from('soulprints').delete().eq('user_id', user.id)
            
            // Delete user's chat messages
            await supabase.from('chat_messages').delete().eq('user_id', user.id)
            
            // Delete user's chat sessions
            await supabase.from('chat_sessions').delete().eq('user_id', user.id)

            // Sign out the user (account deletion requires admin API, but we clean up all data)
            await supabase.auth.signOut()
            localStorage.clear()
            router.push('/')
        } catch (error) {
            console.error('Error deleting account:', error)
            setDeleting(false)
        }
    }

    const settingsCards: SettingsCard[] = [
        {
            id: "soulprint",
            title: "SoulPrint",
            icon: <Brain className="w-5 h-5" />,
            buttonText: hasSoulprint ? "View" : "Create",
            buttonVariant: "default",
            isActive: true
        },
        {
            id: "storage",
            title: "Storage and Privacy",
            icon: <Shield className="w-5 h-5" />,
            buttonText: "Coming Soon",
            buttonVariant: "disabled"
        },
        {
            id: "ai-accounts",
            title: "Manage Ai Accounts",
            icon: <Bot className="w-5 h-5" />,
            buttonText: "Coming",
            buttonVariant: "disabled"
        },
        {
            id: "local-llm",
            title: "Deploy to Local LLM",
            icon: <Cpu className="w-5 h-5" />,
            buttonText: "Soon",
            buttonVariant: "disabled"
        },
        {
            id: "adaptive",
            title: "Adaptive Intelligence",
            icon: <Brain className="w-5 h-5" />,
            buttonText: "Coming",
            buttonVariant: "disabled"
        }
    ]

    const handleCardAction = (cardId: string) => {
        switch (cardId) {
            case "soulprint":
                if (hasSoulprint) {
                    router.push('/dashboard/profile')
                } else {
                    router.push('/questionnaire')
                }
                break
            default:
                // Coming soon features - disabled buttons won't trigger this
                break
        }
    }

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#fafafa]">
                <div className="animate-pulse text-gray-500">Loading...</div>
            </div>
        )
    }

    return (
        <div className="relative flex h-full w-full flex-col overflow-auto rounded-xl bg-[#fafafa] shadow-[0px_4px_4px_2px_rgba(0,0,0,0.25)]">
            {/* Main Content Area */}
            <div className="flex-1 p-6 lg:p-8">
                {/* Page Header */}
                <div className="mb-8">
                    <span className="text-sm font-medium text-black/60">
                        Account Settings
                    </span>
                    <h1 className="font-koulen text-[32px] leading-[38px] text-black mt-2">
                        Settings
                    </h1>
                </div>

                {/* Settings Cards */}
                <div className="flex flex-col gap-5 max-w-[480px]">
                    {settingsCards.map((card) => (
                        <SettingsCardComponent
                            key={card.id}
                            card={card}
                            onAction={() => handleCardAction(card.id)}
                        />
                    ))}
                </div>

                {/* Upgrade Prompt */}
                <div className="mt-12 max-w-[480px]">
                    <div className="p-6 bg-gradient-to-r from-[#18181B] to-[#27272A] rounded-[14px] text-white">
                        <h3 className="font-geist font-semibold text-lg mb-2">
                            Unlock More Features
                        </h3>
                        <p className="text-sm text-white/70 mb-4">
                            Upgrade to Standard or Enterprise to access AI account management, local LLM deployment, and adaptive intelligence.
                        </p>
                        <Button
                            onClick={() => router.push('/dashboard/pricing')}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            View Plans
                        </Button>
                    </div>
                </div>

                {/* Account Actions */}
                <div className="mt-12 max-w-[480px]">
                    <h2 className="font-geist font-semibold text-lg text-black mb-4">Account</h2>
                    
                    {/* Sign Out */}
                    <div className="flex flex-col p-6 gap-4 rounded-[14px] border border-[#E5E5E5] bg-white shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <LogOut className="w-5 h-5 text-[#0A0A0A]" />
                                <span className="font-geist font-semibold text-sm text-[#0A0A0A]">
                                    Sign Out
                                </span>
                            </div>
                            <Button
                                onClick={handleSignOut}
                                className="h-9 px-4 rounded-lg font-geist font-medium text-sm bg-white border border-[#E5E5E5] text-[#0A0A0A] hover:bg-gray-50 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
                                variant="ghost"
                            >
                                Sign Out
                            </Button>
                        </div>
                    </div>

                    {/* Delete Account */}
                    <div className="flex flex-col p-6 gap-4 rounded-[14px] border border-red-200 bg-red-50 shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Trash2 className="w-5 h-5 text-red-600" />
                                <div>
                                    <span className="font-geist font-semibold text-sm text-red-600 block">
                                        Delete Account
                                    </span>
                                    <span className="font-geist text-xs text-red-500">
                                        This will permanently delete all your data
                                    </span>
                                </div>
                            </div>
                            {!showDeleteConfirm ? (
                                <Button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="h-9 px-4 rounded-lg font-geist font-medium text-sm bg-white border border-red-300 text-red-600 hover:bg-red-50 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
                                    variant="ghost"
                                >
                                    Delete
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="h-9 px-4 rounded-lg font-geist font-medium text-sm bg-white border border-[#E5E5E5] text-[#0A0A0A] hover:bg-gray-50"
                                        variant="ghost"
                                        disabled={deleting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleDeleteAccount}
                                        disabled={deleting}
                                        className="h-9 px-4 rounded-lg font-geist font-medium text-sm bg-red-600 text-white hover:bg-red-700"
                                    >
                                        {deleting ? "Deleting..." : "Confirm"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SettingsCardComponent({ 
    card, 
    onAction 
}: { 
    card: SettingsCard
    onAction: () => void 
}) {
    const getButtonStyles = () => {
        switch (card.buttonVariant) {
            case "default":
                return "bg-white border border-[#E5E5E5] text-[#0A0A0A] hover:bg-gray-50 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
            case "outline":
                return "bg-[#F2F3F5] border border-[#E5E5E5] text-[#78797B] hover:bg-gray-100 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
            case "disabled":
                return "bg-white/50 border border-[#E5E5E5] text-[#0A0A0A] opacity-50 cursor-not-allowed shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
            case "locked":
                return "bg-[#F5F5F5] text-[#737373] cursor-not-allowed"
            default:
                return ""
        }
    }

    const getCardBackground = () => {
        if (card.isActive) {
            return "bg-white"
        }
        return "bg-[#E5E7EB]"
    }

    return (
        <div 
            className={`
                flex flex-col p-6 gap-4 rounded-[14px] border border-[#E5E5E5]
                shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]
                ${getCardBackground()}
            `}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-geist font-semibold text-sm text-[#0A0A0A]">
                        {card.title}
                    </span>
                </div>
                <Button
                    onClick={onAction}
                    disabled={card.buttonVariant === "disabled" || card.buttonVariant === "locked"}
                    className={`
                        h-9 px-4 rounded-lg font-geist font-medium text-sm
                        ${getButtonStyles()}
                    `}
                    variant="ghost"
                >
                    {card.buttonText}
                </Button>
            </div>
        </div>
    )
}
