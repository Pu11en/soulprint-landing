"use client";

import { Button } from "@/components/ui/button";
import { signIn, signUp, signInWithGoogle } from "@/app/actions/auth";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    // Check if user is already authenticated
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
            <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
                <Loader2 className="h-8 w-8 animate-spin text-[#EA580C]" />
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData();
        formData.append("email", email);
        formData.append("password", password);

        try {
            if (isLogin) {
                const result = await signIn(formData);
                if (result?.error) {
                    setError(result.error);
                    setLoading(false);
                }
            } else {
                formData.append("name", name);
                const result = await signUp(formData);
                if (result?.error) {
                    setError(result.error);
                    setLoading(false);
                } else if (result?.success) {
                    setSuccess(true);
                    setLoading(false);
                }
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

    // Email confirmation success state
    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] px-6">
                <div className="w-full max-w-[400px] flex flex-col items-center gap-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#EA580C]/20 flex items-center justify-center border border-[#EA580C]/30 shadow-[0_0_20px_rgba(234,88,12,0.2)]">
                        <svg className="w-8 h-8 text-[#EA580C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="font-host-grotesk font-semibold text-2xl text-white">
                        Check your email
                    </h2>
                    <p className="text-gray-400">
                        We sent a confirmation link to <span className="text-white font-medium">{email}</span>.
                        Click the link to activate your account.
                    </p>
                    <Button 
                        onClick={() => {
                            setSuccess(false);
                            setIsLogin(true);
                        }}
                        variant="outline" 
                        className="mt-4 border-[#333] text-white hover:bg-white/10 hover:text-white"
                    >
                        Back to Login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
            {/* Subtle gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#EA580C]/5 via-transparent to-transparent" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center w-full px-6 py-12">
                {/* Logo + Branding */}
                <div className="flex flex-col items-center gap-4 mb-8">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(234,88,12,0.3)] border border-[#EA580C]/30">
                        <Image
                            src="/images/Soulprintengine-logo.png"
                            alt="SoulPrint Logo"
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                        <span className="text-white">Soul</span>
                        <span className="text-[#EA580C]">Print</span>
                    </h1>
                </div>

                {/* Tagline */}
                <p className="text-gray-400 text-center text-lg sm:text-xl max-w-md mb-10">
                    Your AI should know who you are.
                </p>

                {/* Auth Card */}
                <div className="w-full max-w-[400px] bg-[#111111] border border-white/10 rounded-2xl p-8 shadow-2xl">
                    {/* Toggle Tabs */}
                    <div className="flex mb-6 bg-[#0a0a0a] rounded-lg p-1">
                        <button
                            type="button"
                            onClick={() => { setIsLogin(true); setError(""); }}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                                isLogin 
                                    ? "bg-[#EA580C] text-white shadow-lg" 
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Log In
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsLogin(false); setError(""); }}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                                !isLogin 
                                    ? "bg-[#EA580C] text-white shadow-lg" 
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 text-sm font-medium text-red-400 bg-red-900/10 border border-red-900/50 rounded-lg animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {!isLogin && (
                            <input
                                type="text"
                                placeholder="Full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required={!isLogin}
                                className="w-full h-12 px-4 bg-[#1a1a1a] border border-white/10 rounded-lg font-host-grotesk text-base text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all duration-200"
                            />
                        )}
                        <input
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full h-12 px-4 bg-[#1a1a1a] border border-white/10 rounded-lg font-host-grotesk text-base text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all duration-200"
                        />
                        <input
                            type="password"
                            placeholder={isLogin ? "Password" : "Password (min 6 characters)"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={isLogin ? undefined : 6}
                            className="w-full h-12 px-4 bg-[#1a1a1a] border border-white/10 rounded-lg font-host-grotesk text-base text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all duration-200"
                        />

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-[#EA580C] hover:bg-[#EA580C]/90 text-white font-host-grotesk font-medium text-base rounded-lg shadow-[0_0_20px_rgba(234,88,12,0.3)] disabled:opacity-70 transition-all active:scale-[0.98]"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "Log In" : "Create Account")}
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative flex items-center justify-center w-full py-5">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase bg-[#111111] px-4 text-gray-500 font-medium tracking-wider">
                            Or
                        </div>
                    </div>

                    {/* Google Sign In */}
                    <Button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        variant="outline"
                        className="w-full h-12 bg-white border-0 text-black font-host-grotesk font-medium text-base rounded-lg hover:bg-gray-100 disabled:opacity-70 transition-all active:scale-[0.98]"
                    >
                        <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
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
                        Continue with Google
                    </Button>
                </div>

                {/* Footer link */}
                <a 
                    href="https://shoulprint-hero.vercel.app" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 text-sm text-gray-600 hover:text-gray-400 transition-colors"
                >
                    Learn more about SoulPrint →
                </a>
            </div>
        </div>
    );
}
