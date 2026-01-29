"use client";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";

const features = [
    {
        title: "Your Identity, Captured",
        description: "A deep identity profile that learns your cadence, vocabulary, and decision-making style. SoulPrint doesn't just store data; it understands the nuance of who you are.",
        image: "/images/aspect-ratio1.png",
    },
    {
        title: "Independent by Design",
        description: "SoulPrint is a standalone identity engine. It does not live inside any LLM. It is the bridge that carries your unique signature to any intelligence you choose to engage with.",
        image: "/images/aspect-ratio.png",
    },
    {
        title: "Your AI, Finally Personalized",
        description: "Persistent identity aligning to mood, goals, tone, and pace. Stop prompting from scratch. Start every interaction with an AI that already knows you.",
        image: "/images/vector-personalized.png",
    },
    {
        title: "Private by Default",
        description: "Your data stays on your device. Encrypted. Under your control. No tracking, no cloud surveillance — just pure, personal AI that respects your privacy.",
        image: "/images/aspect-ratio3.png",
    },
];

export function FeatureBlogSection() {
    return (
        <section className="flex w-full flex-col items-center bg-white py-24">
            <div className="flex w-full max-w-[1400px] flex-col items-center gap-16 px-6 md:px-12 lg:px-12 xl:px-24">
                {/* Header Section */}
                <div className="flex w-full max-w-[800px] flex-col items-center gap-6 text-center">
                    <h2 className="font-koulen text-[48px] font-normal leading-[0.9] text-[#0A0A0A] uppercase md:text-[64px] lg:text-[72px]">
                        MEET THE AI THAT
                        <br />
                        ACTUALLY GETS YOU.
                    </h2>
                    <p className="max-w-[600px] font-inter text-base font-normal leading-relaxed text-[#737373] md:text-lg">
                        SoulPrint builds a personal identity layer that upgrades every AI you use.
                        <br className="hidden md:block" />
                        Your tone. Your patterns. Your cognitive rhythm — carried with you,
                        <br className="hidden md:block" />
                        encrypted and under your control.
                    </p>
                </div>

                {/* Grid Section */}
                <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
                    {features.map((feature, index) => (
                        <div key={index} className="flex flex-col gap-4">
                            <AspectRatio ratio={4 / 3} className="overflow-hidden bg-black">
                                <Image
                                    src={feature.image}
                                    alt={feature.title}
                                    fill
                                    className="object-contain p-4 transition-transform duration-300 hover:scale-105"
                                />
                            </AspectRatio>
                            <div className="flex flex-col gap-3">
                                <h3 className="font-geist text-lg font-semibold leading-tight text-[#0A0A0A]">
                                    {feature.title}
                                </h3>
                                <p className="font-geist text-sm font-normal leading-relaxed text-[#737373]">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
