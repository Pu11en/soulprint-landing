import { Navbar } from "@/components/sections/navbar"
import { Hero } from "@/components/sections/hero"
import RuixenBentoCards from "@/components/ui/ruixen-bento-cards"
import { FeatureBlogSection } from "@/components/sections/feature-blog-section"
import { MemorySection } from "@/components/sections/memory-section"
import { FaqSection } from "@/components/sections/faq-section"
import { AboutSection } from "@/components/sections/about-section"
import BreakpointDesktop from "@/components/BreakpointDesktop"
import { Footer } from "@/components/sections/footer"

export default async function Home() {
  // Optional dev auto-login (guarded to avoid refresh loops)
  if (process.env.NODE_ENV === "development" && process.env.ENABLE_DEV_LOGIN === "true") {
    // Dynamically import to avoid bundling server action in client boundary if this were client (it's server though)
    const { devLogin } = await import("@/app/actions/dev-login");
    await devLogin();
  }

  return (
    <main className="min-h-screen">
      <Navbar />
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
