"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
// import { SignUpModal } from "@/components/auth/signup-modal"; // Temporarily disabled for waitlist
import Link from "next/link";

export default function BreakpointDesktop() {
  return (
    <section className="flex w-full items-center justify-center bg-white py-24">
      <div className="flex w-full max-w-[1400px] items-center justify-center px-6 md:px-12 lg:px-12 xl:px-24">
        <div className="grid w-full grid-cols-1 gap-8 rounded-2xl bg-neutral-950 p-8 md:p-12 lg:grid-cols-2 lg:gap-16 lg:p-16">
          {/* Left Content */}
          <div className="flex flex-col items-start justify-center gap-6 lg:gap-8">
            <h2 className="font-koulen text-4xl uppercase leading-tight text-orange-600 sm:text-5xl md:text-6xl lg:text-[64px] xl:text-[72px]">
              MAKE EVERY AI YOU
              <br />
              USE ACTUALLY
              <br />
              YOURS.
            </h2>

            <Link href="/enter">
              <Button className="inline-flex h-auto items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-neutral-900 transition-colors hover:bg-neutral-100">
                <span className="font-geist text-sm font-semibold">
                  Enter SoulPrint
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Right Image */}
          <div className="relative flex min-h-[250px] w-full items-center justify-center lg:min-h-[350px]">
            <div className="relative h-full w-full max-w-[500px]">
              <Image
                src="/images/vector-personalized.png"
                alt="SoulPrint Logo"
                width={500}
                height={400}
                className="h-auto w-full object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
