"use client";

import { motion } from "framer-motion";
import {
    Database,
    Fingerprint,
    Lock,
    Cpu,
    WifiOff,
    RefreshCcw
} from "lucide-react";

const features = [
    {
        title: "Built on Our Own Engine",
        description: "No rented models. No third-party APIs. We built our own foundational model from the ground up — optimized for presence, persistence, and personalization.",
        icon: Cpu,
        className: "lg:col-span-2 lg:row-span-2 bg-neutral-900/50",
    },
    {
        title: "Identity-Locked Memory",
        description: "We don’t store 'chat history.' We build continuity of self. Your tone, preferences, and patterns woven into the way your AI thinks.",
        icon: Fingerprint,
        className: "lg:col-span-1 bg-neutral-900/50",
    },
    {
        title: "Private by Design",
        description: "Your data stays local. Backups are optional and encrypted. No silent sync. No behavioral surveillance.",
        icon: Lock,
        className: "lg:col-span-1 bg-neutral-900/50",
    },
    {
        title: "Behavioral Engine",
        description: "This isn’t prompt engineering. This is cognitive imprinting — a system that learns your rhythm and emotional resonance.",
        icon: Database,
        className: "lg:col-span-1 bg-neutral-900/50",
    },
    {
        title: "Fully Offline-Ready",
        description: "We own the model, so we can deploy it anywhere. Local servers, air-gapped networks. Your intelligence goes where you go.",
        icon: WifiOff,
        className: "lg:col-span-1 bg-neutral-900/50",
    },
    {
        title: "Built for Continuity",
        description: "Most AIs start from scratch. We don't. SoulPrint anchors context across weeks, projects, and decisions.",
        icon: RefreshCcw,
        className: "lg:col-span-2 bg-neutral-900/50",
    },
];

export function FeaturesBentoSection() {
    return (
        <section className="w-full bg-[#050505] py-24 text-white">
            <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-24">

                {/* Header */}
                <div className="mb-16 flex flex-col items-start gap-4">
                    <h2 className="font-koulen text-4xl uppercase leading-none md:text-6xl text-white">
                        Core Features
                    </h2>
                    <p className="max-w-2xl font-inter text-lg text-neutral-400">
                        Not a wrapper. A full-stack intelligence architecture designed for emotional cadence and persistent memory.
                    </p>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            viewport={{ once: true }}
                            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/5 p-8 hover:border-white/10 ${feature.className}`}
                        >
                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                                    <feature.icon className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="font-koulen text-2xl uppercase tracking-wide text-white">
                                    {feature.title}
                                </h3>
                                <p className="font-geist text-sm leading-relaxed text-neutral-400">
                                    {feature.description}
                                </p>
                            </div>

                            {/* Decorative Gradient Blob */}
                            <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/5 blur-3xl transition-all duration-500 group-hover:bg-white/10" />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
