"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Check, Info } from "lucide-react"

interface PricingTier {
    name: string
    price: string
    period: string
    description: string
    buttonText: string
    buttonVariant: "primary" | "secondary" | "enterprise"
    featuresTitle: string
    features: string[]
    isEnterprise?: boolean
}

export default function PricingPage() {
    const router = useRouter()

    const pricingTiers: PricingTier[] = [
        {
            name: "Basic",
            price: "$0",
            period: "/month",
            description: "A short benefit statement that highlights the ideal user for this tier.",
            buttonText: "Get Started Free",
            buttonVariant: "primary",
            featuresTitle: "What's included:",
            features: [
                "Core SoulPrint generation",
                "Basic AI chat interface",
                "Standard questionnaire"
            ]
        },
        {
            name: "Standard",
            price: "$29",
            period: "/month",
            description: "For power users who want the full SoulPrint experience.",
            buttonText: "Coming Soon",
            buttonVariant: "secondary",
            featuresTitle: "Everything in Basic, plus:",
            features: [
                "Advanced identity mapping",
                "Multi-AI deployment",
                "Priority processing",
                "Extended storage"
            ]
        },
        {
            name: "Enterprise",
            price: "Contact us",
            period: "",
            description: "Custom solutions for teams and organizations.",
            buttonText: "Contact Sales",
            buttonVariant: "enterprise",
            featuresTitle: "Everything in Standard, plus:",
            features: [
                "Custom integrations",
                "Dedicated support",
                "Team management",
                "Advanced analytics",
                "SLA guarantees"
            ],
            isEnterprise: true
        }
    ]

    const handleSelectPlan = (tierName: string) => {
        if (tierName === "Basic") {
            router.push('/questionnaire')
        } else if (tierName === "Enterprise") {
            window.location.href = 'mailto:hello@soulprint.ai?subject=Enterprise%20Inquiry'
        } else if (tierName === "Standard") {
            alert('Standard plan coming soon! Start with Basic for now.')
        }
    }

    return (
        <div className="relative flex h-full w-full flex-col overflow-auto rounded-xl bg-[#fafafa] shadow-[0px_4px_4px_2px_rgba(0,0,0,0.25)]">
            {/* Main Content Area */}
            <div className="flex-1 p-6 lg:p-8">
                {/* Section Title */}
                <div className="flex flex-col items-center text-center mb-12 max-w-[576px] mx-auto">
                    <h1 className="font-koulen text-6xl md:text-[72px] leading-[80px] text-[#0A0A0A] mb-5">
                        Choose Your Plan
                    </h1>
                    <p className="font-inter text-base leading-6 text-[#737373]">
                        Add a concise value statement that highlights your product&apos;s key features and benefits in a visually dynamic grid. Focus on creating balanced content blocks while keeping it under 2-3 lines.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="flex flex-col lg:flex-row items-stretch justify-center gap-6 max-w-[1024px] mx-auto">
                    {pricingTiers.map((tier) => (
                        <PricingCard
                            key={tier.name}
                            tier={tier}
                            onSelect={() => handleSelectPlan(tier.name)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function PricingCard({ 
    tier, 
    onSelect 
}: { 
    tier: PricingTier
    onSelect: () => void 
}) {
    const isEnterprise = tier.isEnterprise

    return (
        <div 
            className={`
                flex flex-col p-8 gap-8 rounded-[14px] flex-1 max-w-[325px]
                ${isEnterprise 
                    ? 'bg-black text-white shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]' 
                    : 'bg-white border border-[#E5E5E5] shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]'
                }
            `}
        >
            {/* Top Section */}
            <div className="flex flex-col gap-6">
                {/* Name & Description */}
                <div className="flex flex-col gap-3">
                    <h3 className={`font-geist font-semibold text-lg leading-7 ${isEnterprise ? 'text-white' : 'text-[#0A0A0A]'}`}>
                        {tier.name}
                    </h3>
                    <p className={`font-geist font-normal text-sm leading-5 ${isEnterprise ? 'text-white/70' : 'text-[#737373]'}`}>
                        {tier.description}
                    </p>
                </div>

                {/* Price */}
                <div className="flex items-end gap-0.5">
                    <span className={`font-geist font-semibold text-4xl leading-10 ${isEnterprise ? 'text-white/70' : 'text-[#0A0A0A]'}`}>
                        {tier.price}
                    </span>
                    {tier.period && (
                        <span className={`font-geist font-normal text-base leading-6 ${isEnterprise ? 'text-white/70' : 'text-[#737373]'}`}>
                            {tier.period}
                        </span>
                    )}
                </div>

                {/* CTA Button */}
                <Button
                    onClick={onSelect}
                    className={`
                        w-full h-9 rounded-lg font-geist font-medium text-sm
                        ${isEnterprise 
                            ? 'bg-[#F5F5F5] text-[#171717] hover:bg-white' 
                            : 'bg-orange-600 text-[#FAFAFA] hover:bg-orange-700'
                        }
                    `}
                >
                    {tier.buttonText}
                </Button>
            </div>

            {/* Features Section */}
            <div className="flex flex-col gap-4">
                <span className={`font-geist font-medium text-sm leading-5 ${isEnterprise ? 'text-white' : 'text-[#0A0A0A]'}`}>
                    {tier.featuresTitle}
                </span>
                <div className="flex flex-col gap-2">
                    {tier.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-3">
                            <Check className={`w-5 h-5 ${isEnterprise ? 'text-white' : 'text-[#171717]'}`} strokeWidth={1.75} />
                            <span className={`font-geist font-normal text-sm leading-5 flex-1 ${isEnterprise ? 'text-white/70' : 'text-[#737373]'}`}>
                                {feature}
                            </span>
                            <Info className={`w-4 h-4 ${isEnterprise ? 'text-white/40' : 'text-[#737373]/70'}`} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
