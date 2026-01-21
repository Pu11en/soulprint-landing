"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Loader2, ArrowRight, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Set to false to disable access code gate (for development)
const REQUIRE_ACCESS_CODE = process.env.NODE_ENV === "production";
const ACCESS_CODE = "!Arche!";

type Mode = "access" | "waitlist" | "success";

export default function EnterPage() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>("access");
    const [code, setCode] = useState("");
    const [codeError, setCodeError] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    
    // Waitlist form state
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [ndaOptIn, setNdaOptIn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Check if user is already authenticated and redirect to dashboard
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                
                if (user) {
                    // User is already logged in, redirect to dashboard
                    router.replace("/dashboard/chat");
                    return;
                }
            } catch (err) {
                console.error("Auth check error:", err);
            }
            setCheckingAuth(false);
        };

        checkAuth();
    }, [router]);

    // If access code is not required, redirect straight to signup
    if (!REQUIRE_ACCESS_CODE) {
        router.replace("/signup");
        return null;
    }

    // Show loading while checking auth
    if (checkingAuth) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A]">
                <Loader2 className="h-8 w-8 animate-spin text-[#EA580C]" />
            </div>
        );
    }

    const handleCodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (code === ACCESS_CODE) {
            router.push("/signup");
        } else {
            setCodeError(true);
            setCode("");
        }
    };

    const handleWaitlistSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!ndaOptIn) {
            setError("Please agree to the NDA to continue");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/waitlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, ndaOptIn }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to join waitlist");
            }

            setMode("success");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row w-full h-full min-h-screen bg-[#0A0A0A]">
            {/* Left Side - Image */}
            <div className="relative hidden lg:flex lg:w-1/2 bg-black">
                <Image
                    src="/images/Soulprintengine-logo.png"
                    alt="SoulPrint Engine"
                    fill
                    className="object-cover opacity-80"
                    priority
                />
            </div>

            {/* Right Side - Content */}
            <div className="flex flex-1 flex-col justify-center items-center px-6 py-12 sm:px-12 lg:p-[32px] relative w-full overflow-y-auto">
                {/* Mobile Logo */}
                <div className="lg:hidden mb-8 flex justify-center">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-lg border-2 border-[#EA580C]/20">
                        <Image
                            src="/images/Soulprintengine-logo.png"
                            alt="Logo"
                            fill
                            className="object-cover"
                        />
                    </div>
                </div>

                {/* Back to Home */}
                <div className="absolute top-6 left-4 sm:top-8 sm:left-8">
                    <Link href="/">
                        <Button variant="ghost" className="text-zinc-400 hover:text-white font-medium text-sm hover:bg-white/5 flex gap-2 pl-2 pr-4">
                            <span className="text-lg">←</span> Back
                        </Button>
                    </Link>
                </div>

                {/* Access Code Mode */}
                {mode === "access" && (
                    <div className="w-full max-w-[400px] flex flex-col gap-8">
                        {/* Header */}
                        <div className="flex flex-col gap-3 text-center">
                            <h1 className="font-koulen text-4xl sm:text-5xl text-white tracking-tight">
                                SOULPRINT
                            </h1>
                            <p className="font-inter text-base text-zinc-400">
                                Enter your access code to continue
                            </p>
                        </div>

                        {/* Access Code Form */}
                        <form onSubmit={handleCodeSubmit} className="flex flex-col gap-6">
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="Access Code"
                                    value={code}
                                    onChange={(e) => {
                                        setCode(e.target.value);
                                        setCodeError(false);
                                    }}
                                    className="w-full h-14 px-4 bg-zinc-900/50 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C] transition-all font-mono text-lg tracking-widest text-center"
                                    autoFocus
                                />
                                {codeError && (
                                    <p className="text-sm font-medium text-red-500 text-center animate-in fade-in slide-in-from-top-1">
                                        Access Denied: Incorrect Code
                                    </p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 bg-[#EA580C] hover:bg-[#EA580C]/90 text-white font-medium rounded-xl shadow-[0px_0px_20px_rgba(234,88,12,0.3)] hover:shadow-[0px_0px_30px_rgba(234,88,12,0.5)] transition-all"
                            >
                                Unlock Access <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </form>

                        {/* Divider */}
                        <div className="relative flex items-center justify-center w-full">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-zinc-800" />
                            </div>
                            <div className="relative bg-[#0A0A0A] px-4 text-xs uppercase text-zinc-500 font-medium tracking-wider">
                                or
                            </div>
                        </div>

                        {/* Waitlist CTA */}
                        <button
                            type="button"
                            onClick={() => setMode("waitlist")}
                            className="w-full h-12 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <Mail className="h-4 w-4" />
                            Join the Waitlist
                        </button>
                    </div>
                )}

                {/* Waitlist Mode */}
                {mode === "waitlist" && (
                    <div className="w-full max-w-[400px] flex flex-col gap-8">
                        {/* Header */}
                        <div className="flex flex-col gap-3 text-center">
                            <h1 className="font-koulen text-4xl text-white tracking-tight">
                                JOIN THE WAITLIST
                            </h1>
                            <p className="font-inter text-base text-zinc-400">
                                Be the first to know when SoulPrint opens to the public
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-4 text-sm font-medium text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                                {error}
                            </div>
                        )}

                        {/* Waitlist Form */}
                        <form onSubmit={handleWaitlistSubmit} className="flex flex-col gap-4">
                            <input
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C] transition-all"
                            />
                            <input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C] transition-all"
                            />

                            {/* NDA Opt-in Checkbox */}
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={ndaOptIn}
                                        onChange={(e) => setNdaOptIn(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
                                        ndaOptIn 
                                            ? "bg-[#EA580C] border-[#EA580C]" 
                                            : "border-zinc-600 group-hover:border-zinc-400"
                                    }`}>
                                        {ndaOptIn && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                <span className="text-sm text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                                    I agree to the <a href="/legal/terms" target="_blank" className="text-[#EA580C] hover:underline">NDA and Terms</a> and understand that SoulPrint is in beta.
                                </span>
                            </label>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-[#EA580C] hover:bg-[#EA580C]/90 text-white font-medium rounded-xl shadow-[0px_0px_20px_rgba(234,88,12,0.3)] hover:shadow-[0px_0px_30px_rgba(234,88,12,0.5)] transition-all disabled:opacity-70"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    "Join Waitlist"
                                )}
                            </Button>
                        </form>

                        {/* Back to access code */}
                        <button
                            type="button"
                            onClick={() => setMode("access")}
                            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                            ← Have an access code?
                        </button>
                    </div>
                )}

                {/* Success Mode */}
                {mode === "success" && (
                    <div className="w-full max-w-[400px] flex flex-col gap-8 items-center text-center">
                        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div className="flex flex-col gap-3">
                            <h1 className="font-koulen text-3xl text-white tracking-tight">
                                YOU&apos;RE ON THE LIST!
                            </h1>
                            <p className="font-inter text-base text-zinc-400">
                                We&apos;ll send you an email when it&apos;s your turn to create your SoulPrint.
                            </p>
                        </div>
                        <Link href="/">
                            <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-white/5">
                                Back to Home
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
