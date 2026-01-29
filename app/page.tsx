'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hero } from "@/components/sections/hero"
import RuixenBentoCards from "@/components/ui/ruixen-bento-cards"
import { FeatureBlogSection } from "@/components/sections/feature-blog-section"
import { MemorySection } from "@/components/sections/memory-section"
import { FaqSection } from "@/components/sections/faq-section"
import { AboutSection } from "@/components/sections/about-section"
import BreakpointDesktop from "@/components/BreakpointDesktop"
import { Footer } from "@/components/sections/footer"

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Redirect logged-in users to chat
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/memory/status');
        const data = await res.json();
        // If user has any status other than 'none', they're logged in
        if (data.status && data.status !== 'none') {
          router.push('/chat');
          return;
        }
      } catch {
        // Not logged in, show landing
      }
      setChecking(false);
    };
    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Hero />
      <RuixenBentoCards />
      <FeatureBlogSection />
      <MemorySection />
      <AboutSection />
      <BreakpointDesktop />
      <FaqSection />
      <Footer />
    </main>
  )
}
