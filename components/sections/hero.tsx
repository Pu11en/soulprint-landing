"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

export function Hero() {
    return (
        <>
            {/* Mobile Hero - Full-bleed background design */}
            <section className="lg:hidden relative flex flex-col min-h-[85dvh] w-full overflow-hidden">
                {/* Full-bleed Background Image with Zoom */}
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110 origin-center"
                    style={{ backgroundImage: "url('/images/mobile-hero-v2.png')" }}
                />

                {/* Gradient overlays for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />

                {/* Brutalist Header - Logo + Login */}
                <header className="relative flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 z-20">
                    <div className="inline-flex items-center gap-2">
                        <Image
                            src="/images/soulprintlogomain.png"
                            alt="SoulPrint Logo"
                            width={36}
                            height={36}
                            className="w-9 h-9 object-contain"
                        />
                        <span className="text-white text-3xl font-normal font-koulen leading-9 tracking-tight">SOULPRINT</span>
                    </div>
                    <Link href="https://soulprintengine.ai/signup" className="relative group overflow-hidden">
                        <span className="text-white text-sm font-bold uppercase tracking-wide group-hover:text-orange-600 transition-colors duration-300">
                            Login
                        </span>
                        <span className="absolute bottom-0 left-0 w-full h-[2px] bg-orange-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                    </Link>
                </header>

                {/* Content & CTA Container */}
                <div className="relative flex flex-1 flex-col z-10">
                    {/* Top Spacer */}
                    <div className="flex-[0.5]" />

                    {/* Headline and Subheading */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="flex flex-col items-center text-center space-y-5 px-6"
                    >
                        <h1 className="text-[2.75rem] xs:text-[3.25rem] sm:text-[4.5rem] font-koulen uppercase tracking-tight leading-[0.85] text-white drop-shadow-2xl">
                            YOUR AI
                            <br />
                            SHOULD KNOW
                            <br />
                            <span className="text-orange-600">WHO YOU ARE</span>
                        </h1>

                        <p className="text-white/80 text-base sm:text-xl font-medium leading-relaxed max-w-[300px] sm:max-w-[480px]">
                            The world&apos;s first high-fidelity digital identity platform. Capture your essence.
                        </p>
                    </motion.div>

                    {/* Spacer A - Balanced Gap */}
                    <div className="flex-1" />

                    {/* CTA Button centered in remaining space */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="px-6 w-full max-w-[600px] mx-auto"
                    >
                        <Link href="https://soulprintengine.ai/signup" className="block w-full">
                            <button className="w-full h-16 bg-orange-600 hover:bg-orange-500 active:scale-[0.98] transition-all flex items-center justify-between px-8 group shadow-2xl shadow-orange-600/20 rounded-none">
                                <span className="text-black font-black text-xl uppercase tracking-wider font-koulen">Enter SoulPrint</span>
                                <ArrowRight className="w-6 h-6 text-black group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>
                    </motion.div>

                    {/* Spacer B - Balanced Gap (Same as A) */}
                    <div className="flex-1" />
                </div>


            </section>

            {/* Desktop Hero - Full-bleed background design (matching mobile) */}
            <section className="hidden lg:flex relative flex-col min-h-[100dvh] w-full overflow-hidden">
                {/* Full-bleed Background Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: "url('/images/desktop-hero-v2.png')" }}
                />

                {/* Gradient overlays for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />

                {/* Desktop Header - Logo + Login (matching mobile style) */}
                <header className="relative flex items-center justify-between px-12 xl:px-20 pt-10 pb-4 z-20">
                    <div className="inline-flex items-center gap-3">
                        <Image
                            src="/images/soulprintlogomain.png"
                            alt="SoulPrint Logo"
                            width={48}
                            height={48}
                            className="w-12 h-12 object-contain"
                        />
                        <span className="text-white text-4xl font-normal font-koulen leading-10 tracking-tight">SOULPRINT</span>
                    </div>
                    <Link href="https://soulprintengine.ai/signup" className="relative group overflow-hidden">
                        <span className="text-white text-base font-bold uppercase tracking-wide group-hover:text-orange-600 transition-colors duration-300">
                            Login
                        </span>
                        <span className="absolute bottom-0 left-0 w-full h-[3px] bg-orange-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                    </Link>
                </header>

                {/* Content & CTA Container */}
                <div className="relative flex flex-1 flex-col z-10">
                    {/* Top Spacer */}
                    <div className="flex-[0.5]" />

                    {/* Headline and Subheading */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="flex flex-col items-center text-center space-y-6 px-12"
                    >
                        <h1 className="text-[5rem] xl:text-[6rem] 2xl:text-[7rem] font-koulen uppercase tracking-tight leading-[0.85] text-white drop-shadow-2xl">
                            YOUR AI
                            <br />
                            SHOULD KNOW
                            <br />
                            <span className="text-orange-600">WHO YOU ARE</span>
                        </h1>

                        <p className="text-white/80 text-xl xl:text-2xl font-medium leading-relaxed max-w-[700px]">
                            The world&apos;s first high-fidelity digital identity platform. Capture your essence.
                        </p>
                    </motion.div>

                    {/* Spacer A - Balanced Gap */}
                    <div className="flex-1" />

                    {/* CTA Button centered in remaining space */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="px-12 w-full max-w-[500px] mx-auto"
                    >
                        <Link href="https://soulprintengine.ai/signup" className="block w-full">
                            <button className="w-full h-16 bg-orange-600 hover:bg-orange-500 active:scale-[0.98] transition-all flex items-center justify-between px-8 group shadow-2xl shadow-orange-600/20 rounded-none">
                                <span className="text-black font-black text-xl uppercase tracking-wider font-koulen">Enter SoulPrint</span>
                                <ArrowRight className="w-6 h-6 text-black group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>
                    </motion.div>

                    {/* Spacer B - Balanced Gap */}
                    <div className="flex-1" />
                </div>
            </section>
        </>
    );
}
