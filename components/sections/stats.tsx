"use client";

import { motion } from "framer-motion";

export function Stats() {
    return (
        <section className="w-full bg-background py-20 md:py-32">
            <div className="container px-4 md:px-6">
                <div className="flex flex-col gap-16 md:gap-24">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col gap-6 max-w-4xl mx-auto text-center items-center"
                    >
                        <h2 className="font-koulen text-5xl leading-[0.9] tracking-tight text-foreground md:text-[72px] md:leading-[80px]">
                            YOUR MEMORY,
                            <br />
                            FINALLY PORTABLE.
                        </h2>
                        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                            SoulPrint saves your conversations, patterns, and preferences locally — so you can move between any AI model and never lose your history.
                            <br />
                            You’re not locked in. You’re not tracked. You’re in control.
                        </p>
                    </motion.div>

                    {/* Features Grid */}
                    <div className="grid gap-12 md:grid-cols-2 md:gap-16 max-w-5xl mx-auto">
                        {/* Feature 1 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="flex flex-col gap-4 text-center items-center"
                        >
                            <h3 className="font-geist text-2xl font-bold leading-tight text-foreground md:text-[30px] md:leading-[36px]">
                                Move Across Any AI Seamlessly
                            </h3>
                            <p className="font-geist text-base text-muted-foreground md:text-lg">
                                Your SoulPrint can follow you from ChatGPT → Claude → Gemini → Perplexity without missing a beat. Switch models. Keep the same identity.
                            </p>
                        </motion.div>

                        {/* Feature 2 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="flex flex-col gap-4 text-center items-center"
                        >
                            <h3 className="font-geist text-2xl font-bold leading-tight text-foreground md:text-[30px] md:leading-[36px]">
                                Local Storage. Zero Surveillance.
                            </h3>
                            <p className="font-geist text-base text-muted-foreground md:text-lg">
                                Every conversation is saved on your device — encrypted and under your control. No cloud logging. No corporate eyes. No third-party access.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
