"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";

export function Hero() {
    return (
        <section className="relative flex w-full flex-col items-center justify-start bg-[#0A0A0A] min-h-[calc(100svh-72px)] pt-10 pb-12 sm:pt-14 sm:pb-16 sm:justify-center lg:bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] lg:from-neutral-900/50 lg:via-black lg:to-black">
            <div className="flex w-full max-w-[1400px] flex-col items-center justify-center gap-8 px-5 sm:gap-10 sm:px-6 md:px-12 lg:flex-row lg:gap-16 xl:px-24">

                {/* Content Container */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex w-full max-w-[672px] flex-col items-start justify-center gap-6 lg:max-w-none lg:flex-1"
                >



                    {/* Headline */}
                    <h1 className="w-full font-koulen text-[44px] leading-[0.95] text-white uppercase tracking-tighter sm:text-[56px] lg:text-[clamp(56px,6vw,100px)] lg:leading-[0.9]">
                        Your AI should know
                        <br />
                        <span className="bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent">
                            who you are.
                        </span>
                        <br />
                        <span className="text-[#EA580C]">SoulPrint</span> makes it permanent.
                    </h1>

                    {/* Subheading */}
                    <div className="flex w-full flex-col gap-4 lg:mt-4">
                        <p className="font-geist text-base font-semibold tracking-wide text-white/90 sm:text-lg lg:text-xl">
                            Persistent identity • Model-agnostic • Private memory
                        </p>
                        <p className="max-w-2xl font-inter text-base leading-relaxed text-neutral-400 sm:text-lg sm:leading-7">
                            SoulPrint reads how you speak, how you think, and how you decide, and turns it into a persistent identity that no model can erase.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:mt-6 lg:gap-4">
                        <Link href="/enter">
                            <Button className="h-11 w-full rounded-lg bg-[#EA580C] px-5 py-3 font-geist text-base font-medium text-[#FAFAFA] transition-all hover:bg-[#EA580C]/90 hover:scale-[1.02] active:scale-[0.98] sm:w-auto lg:h-14 lg:px-10 lg:text-lg">
                                Enter SoulPrint
                            </Button>
                        </Link>
                    </div>
                </motion.div>

                {/* Image/Visual Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="relative flex h-[220px] w-full max-w-[260px] flex-col items-start justify-center sm:h-[280px] sm:max-w-[320px] lg:h-auto lg:max-w-[500px] lg:flex-1 xl:max-w-[600px]"
                >
                    {/* Mobile Background for Image - Hidden on Desktop */}
                    <div className="absolute inset-0 bg-[url('/images/hero-badge.png')] bg-contain bg-center bg-no-repeat opacity-50 mix-blend-screen lg:hidden" />

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/images/hero-badge.png"
                        alt="SoulPrint Badge"
                        className="relative z-10 h-full w-full object-contain"
                    />
                </motion.div>
            </div>
        </section>
    );
}
