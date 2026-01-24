"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play, Zap, Shield, Home, Cpu, Radio, User } from "lucide-react";

export function Hero() {
    return (
        <>
            {/* Mobile Hero - Full-bleed background design */}
            <section className="lg:hidden relative flex flex-col min-h-[100dvh] w-full overflow-hidden">
                {/* Full-bleed Background Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: "url('/images/hero-bg-mobile.png')" }}
                />

                {/* Gradient overlays for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />

                {/* Brutalist Header - Logo + Login */}
                <header className="relative flex items-center justify-between px-6 pt-8 pb-4 z-20">
                    <div className="inline-flex items-center gap-2">
                        <img
                            src="/images/soulprintlogomain.png"
                            alt="SoulPrint Logo"
                            className="w-8 h-8 object-contain"
                        />
                        <span className="text-white text-3xl font-normal font-koulen leading-9 tracking-tight">SOULPRINT</span>
                    </div>
                    <Link href="/enter" className="text-white text-sm font-bold uppercase tracking-wide hover:text-[#FF4D00] transition-colors">
                        Login
                    </Link>
                </header>

                {/* Content - headline at top */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="relative flex flex-col items-center text-center space-y-4 px-6 z-10 flex-1 justify-center"
                >
                    {/* Headline */}
                    <h1 className="text-[2.25rem] xs:text-[2.5rem] sm:text-[3rem] md:text-[5rem] font-black uppercase tracking-[-0.03em] leading-[0.9] text-white drop-shadow-2xl">
                        YOUR AI
                        <br />
                        SHOULD KNOW
                        <br />
                        <span className="text-[#FF4D00]">WHO YOU ARE</span>
                    </h1>

                    {/* Subheading */}
                    <p className="text-white/80 text-sm sm:text-lg md:text-xl font-medium leading-relaxed max-w-[320px] sm:max-w-[480px] md:max-w-[600px]">
                        The world's first high-fidelity digital identity platform. Capture your essence forever.
                    </p>
                </motion.div>



                {/* CTA Button */}
                <div className="relative px-6 pb-12 z-10">
                    <Link href="/enter" className="block w-full">
                        <button className="w-full h-14 md:h-16 bg-[#FF4D00] hover:bg-[#FF6A29] active:scale-[0.98] transition-all flex items-center justify-between px-6 group">
                            <span className="text-black font-black text-base md:text-xl uppercase tracking-tight">Enter SoulPrint</span>
                            <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-black group-hover:translate-x-1 transition-transform" />
                        </button>
                    </Link>
                </div>


            </section>

            {/* Desktop Hero - Original design preserved */}
            <section className="hidden lg:flex relative w-full flex-col items-center justify-start bg-[#0A0A0A] min-h-[calc(100svh-72px)] pt-10 pb-12 sm:pt-14 sm:pb-16 lg:justify-center lg:bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] lg:from-neutral-900/50 lg:via-black lg:to-black">
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
        </>
    );
}
