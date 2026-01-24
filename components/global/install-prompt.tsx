"use client";

import { useState, useEffect } from "react";
import { X, Share, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export function InstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if running in standalone mode (PWA installed)
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true;

        if (isStandalone) return;

        // Check if mobile device
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isMobile = /iphone|ipad|ipod|android/.test(userAgent);

        // Check if iOS
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIOSDevice);

        // Show prompt if mobile and not standalone, and haven't dismissed it recently
        const dismissed = localStorage.getItem("install-prompt-dismissed");
        const dismissedTime = dismissed ? parseInt(dismissed) : 0;
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        if (isMobile && (now - dismissedTime > ONE_DAY)) {
            // Small delay to not be intrusive immediately
            const timer = setTimeout(() => setShowPrompt(true), 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    const dismissPrompt = () => {
        setShowPrompt(false);
        localStorage.setItem("install-prompt-dismissed", Date.now().toString());
    };

    return (
        <AnimatePresence>
            {showPrompt && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
                >
                    <div className="bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                                <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0 p-2">
                                    <img
                                        src="/images/soulprintlogomain.png"
                                        alt="SoulPrint Logo"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <h3 className="font-host-grotesk font-semibold text-white text-sm">
                                        Make SoulPrint an App
                                    </h3>
                                    <p className="text-xs text-gray-400 leading-snug">
                                        Add to your home screen for the full full-screen experience and quick access.
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={dismissPrompt}
                                className="h-6 w-6 text-gray-500 hover:text-white hover:bg-white/10 -mt-1 -mr-1"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {isIOS ? (
                            <div className="flex flex-col gap-2 text-xs text-gray-300 bg-white/5 p-3 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2">
                                    <span>1. Tap</span>
                                    <Share className="h-4 w-4 text-[#FF4D00]" />
                                    <span>Share</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>2. Scroll down & select</span>
                                    <span className="font-semibold text-white whitespace-nowrap">Add to Home Screen</span>
                                    <PlusSquare className="h-4 w-4 text-[#FF4D00]" />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 text-xs text-gray-300 bg-white/5 p-3 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2">
                                    <span>1. Tap the menu icon</span>
                                    <span className="text-lg leading-none">⋮</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>2. Select</span>
                                    <span className="font-semibold text-white">Install App</span>
                                    <span>or</span>
                                    <span className="font-semibold text-white whitespace-nowrap">Add to Home Screen</span>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
