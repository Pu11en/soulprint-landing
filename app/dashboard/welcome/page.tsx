"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"
import Image from "next/image"

export default function WelcomePage() {
    const router = useRouter()
    const supabase = createClient()
    useEffect(() => {
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/')
                return
            }

            // Check if user already has a soulprint
            const { data: existingSoulprint } = await supabase
                .from('soulprints')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle()

            if (existingSoulprint) {
                // User already completed setup, redirect to chat
                router.push('/dashboard/chat')
            }
        }
        checkUser()
    }, [router, supabase])

    const handleStartQuestionnaire = () => {
        router.push('/questionnaire/intro')
    }

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[14px] bg-[#FAFAFA] shadow-[0px_4px_4px_2px_rgba(0,0,0,0.25)]">
            {/* Main Content - Centered */}
            <div className="flex-1 flex flex-col px-8 lg:px-16 pt-16 pb-8 overflow-auto">
                
                {/* Hero Section - Two Column Layout */}
                <div className="flex flex-col lg:flex-row items-start justify-between gap-12 mb-auto">
                    {/* Left - Text Content */}
                    <div className="flex flex-col gap-5 max-w-[580px]">
                        {/* Main Heading */}
                        <h1 className="font-koulen text-[56px] lg:text-[72px] leading-[1.1] text-black tracking-wide">
                            MEET THE AI THAT ACTUALLY GETS YOU.
                        </h1>
                        
                        {/* Description */}
                        <p className="font-inter text-base leading-7 text-[#737373] max-w-[520px]">
                            SoulPrint builds a personal identity layer that upgrades every AI you use.
                            Your tone. Your patterns. Your cognitive rhythm — carried with you, encrypted and under your control.
                        </p>
                        
                        {/* CTA Button */}
                        <Button 
                            onClick={handleStartQuestionnaire}
                            className="mt-2 w-fit h-11 px-6 bg-[#EA580C] hover:bg-orange-700 text-white font-geist font-medium text-sm rounded-lg shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
                        >
                            Build Your SoulPrint
                        </Button>
                    </div>

                    {/* Right - Video Placeholder */}
                    <div className="flex-shrink-0">
                        <div className="relative w-[380px] lg:w-[420px] h-[260px] lg:h-[290px] bg-black rounded-[10px] flex items-center justify-center cursor-pointer group">
                            {/* Play Button */}
                            <div className="w-16 h-16 bg-white/90 rounded-sm flex items-center justify-center group-hover:scale-110 transition-transform rotate-[-30deg]">
                                <Play className="w-7 h-7 text-black rotate-[30deg] ml-1" fill="black" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feature Cards Section - Bottom */}
                <div className="mt-auto pt-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-[1100px]">
                        {/* Card 1 - SoulPrint Identity */}
                        <div className="flex flex-col items-center">
                            <div className="relative w-full max-w-[310px] h-[200px] rounded-[10px] overflow-hidden">
                                <Image
                                    src="/images/16BACDBA-C5FD-4549-B8E0-10832C3E5A12.png"
                                    alt="SoulPrint Identity"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <h3 className="mt-4 font-inter font-bold text-lg leading-7 text-black text-center">
                                SoulPrint Identity
                            </h3>
                        </div>

                        {/* Card 2 - Define Your AI */}
                        <div className="flex flex-col items-center">
                            <div className="relative w-full max-w-[310px] h-[200px] rounded-[10px] overflow-hidden bg-[#0A0A0A] flex items-center justify-center">
                                {/* Orange spiral logo */}
                                <svg viewBox="0 0 200 200" className="w-[160px] h-[160px]">
                                    {/* Geometric spiral pattern */}
                                    <g fill="none" stroke="#EA580C" strokeWidth="1.5">
                                        {[...Array(12)].map((_, i) => {
                                            const size = 20 + i * 6;
                                            return (
                                                <polygon
                                                    key={i}
                                                    points={generatePolygonPoints(100, 100, size, 8)}
                                                    style={{ 
                                                        transform: `rotate(${i * 3.75}deg)`, 
                                                        transformOrigin: '100px 100px' 
                                                    }}
                                                />
                                            );
                                        })}
                                    </g>
                                    <circle cx="100" cy="100" r="8" fill="#EA580C"/>
                                </svg>
                            </div>
                            <h3 className="mt-4 font-inter font-bold text-lg leading-7 text-black text-center">
                                Define Your Ai
                            </h3>
                        </div>

                        {/* Card 3 - Fully Private */}
                        <div className="flex flex-col items-center">
                            <div className="relative w-full max-w-[310px] h-[200px] rounded-[10px] overflow-hidden">
                                <Image
                                    src="/images/07662748-2DAA-43D5-9147-AC14C76177F8.png"
                                    alt="Fully Private"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <h3 className="mt-4 font-inter font-bold text-lg leading-7 text-black text-center">
                                Fully Private. Fully Yours.
                            </h3>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Helper function to generate polygon points for the geometric pattern
function generatePolygonPoints(cx: number, cy: number, radius: number, sides: number): string {
    const points: string[] = []
    for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
        const x = cx + radius * Math.cos(angle)
        const y = cy + radius * Math.sin(angle)
        points.push(`${x},${y}`)
    }
    return points.join(' ')
}
