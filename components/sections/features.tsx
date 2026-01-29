"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

const features = [
    {
        description: "A deep, personality-level profile that learns how you speak, think, and create — so every AI responds in your voice, not default mode.",
        image: "/images/70BF4797-F5D0-4E44-95F5-40AD9E229EE9.png"
    },
    {
        description: "Use ChatGPT, Claude, Gemini, Perplexity. Anything.\nYour SoulPrint travels with you and upgrades every model instantly.",
        image: "/images/95CD28D2-B748-468D-BBCB-7B636C020FD0.png"
    },
    {
        description: "Your data stays with you. Encrypted on your device.\nNothing leaves your hands unless you choose it.",
        image: "/images/16BACDBA-C5FD-4549-B8E0-10832C3E5A12.png"
    },
    {
        description: "Your AI adapts to your mood, goals, tone, and pace bringing out your best thinking and your true voice.",
        image: "/images/07662748-2DAA-43D5-9147-AC14C76177F8.png"
    }
];

export function Features() {
    return (
        <section className="w-full bg-background py-20 md:py-32">
            <div className="container px-4 md:px-6">
                <div className="flex flex-col gap-16">
                    {/* Section Header */}
                    <div className="flex flex-col items-center text-center gap-6 max-w-3xl mx-auto">
                        <h2 className="font-koulen text-5xl leading-[0.9] tracking-tight text-foreground md:text-[72px] md:leading-[80px]">
                            MEET THE AI THAT
                            <br />
                            ACTUALLY GETS YOU.
                        </h2>
                        <p className="text-base text-muted-foreground md:text-lg max-w-2xl">
                            SoulPrint builds a personal identity layer that upgrades every AI you use.
                            <br />
                            Your tone. Your patterns. Your cognitive rhythm — carried with you, encrypted and under your control.
                        </p>
                    </div>

                    {/* Features Grid */}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {features.map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Card className="h-full overflow-hidden border-border/50 bg-card/50 transition-colors hover:bg-card hover:border-border">
                                    <div className="aspect-[4/3] w-full relative overflow-hidden">
                                        <Image
                                            src={feature.image}
                                            alt={feature.description}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <CardContent className="flex flex-col gap-4 p-6">
                                        <p className="text-base text-foreground font-geist leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
