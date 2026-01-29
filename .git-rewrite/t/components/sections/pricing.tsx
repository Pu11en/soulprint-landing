"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import { motion } from "framer-motion"

const tiers = [
    {
        name: "Free",
        price: "$0",
        description: "Perfect for exploring SoulPrint",
        features: [
            "1 SoulPrint analysis",
            "Basic insights",
            "Community support",
            "Limited export options"
        ],
        cta: "Get Started",
        highlighted: false
    },
    {
        name: "Professional",
        price: "$29",
        period: "/month",
        description: "For individuals seeking deeper understanding",
        features: [
            "Unlimited SoulPrint analyses",
            "Advanced AI insights",
            "Priority support",
            "Full export capabilities",
            "Historical tracking",
            "Custom reports"
        ],
        cta: "Start Free Trial",
        highlighted: true
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "For teams and organizations",
        features: [
            "Everything in Professional",
            "Team collaboration",
            "API access",
            "Dedicated support",
            "Custom integrations",
            "SLA guarantee"
        ],
        cta: "Contact Sales",
        highlighted: false
    }
]

export function Pricing() {
    return (
        <section id="pricing" className="py-20 md:py-32 bg-muted/30">
            <div className="container px-4">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Choose the plan that&apos;s right for you
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {tiers.map((tier, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <Card className={`h-full ${tier.highlighted ? 'border-primary shadow-lg shadow-primary/20 scale-105' : 'border-border/50'}`}>
                                <CardHeader>
                                    {tier.highlighted && (
                                        <div className="text-xs font-semibold text-primary mb-2">MOST POPULAR</div>
                                    )}
                                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                                    <CardDescription>{tier.description}</CardDescription>
                                    <div className="mt-4">
                                        <span className="text-4xl font-bold">{tier.price}</span>
                                        {tier.period && <span className="text-muted-foreground">{tier.period}</span>}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <ul className="space-y-3">
                                        {tier.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                                <span className="text-sm">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        className="w-full"
                                        variant={tier.highlighted ? "default" : "outline"}
                                        size="lg"
                                    >
                                        {tier.cta}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
