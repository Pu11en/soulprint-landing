"use client";

import { Button } from "@/components/ui/button";
import { signIn, signInWithGoogle, signInAsDemo } from "@/app/actions/auth";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

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
            // If redirect happens in server action, this won't be reached
        } catch {
            // Server action may have redirected
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        await signInWithGoogle();
    };

    const handleDemoSignIn = async () => {
        setLoading(true);
        await signInAsDemo();
    };

    return (
        <div className="flex flex-col lg:flex-row w-full h-full min-h-screen">
            {/* Left Side - Image (Hidden on mobile, visible on lg) */}
            <div className="relative hidden lg:flex lg:w-1/2 bg-cover bg-center bg-no-repeat bg-[#0f0f0f]">
                <Image
                    src="/images/Soulprintengine-logo.png"
                    alt="SoulPrint Engine"
                    fill
                    className="object-cover opacity-80"
                    priority
                />
            </div>

            {/* Right Side - Form */}
            <div className="flex flex-1 flex-col justify-center items-center p-6 sm:p-12 lg:p-[32px] bg-white relative">
                {/* Top Left Home Button */}
                <div className="absolute top-8 left-8">
                    <Link href="/">
                        <Button variant="ghost" className="text-[#341E63] font-host-grotesk font-medium text-sm hover:bg-transparent hover:underline flex gap-2">
                            ← Back to Home
                        </Button>
                    </Link>
                </div>

                <div className="w-full max-w-[350px] flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex flex-col gap-2 text-center">
                        <h2 className="font-host-grotesk font-semibold text-2xl leading-8 tracking-[-0.4px] text-[#341E63]">
                            Welcome back
                        </h2>
                        <p className="font-host-grotesk font-normal text-sm leading-5 text-[#5E4F7E]">
                            Enter your credentials to access your account
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full h-9 px-3 py-1 bg-white border border-[#E2E8F0] rounded-lg shadow-[0px_1px_2px_rgba(121,87,194,0.05)] font-host-grotesk text-sm text-[#341E63] placeholder:text-[#5E4F7E] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full h-9 px-3 py-1 bg-white border border-[#E2E8F0] rounded-lg shadow-[0px_1px_2px_rgba(121,87,194,0.05)] font-host-grotesk text-sm text-[#341E63] placeholder:text-[#5E4F7E] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-9 bg-[#EA580C] hover:bg-[#EA580C]/90 text-[#F8FAFC] font-host-grotesk font-medium text-sm rounded-[10px] shadow-[inset_0px_-2px_4px_rgba(0,0,0,0.3),inset_0px_2px_4px_rgba(255,255,255,0.3)] disabled:opacity-50"
                        >
                            {loading ? "Logging in..." : "Log In"}
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative flex items-center justify-center w-full">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-[#E2E8F0]" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase bg-white px-2 text-[#5E4F7E] font-host-grotesk">
                            Or continue with
                        </div>
                    </div>

                    {/* Social Login */}
                    <Button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        variant="outline"
                        className="w-full h-9 bg-white border border-[#E2E8F0] text-[#341E63] font-host-grotesk font-medium text-sm rounded-[10px] shadow-[0px_1px_2px_rgba(121,87,194,0.05)] hover:bg-gray-50 disabled:opacity-50"
                    >
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
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

                    {/* Demo Mode Button */}
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleDemoSignIn}
                        disabled={loading}
                        className="w-full h-9 text-[#ea580c] font-host-grotesk font-medium text-sm hover:bg-[#ea580c]/10 hover:text-[#ea580c]"
                    >
                        🎯 Try Demo Mode (Elon Musk)
                    </Button>
                </div>
            </div>
        </div>
    );
}
