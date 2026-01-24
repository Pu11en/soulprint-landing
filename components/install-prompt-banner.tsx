"use client";

import { useState, useEffect } from "react";
import { X, Share, Download, Smartphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPromptBanner() {
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        // Check if already running as PWA
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as Navigator & { standalone?: boolean }).standalone === true;

        if (isStandalone) {
            return; // Already installed, don't show banner
        }

        // Check if dismissed recently (7 days)
        const dismissed = localStorage.getItem("install-prompt-dismissed");
        if (dismissed) {
            const dismissedTime = parseInt(dismissed);
            const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) {
                return; // Dismissed recently, don't show
            }
        }

        // Check if this is after first login
        const isFirstLogin = localStorage.getItem("soulprint-first-login");
        if (isFirstLogin !== "true") {
            return; // Not first login session, don't show
        }

        // Detect platform
        const userAgent = navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent) && !((window as Window & { MSStream?: unknown }).MSStream);
        setIsIOS(ios);

        // Listen for install prompt (Android/Desktop Chrome)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        // Listen for successful install
        const handleAppInstalled = () => {
            setShowBanner(false);
            setInstalling(false);
            localStorage.setItem("install-prompt-dismissed", Date.now().toString());
        };

        window.addEventListener("appinstalled", handleAppInstalled);

        // Show banner after a short delay (3 seconds) for better UX
        const timer = setTimeout(() => setShowBanner(true), 3000);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleAppInstalled);
        };
    }, []);

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem("install-prompt-dismissed", Date.now().toString());
    };

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        setInstalling(true);
        deferredPrompt.prompt();

        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
            setShowBanner(false);
            localStorage.setItem("install-prompt-dismissed", Date.now().toString());
        }

        setInstalling(false);
        setDeferredPrompt(null);
    };

    if (!showBanner) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up sm:left-auto sm:right-4 sm:max-w-sm">
            <div className="rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 p-4 shadow-2xl shadow-black/50">
                {/* Close button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-zinc-800 transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="w-4 h-4 text-zinc-400" />
                </button>

                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
                        <Smartphone className="w-6 h-6 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-semibold text-white text-sm mb-1">
                            Add to Home Screen
                        </h3>
                        <p className="text-zinc-400 text-xs leading-relaxed">
                            {isIOS
                                ? "Tap Share, then \"Add to Home Screen\" for the best experience"
                                : "Install SoulPrint for quick access and offline support"
                            }
                        </p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                    {isIOS ? (
                        // iOS - show instructions hint
                        <div className="flex items-center gap-2 text-xs text-blue-400">
                            <Share className="w-4 h-4" />
                            <span>Tap Share</span>
                            <span className="text-zinc-600">→</span>
                            <Plus className="w-4 h-4" />
                            <span>Add to Home</span>
                        </div>
                    ) : deferredPrompt ? (
                        // Android/Desktop with install prompt available
                        <Button
                            onClick={handleInstall}
                            disabled={installing}
                            size="sm"
                            className="flex-1 h-9 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white text-xs font-medium"
                        >
                            {installing ? (
                                <>
                                    <div className="animate-spin mr-2 h-3 w-3 border-2 border-white/30 border-t-white rounded-full" />
                                    Installing...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-1.5 h-3.5 w-3.5" />
                                    Install Now
                                </>
                            )}
                        </Button>
                    ) : (
                        // Fallback - generic message
                        <p className="text-xs text-zinc-500">
                            Add via your browser menu for the best experience
                        </p>
                    )}
                </div>
            </div>

            <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out forwards;
        }
      `}</style>
        </div>
    );
}
