"use client";

import { Button } from "@/components/ui/button";
import { signIn, signInWithGoogle } from "@/app/actions/auth";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    // Check if user is already authenticated and redirect to dashboard
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    router.replace("/chat");
                    return;
                }
            } catch (err) {
                console.error("Auth check error:", err);
            }
            setCheckingAuth(false);
        };

        checkAuth();
    }, [router]);

    // Show loading while checking auth
    if (checkingAuth) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-[#EA580C]" />
            </div>
        );
    }

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData();
        formData.append("email", email);
        formData.append("password", password);

        try {
            const result = await signIn(formData);

            if (result?.error) {
                setError(result.error);
                setLoading(false);
            }
        } catch {
            // Server action may have redirected
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        const result = await signInWithGoogle();
        if (result?.error) {
            setError(result.error);
            setLoading(false);
        }
    };

    return (

        <div className="flex flex-col lg:flex-row w-full h-full min-h-screen bg-[#0a0a0a] text-white">
            {/* Left Side - Image (Hidden on mobile, visible on lg) */}
            <div className="relative hidden lg:flex lg:w-1/2 bg-[#000000]">
                <Image
                    src="/images/Soulprintengine-logo.png"
                    alt="SoulPrint Engine"
                    fill
                    className="object-cover opacity-60"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a0a0a]" />
            </div>

            {/* Right Side - Form */}
            <div className="flex flex-1 flex-col lg:justify-center items-center px-6 py-12 sm:px-12 lg:p-[32px] relative w-full overflow-y-auto">
                {/* Mobile Logo (Visible only on small screens) */}
                <div className="lg:hidden mb-12 flex justify-center">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(232,99,43,0.2)] border border-[#EA580C]/30">
                        <Image
                            src="/images/Soulprintengine-logo.png"
                            alt="Logo"
                            fill
                            className="object-cover"
                        />
                    </div>
                </div>

                {/* Top Left Home Button */}
                <div className="absolute top-6 left-4 sm:top-8 sm:left-8">
                    <Link href="/">
                        <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5 font-host-grotesk font-medium text-sm flex gap-2 pl-2 pr-4 transition-colors">
                            <span className="text-lg">←</span> Back to Home
                        </Button>
                    </Link>
                </div>

                <div className="w-full max-w-[350px] flex flex-col gap-8 sm:gap-6 mt-4 lg:mt-0">
                    {/* Header */}
                    <div className="flex flex-col gap-2 text-center">
                        <h2 className="font-host-grotesk font-semibold text-3xl sm:text-2xl leading-tight tracking-[-0.4px] text-white">
                            Welcome back
                        </h2>
                        <p className="font-host-grotesk font-normal text-base sm:text-sm leading-relaxed text-gray-400">
                            Enter your credentials to access your account
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 sm:p-3 text-sm font-medium text-red-400 bg-red-900/10 border border-red-900/50 rounded-xl sm:rounded-lg animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleEmailSignIn} className="flex flex-col gap-5 sm:gap-4">
                        <div className="flex flex-col gap-4 sm:gap-2">
                            <input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full h-12 sm:h-10 px-4 bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-lg font-host-grotesk text-base text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all duration-200"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full h-12 sm:h-10 px-4 bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-lg font-host-grotesk text-base text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all duration-200"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 sm:h-10 bg-[#EA580C] hover:bg-[#EA580C]/90 text-white font-host-grotesk font-medium text-base sm:text-sm rounded-xl sm:rounded-[10px] shadow-[0_0_20px_rgba(234,88,12,0.3)] disabled:opacity-70 transition-all active:scale-[0.98]"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Log In"}
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative flex items-center justify-center w-full py-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase bg-[#0a0a0a] px-4 text-gray-500 font-host-grotesk font-medium tracking-wider">
                            Or continue with
                        </div>
                    </div>

                    {/* Google Sign In */}
                    <Button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        variant="outline"
                        className="w-full h-12 sm:h-10 bg-white border-0 text-black font-host-grotesk font-medium text-base sm:text-sm rounded-xl sm:rounded-[10px] hover:bg-gray-100 disabled:opacity-70 transition-all active:scale-[0.98]"
                    >
                        <svg className="mr-3 h-5 w-5 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Google
                    </Button>

                    {/* Sign Up Link */}
                    <p className="text-center text-sm text-gray-500">
                        Don&apos;t have an account?{" "}
                        <Link href="/signup" className="text-[#EA580C] font-medium hover:underline hover:text-[#EA580C]/80">
                            Sign up
                        </Link>
                    </p>

                    {/* Learn More Link */}
                    <a 
                        href="https://shoulprint-hero.vercel.app" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
                    >
                        Learn more about SoulPrint →
                    </a>
                </div>
            </div>
        </div>
    );
}
