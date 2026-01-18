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

interface SecurityAccessModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function SecurityAccessModal({ isOpen, onOpenChange }: SecurityAccessModalProps) {
    const [code, setCode] = useState("")
    const [error, setError] = useState(false)
    const router = useRouter()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (code === "!Arche!") {
            onOpenChange(false)
            router.push("/login")
        } else {
            setError(true)
            setCode("")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#0A0A0A] border-white/10 p-8 shadow-2xl">
                <DialogHeader className="gap-2">
                    <DialogTitle className="text-xl font-medium tracking-tight text-white">Security Access</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Please enter the access code to continue.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-2">
                    <div className="space-y-2">
                        <input
                            type="text"
                            placeholder="Enter Code"
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value)
                                setError(false)
                            }}
                            className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all font-sans text-lg tracking-[0.5em] text-center caret-[#EA580C]"
                            autoFocus
                        />
                        {error && (
                            <p className="text-sm font-medium text-red-500 text-center animate-in fade-in slide-in-from-top-1">
                                Access Denied: Incorrect Code
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-11 text-zinc-400 hover:text-white hover:bg-white/5"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 h-11 bg-[#EA580C] hover:bg-[#EA580C]/90 text-white font-medium tracking-wide shadow-[0px_0px_20px_rgba(234,88,12,0.3)] hover:shadow-[0px_0px_30px_rgba(234,88,12,0.5)] transition-all duration-300"
                        >
                            Unlock Access
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
