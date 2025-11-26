import { Button } from "@/components/ui/button"
import { SignUpModal } from "@/components/auth/signup-modal"

export function CTA() {
  return (
    <section className="py-24 bg-primary text-primary-foreground">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Ready to Discover Your SoulPrint?
            </h2>
            <p className="mx-auto max-w-[700px] text-primary-foreground/80 md:text-xl">
              Join thousands of others who have already started their journey.
            </p>
          </div>
          <SignUpModal>
            <Button variant="secondary" size="lg">
              Get Started Now
            </Button>
          </SignUpModal>
        </div>
      </div>
    </section>
  )
}
