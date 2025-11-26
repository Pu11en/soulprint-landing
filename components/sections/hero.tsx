"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Image from "next/image";
import { SignUpModal } from "@/components/auth/signup-modal";

export function Hero() {
    return (
        <section className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#0A0A0A] py-16 lg:min-h-[60vh] lg:bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] lg:from-neutral-900/50 lg:via-black lg:to-black lg:py-[clamp(60px,8vh,120px)]">
            <div className="flex w-full max-w-[1400px] flex-col items-center justify-center gap-12 px-6 md:px-12 lg:flex-row lg:gap-20 xl:px-24">

                {/* Content Container */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex w-full max-w-[672px] flex-col items-start justify-center gap-6 lg:max-w-none lg:flex-1"
                >

                    {/* Mobile Tagline - Hidden on Desktop */}
                    <div className="flex items-center gap-1 lg:hidden">
                        <span className="font-geist text-sm font-medium leading-5 text-[#737373]">
                            SOULPRINT
                        </span>
                    </div>

                    {/* Headline */}
                    <h1 className="w-full font-koulen text-[72px] leading-[80px] text-white uppercase tracking-tight lg:text-[clamp(40px,4vw,110px)] lg:leading-[0.9]">
                        STOP USING AI
                        <br />
                        IN DEFAULT MODE
                    </h1>

                    {/* Subheading */}
                    <p className="w-full font-inter text-lg leading-7 text-[#737373] lg:mt-6 lg:max-w-xl lg:text-gray-400 lg:leading-relaxed xl:text-xl">
                        <span className="lg:hidden">Default mode is dead. Discover your unique digital soulprint and break free from the generic.</span>
                        <span className="hidden lg:inline">Default mode is dead.</span>
                    </p>

                    {/* Actions */}
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:mt-8 lg:gap-4">
                        <SignUpModal>
                            <Button
                                className="h-9 w-full rounded-lg bg-[#EA580C] px-4 py-2 font-geist text-sm font-medium text-[#FAFAFA] hover:bg-[#EA580C]/90 sm:w-auto lg:h-auto lg:px-8 lg:py-3 lg:text-base"
                            >
                                Break the Mold
                            </Button>
                        </SignUpModal>
                    </div>
                </motion.div>

                {/* Image/Visual Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="relative flex h-[312px] w-full max-w-[312px] flex-col items-start justify-center lg:h-auto lg:max-w-[500px] lg:flex-1 xl:max-w-[600px]"
                >
                    {/* Mobile Background for Image - Hidden on Desktop */}
                    <div className="absolute inset-0 bg-[url('/images/hero-badge.png')] bg-contain bg-center bg-no-repeat opacity-50 mix-blend-screen lg:hidden" />

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
