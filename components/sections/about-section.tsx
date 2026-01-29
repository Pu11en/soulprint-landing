"use client";

import { motion } from "framer-motion";

export function AboutSection() {
    return (
        <section id="about" className="relative w-full bg-black py-32 text-white overflow-hidden">

            {/* Background Gradient */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-neutral-900/30 via-black to-black pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-[1000px] px-6 md:px-12 lg:px-24 flex flex-col gap-16">

                {/* Intro */}
                <div className="flex flex-col gap-6">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="font-koulen text-5xl md:text-7xl uppercase leading-[0.9] text-white"
                    >
                        We didn’t set out to build a better AI.
                        <br />
                        <span className="text-neutral-500">We set out to build a better memory.</span>
                    </motion.h2>
                </div>

                {/* Narrative */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 font-geist text-lg text-neutral-400 leading-relaxed">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        viewport={{ once: true }}
                    >
                        <p className="mb-6">
                            Every major system resets. Every prompt is a blank slate. Every AI forgets who you are — on purpose. We believe that’s not a limitation. That’s a design failure.
                        </p>
                        <p className="text-white font-medium">
                            SoulPrint is our answer. ArcheForge is the system behind it.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        viewport={{ once: true }}
                    >
                        <p className="mb-6">
                            We built our own engine — not a wrapper, not a plugin, not a skin over someone else&apos;s model. ArcheForge is a full-stack intelligence architecture designed from the ground up to support emotional cadence, persistent memory, and behavioral realism.
                        </p>
                        <p>
                            SoulPrint doesn&apos;t simulate tone. It captures cadence. It preserves who you are, across time, across tools, across every interaction.
                        </p>
                    </motion.div>
                </div>

                {/* Conclusion / Signature */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    viewport={{ once: true }}
                    className="border-l-2 border-[#EA580C] pl-6 mt-8"
                >
                    <h3 className="font-koulen text-3xl text-white uppercase mb-2">We are ArcheForge.</h3>
                    <p className="font-geist text-neutral-400 max-w-xl">
                        We&apos;re not selling chatbot wrappers. We&apos;re building the foundation for real AI continuity — one that moves with you, adapts to you, and remembers you.
                    </p>
                </motion.div>

            </div>
        </section>
    );
}
