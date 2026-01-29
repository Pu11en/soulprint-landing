'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Hero } from "@/components/sections/hero";
import RuixenBentoCards from "@/components/ui/ruixen-bento-cards";
import { FeatureBlogSection } from "@/components/sections/feature-blog-section";
import { MemorySection } from "@/components/sections/memory-section";
import { FaqSection } from "@/components/sections/faq-section";
import { AboutSection } from "@/components/sections/about-section";
import BreakpointDesktop from "@/components/BreakpointDesktop";
import { Footer } from "@/components/sections/footer";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Check if user is already authenticated, redirect to dashboard
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
        return;
      }
      setChecking(false);
    };
    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
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
  );
}
