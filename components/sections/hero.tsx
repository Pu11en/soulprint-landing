"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { AuthModal } from "@/components/auth-modal";
import { AccessCodeModal } from "@/components/access-code-modal";

export function Hero() {
    const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'signup' }>({ open: false, mode: 'login' });
    const [accessCodeModal, setAccessCodeModal] = useState(false);
    const [hasValidCode, setHasValidCode] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('hasValidCode') === 'true';
    });

    // Handle CTA click - check if user has valid code
    const handleEnterClick = () => {
        if (hasValidCode) {
            // Already has valid code - go straight to auth
            setAuthModal({ open: true, mode: 'signup' });
        } else {
            // Need to enter access code first
            setAccessCodeModal(true);
        }
    };

    // Handle login click - always show auth modal (for existing users)
    const handleLoginClick = () => {
        setAuthModal({ open: true, mode: 'login' });
    };

    // Called when valid access code is entered
    const handleCodeValid = () => {
        setHasValidCode(true);
        setAccessCodeModal(false);
        // Show auth modal after short delay for smooth transition
        setTimeout(() => {
            setAuthModal({ open: true, mode: 'signup' });
        }, 100);
    };

    return (
        <>
            {/* Mobile Hero - FULL viewport, no bleed */}
            <section className="lg:hidden relative flex flex-col h-[100dvh] w-full overflow-hidden bg-black">
                {/* Background Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
                    style={{ backgroundImage: "url('/images/mobile-hero-v2.png')" }}
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />

                {/* Header */}
                <header className="relative flex items-center justify-between px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-4 z-20">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/images/soulprintlogomain.png"
                            alt="SoulPrint"
                            width={32}
                            height={32}
                            className="w-8 h-8 object-contain"
                        />
                        <span className="text-white text-2xl font-koulen tracking-tight">SOULPRINT</span>
                    </div>
                    <button 
                        onClick={handleLoginClick}
                        className="text-white text-sm font-semibold uppercase tracking-wide hover:text-orange-500 transition-colors"
                    >
                        Login
                    </button>
                </header>

                {/* Centered Content */}
                <div className="relative flex-1 flex flex-col items-center justify-center px-6 z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center space-y-6 max-w-lg"
                    >
                        <h1 className="text-4xl sm:text-5xl font-koulen uppercase tracking-tight leading-[0.9] text-white">
                            YOUR AI<br />
                            SHOULD KNOW<br />
                            <span className="text-orange-500">WHO YOU ARE</span>
                        </h1>

                        <p className="text-white/70 text-base sm:text-lg leading-relaxed max-w-sm mx-auto">
                            The world&apos;s first high-fidelity digital identity platform. Capture your essence.
                        </p>

                        <button 
                            onClick={handleEnterClick}
                            className="w-full max-w-xs mx-auto h-14 bg-orange-500 hover:bg-orange-400 active:scale-[0.98] transition-all flex items-center justify-center gap-3 rounded-lg shadow-lg shadow-orange-500/25"
                        >
                            <span className="text-black font-bold text-lg uppercase tracking-wide">Enter SoulPrint</span>
                            <ArrowRight className="w-5 h-5 text-black" />
                        </button>
                    </motion.div>
                </div>

                {/* Bottom safe area */}
                <div className="h-[max(2rem,env(safe-area-inset-bottom))]" />
            </section>

            {/* Desktop Hero */}
            <section className="hidden lg:flex relative flex-col min-h-screen w-full overflow-hidden bg-black">
                {/* Background Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
                    style={{ backgroundImage: "url('/images/desktop-hero-v2.png')" }}
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />

                {/* Header */}
                <header className="relative flex items-center justify-between px-16 xl:px-24 py-8 z-20">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/images/soulprintlogomain.png"
                            alt="SoulPrint"
                            width={44}
                            height={44}
                            className="w-11 h-11 object-contain"
                        />
                        <span className="text-white text-3xl font-koulen tracking-tight">SOULPRINT</span>
                    </div>
                    <button 
                        onClick={handleLoginClick}
                        className="text-white text-sm font-semibold uppercase tracking-wide hover:text-orange-500 transition-colors"
                    >
                        Login
                    </button>
                </header>

                {/* Centered Content */}
                <div className="relative flex-1 flex flex-col items-center justify-center px-8 z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center space-y-8"
                    >
                        <h1 className="text-6xl xl:text-7xl 2xl:text-8xl font-koulen uppercase tracking-tight leading-[0.9] text-white">
                            YOUR AI<br />
                            SHOULD KNOW<br />
                            <span className="text-orange-500">WHO YOU ARE</span>
                        </h1>

                        <p className="text-white/70 text-xl xl:text-2xl leading-relaxed max-w-2xl mx-auto">
                            The world&apos;s first high-fidelity digital identity platform. Capture your essence.
                        </p>

                        <button 
                            onClick={handleEnterClick}
                            className="mx-auto h-16 px-12 bg-orange-500 hover:bg-orange-400 active:scale-[0.98] transition-all flex items-center justify-center gap-4 rounded-lg shadow-lg shadow-orange-500/25"
                        >
                            <span className="text-black font-bold text-xl uppercase tracking-wide">Enter SoulPrint</span>
                            <ArrowRight className="w-6 h-6 text-black" />
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* Access Code Modal - shown first if no valid code */}
            <AccessCodeModal 
                isOpen={accessCodeModal}
                onClose={() => setAccessCodeModal(false)}
                onCodeValid={handleCodeValid}
            />

            {/* Auth Modal - shown after valid code or for login */}
            <AuthModal 
                isOpen={authModal.open} 
                onClose={() => setAuthModal({ ...authModal, open: false })}
                defaultMode={authModal.mode}
            />
        </>
    );
}
