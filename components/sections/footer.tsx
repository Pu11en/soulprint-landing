import Link from "next/link";
import { Instagram, Twitter, Linkedin, Youtube } from "lucide-react";
import Image from "next/image";

export function Footer() {
    return (
        <footer className="w-full bg-[#0A0A0A] py-12 md:py-16 border-t border-white/10">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-6 md:px-12 xl:px-24">

                {/* Top Section */}
                <div className="flex flex-col items-center justify-between gap-8 md:flex-row">

                    {/* Logo */}
                    <Link href="/" className="flex items-center">
                        <Image
                            src="/images/SoulPrintEngine-title-logo.png"
                            alt="SoulPrint"
                            width={157}
                            height={57}
                            className="h-10 w-auto object-contain"
                        />
                    </Link>

                    {/* Desktop Enterprise CTA - Removed per user request */}

                    {/* Social Icons */}
                    <div className="flex items-center gap-6 md:gap-4 order-2">
                        {/* Using social icons based on standard set, as dump didn't specify exact platforms beyond generics */}
                        <SocialLink href="#" icon={<Twitter className="h-5 w-5" />} />
                        <SocialLink href="#" icon={<Instagram className="h-5 w-5" />} />
                        <SocialLink href="#" icon={<Linkedin className="h-5 w-5" />} />
                        <SocialLink href="#" icon={<Youtube className="h-5 w-5" />} />
                    </div>
                </div>

                {/* Mobile Enterprise CTA - Removed per user request */}


                {/* Separator */}
                <div className="h-px w-full bg-[#737373]/30" />

                {/* Bottom Section */}
                <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                    {/* Links */}
                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 order-2 md:order-1">
                        <FooterLink href="#">Privacy Policy</FooterLink>
                        <FooterLink href="#">Terms of Service</FooterLink>
                        <FooterLink href="#">Cookies Settings</FooterLink>
                    </div>

                    {/* Copyright */}
                    <p className="font-geist text-sm font-normal text-[#737373] order-3 md:order-2 text-center md:text-left">
                        Copyright 2026 © soulprintengine.ai
                    </p>
                </div>
            </div>
        </footer>
    );
}

function SocialLink({ href, icon }: { href: string; icon: React.ReactNode }) {
    return (
        <Link href={href} className="text-[#737373] hover:text-white transition-colors p-2 md:p-0">
            {icon}
        </Link>
    );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="font-geist text-sm font-normal text-[#737373] hover:text-white transition-colors">
            {children}
        </Link>
    );
}
