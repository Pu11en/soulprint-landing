"use client";

import { motion } from "framer-motion";

export function MemorySection() {
    return (
        <section className="flex w-full justify-center bg-black py-24 text-white">
            <div className="flex w-full max-w-[1400px] flex-col items-start justify-start gap-16 px-6 md:px-12 lg:flex-row lg:px-12 xl:px-24">
                {/* Left Column - Main Heading */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-1 flex-col items-start justify-start gap-5"
                >
                    <h2 className="font-koulen text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.9] uppercase text-white">
                        Your Memory,
                        <br />
                        Finally Portable.
                    </h2>
                    <p className="max-w-md font-sans text-base leading-relaxed text-neutral-400">
                        SoulPrint saves your conversations, patterns, and preferences locally — so you can move between any AI model and never lose your history.
                        <br className="hidden md:block" />
                        <br className="hidden md:block" />
                        You’re not locked in. You’re not tracked. You’re in control.
                    </p>
                </motion.div>

                {/* Right Column - Feature Grid */}
                <div className="flex flex-1 flex-col items-start justify-start gap-12">
                    {/* Row 1 */}
                    <div className="flex flex-col gap-12 md:flex-row md:gap-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="flex flex-1 flex-col items-start justify-start gap-3"
                        >
                            <h3 className="font-geist text-xl sm:text-2xl md:text-3xl font-bold leading-tight text-white">
                                Independent Presence, Anywhere Intelligence Exists
                            </h3>
                            <p className="font-geist text-base leading-relaxed text-neutral-400">
                                Your identity isn&apos;t locked to a platform. It travels with you.
                            </p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="flex flex-1 flex-col items-start justify-start gap-3"
                        >
                            <h3 className="font-geist text-xl sm:text-2xl md:text-3xl font-bold leading-tight text-white">
                                Local Identity. Zero Surveillance.
                            </h3>
                            <p className="font-geist text-base leading-relaxed text-neutral-400">
                                Your data stays yours. No tracking, no selling, just pure utility.
                            </p>
                        </motion.div>
                    </div>

                    {/* Row 2 */}
                    <div className="flex flex-col gap-12 md:flex-row md:gap-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="flex flex-1 flex-col items-start justify-start gap-3"
                        >
                            <h3 className="font-geist text-xl sm:text-2xl md:text-3xl font-bold leading-tight text-white">
                                Your Cadence. Your Tone. Your Patterns.
                            </h3>
                            <p className="font-geist text-base leading-relaxed text-neutral-400">
                                The subtle details that make you, you—preserved and projected perfectly.
                            </p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.5 }}
                            className="flex flex-1 flex-col items-start justify-start gap-3"
                        >
                            <h3 className="font-geist text-xl sm:text-2xl md:text-3xl font-bold leading-tight text-white">
                                Never Rebuild Yourself Again
                            </h3>
                            <p className="font-geist text-base leading-relaxed text-neutral-400">
                                Switch tools without losing your history or your voice.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
