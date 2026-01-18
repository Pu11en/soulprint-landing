"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface WaitlistModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function WaitlistModal({ isOpen, onOpenChange }: WaitlistModalProps) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [ndaAgreed, setNdaAgreed] = useState(false)
    const [code, setCode] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const [showCodeInput, setShowCodeInput] = useState(false)
    const router = useRouter()

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!ndaAgreed) {
            setError("Please agree to the NDA to continue")
            return
        }

        setLoading(true)

        try {
            const response = await fetch("/api/waitlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to join waitlist")
            }

            setSuccess(true)
            setName("")
            setEmail("")
            setNdaAgreed(false)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Something went wrong"
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    const handleCodeSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (code === "!Arche!") {
            onOpenChange(false)
            router.push("/login")
        } else {
            setError("Invalid access code")
            setCode("")
        }
    }

    const handleClose = () => {
        onOpenChange(false)
        // Reset state after modal closes
        setTimeout(() => {
            setName("")
            setEmail("")
            setNdaAgreed(false)
            setCode("")
            setError("")
            setSuccess(false)
            setShowCodeInput(false)
        }, 300)
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md bg-[#0A0A0A] border-white/10 p-8 shadow-2xl">
                <DialogHeader className="gap-2">
                    <DialogTitle className="text-xl font-medium tracking-tight text-white">
                        {success ? "You're on the list!" : showCodeInput ? "Enter Access Code" : "Join the Waitlist"}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        {success
                            ? "Check your email for confirmation. We'll notify you when it's your turn!"
                            : showCodeInput
                                ? "Enter your access code to skip the waitlist."
                                : "Be the first to experience SoulPrint. Enter your details to join the waitlist."}
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <div className="flex flex-col gap-4 mt-2">
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <p className="text-sm text-green-400 text-center">
                                🎉 Success! Check your inbox for a confirmation email.
                            </p>
                        </div>
                        <Button
                            onClick={handleClose}
                            className="w-full h-11 bg-[#EA580C] hover:bg-[#EA580C]/90 text-white font-medium"
                        >
                            Close
                        </Button>
                    </div>
                ) : showCodeInput ? (
                    <form onSubmit={handleCodeSubmit} className="flex flex-col gap-6 mt-2">
                        <div className="space-y-2">
                            <input
                                type="text"
                                placeholder="Enter Code"
                                value={code}
                                onChange={(e) => {
                                    setCode(e.target.value)
                                    setError("")
                                }}
                                className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all font-sans text-lg tracking-[0.5em] text-center caret-[#EA580C]"
                                autoFocus
                            />
                            {error && (
                                <p className="text-sm font-medium text-red-500 text-center animate-in fade-in slide-in-from-top-1">
                                    {error}
                                </p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setShowCodeInput(false)
                                    setError("")
                                    setCode("")
                                }}
                                className="flex-1 h-11 text-zinc-400 hover:text-white hover:bg-white/5"
                            >
                                Back
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1 h-11 bg-[#EA580C] hover:bg-[#EA580C]/90 text-white font-medium tracking-wide shadow-[0px_0px_20px_rgba(234,88,12,0.3)] hover:shadow-[0px_0px_30px_rgba(234,88,12,0.5)] transition-all duration-300"
                            >
                                Unlock Access
                            </Button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4 mt-2">
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value)
                                    setError("")
                                }}
                                required
                                disabled={loading}
                                className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all disabled:opacity-50"
                                autoFocus
                            />
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value)
                                    setError("")
                                }}
                                required
                                disabled={loading}
                                className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all disabled:opacity-50"
                            />

                            {/* NDA Agreement Checkbox */}
                            <div className="flex items-start gap-3 p-3 bg-zinc-900/30 border border-white/10 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="nda-agreement"
                                    checked={ndaAgreed}
                                    onChange={(e) => {
                                        setNdaAgreed(e.target.checked)
                                        setError("")
                                    }}
                                    className="mt-1 h-4 w-4 rounded border-white/20 bg-zinc-900 text-[#EA580C] focus:ring-2 focus:ring-[#EA580C]/20 focus:ring-offset-0 cursor-pointer"
                                />
                                <label htmlFor="nda-agreement" className="text-sm text-zinc-400 leading-relaxed cursor-pointer">
                                    I agree to sign a Non-Disclosure Agreement (NDA) before accessing SoulPrint
                                </label>
                            </div>

                            {error && (
                                <p className="text-sm font-medium text-red-500 text-center animate-in fade-in slide-in-from-top-1">
                                    {error}
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            disabled={loading || !ndaAgreed}
                            className="w-full h-11 bg-[#EA580C] hover:bg-[#EA580C]/90 text-white font-medium tracking-wide shadow-[0px_0px_20px_rgba(234,88,12,0.3)] hover:shadow-[0px_0px_30px_rgba(234,88,12,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Joining...
                                </>
                            ) : (
                                "Join Waitlist"
                            )}
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#0A0A0A] px-2 text-zinc-500">or</span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                setShowCodeInput(true)
                                setError("")
                            }}
                            className="w-full h-11 text-zinc-400 hover:text-white hover:bg-white/5 border border-white/10"
                        >
                            I have an access code
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
