'use client';

import { useEffect } from "react";
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

  // Check if user is already authenticated, redirect to chat
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/chat');
      }
    };
    checkAuth();
  }, [router]);

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
