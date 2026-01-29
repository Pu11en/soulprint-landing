'use client';

import { useState, useEffect } from 'react';
import { X, Share, Plus } from 'lucide-react';

interface AddToHomeScreenProps {
  /** Only show after this becomes true (e.g., after first AI response) */
  canShow?: boolean;
}

const STORAGE_KEY = 'soulprint-a2hs-dismissed';

export function AddToHomeScreen({ canShow = true }: AddToHomeScreenProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    // Check if already dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    // Check if already running as PWA (standalone mode)
    const isStandalone = 
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    // Detect iOS Safari specifically
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    
    if (isIOS && isSafari) {
      setIsIOSSafari(true);
    }
  }, []);

  // Show prompt when conditions are met
  useEffect(() => {
    if (isIOSSafari && canShow) {
      // Small delay for better UX (don't show immediately)
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isIOSSafari, canShow]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300"
      role="dialog"
      aria-labelledby="a2hs-title"
    >
      <div className="bg-[#1C1C1E] border border-[#3A3A3C] rounded-2xl p-4 shadow-2xl max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 id="a2hs-title" className="text-white font-semibold text-[15px]">
                Add SoulPrint to Home Screen
              </h3>
              <p className="text-[#8E8E93] text-[13px]">
                Quick access, full-screen experience
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[#8E8E93] hover:text-white transition-colors p-1 -mt-1 -mr-1"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-[#2C2C2E] rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#3A3A3C] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-orange-500 text-sm font-bold">1</span>
            </div>
            <div className="flex items-center gap-2 text-[14px] text-white">
              <span>Tap the</span>
              <span className="inline-flex items-center gap-1 bg-[#3A3A3C] px-2 py-1 rounded-md">
                <Share className="w-4 h-4 text-[#0A84FF]" />
                <span className="text-[#0A84FF] text-[13px]">Share</span>
              </span>
              <span>button</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#3A3A3C] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-orange-500 text-sm font-bold">2</span>
            </div>
            <div className="flex items-center gap-2 text-[14px] text-white">
              <span>Scroll & tap</span>
              <span className="inline-flex items-center gap-1 bg-[#3A3A3C] px-2 py-1 rounded-md">
                <Plus className="w-4 h-4 text-white" />
                <span className="text-white text-[13px]">Add to Home Screen</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dismiss link */}
        <button
          onClick={handleDismiss}
          className="w-full text-center text-[#8E8E93] text-[13px] mt-3 py-1 hover:text-white transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
