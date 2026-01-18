"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export default function QuestionnaireIntroPage() {
    const router = useRouter()

    const handleLetsGo = () => {
        router.push('/questionnaire/new')
    }

    return (
        <div className="flex h-screen bg-[#d4d4d8]">
            {/* Sidebar */}
            <div className="flex h-full w-14 flex-col items-center justify-between border-r border-[#111] bg-[#111] py-2">
                <div className="h-[52px] w-full" />
                <div className="flex flex-1 flex-col items-center gap-1 py-2">
                    {/* Nav items - Terminal is active */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-600">
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>
                <div className="py-2" />
            </div>

            {/* Main Content */}
            <div className="flex flex-1 flex-col">
                {/* Top Bar */}
                <header className="flex h-[52px] items-center justify-between border-b border-[#111] bg-[#111] px-4">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/images/Soulprintengine-logo.png"
                            alt="SoulPrint"
                            width={28}
                            height={28}
                            className="object-contain"
                        />
                        <span className="font-koulen text-[22px] leading-[26px] text-white tracking-wide">
                            SOULPRINT
                        </span>
                        <span className="font-cinzel font-normal text-[20px] leading-[26px] tracking-[1px] uppercase text-white -ml-1">
                            ENGINE
                        </span>
                    </div>
                    <Button className="h-9 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600">
                        Log out
                    </Button>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-hidden p-4">
                    <div className="flex h-full gap-4">
                        {/* Left Side - SoulPrint Studio Card */}
                        <div className="relative flex h-full w-[512px] flex-col items-center justify-center overflow-hidden rounded-xl bg-black shadow-sm">
                            {/* Logo */}
                            <div className="mb-8">
                                <Image
                                    src="/images/Soulprintengine-logo.png"
                                    alt="SoulPrint Logo"
                                    width={260}
                                    height={260}
                                    className="object-contain drop-shadow-lg"
                                />
                            </div>
                            
                            {/* Title */}
                            <div className="flex items-baseline gap-2">
                                <span className="font-koulen text-[56px] leading-[52px] text-white tracking-wide">
                                    SOULPRINT
                                </span>
                                <span className="font-inter font-thin italic text-[54px] leading-[52px] text-white tracking-[-2px]">
                                    Studio
                                </span>
                            </div>

                            {/* Powered By */}
                            <div className="absolute bottom-16 flex flex-col items-center">
                                <span className="font-inter font-thin text-[14px] text-white mb-2">
                                    powered by
                                </span>
                                <div className="flex items-center gap-1">
                                    <span className="font-koulen text-[18px] text-white tracking-wide">
                                        SOULPRINT
                                    </span>
                                    <span className="font-cinzel text-[14px] text-white tracking-[2px] uppercase">
                                        ENGINE
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side - Welcome Content */}
                        <div className="flex flex-1 flex-col rounded-xl bg-[#FAFAFA] p-6 shadow-[0px_4px_4px_2px_rgba(0,0,0,0.25)]">
                            {/* Header */}
                            <div className="mb-8">
                                <h1 className="font-koulen text-[32px] leading-[38px] text-black tracking-wide">
                                    WELCOME TO SOULPRINT ENGINE
                                </h1>
                            </div>

                            {/* Info Card */}
                            <div className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
                                <p className="font-inter text-base leading-7 text-black opacity-80">
                                    Let&apos;s get your SoulPrint set up.
                                </p>
                                <p className="mt-4 font-inter text-base leading-7 text-black opacity-80">
                                    This is a guided, step-by-step process designed to be quick and easy. Simply answer the questions in each section, and we&apos;ll build your SoulPrint as you go.
                                </p>
                                <p className="mt-4 font-inter text-base leading-7 text-black opacity-80">
                                    There&apos;s nothing to prepare. Just respond naturally, and we&apos;ll handle the rest.
                                </p>
                            </div>

                            {/* Let's Go Button */}
                            <div className="mt-auto flex justify-end">
                                <Button 
                                    onClick={handleLetsGo}
                                    className="h-10 rounded-lg bg-[#EA580C] px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700"
                                >
                                    Let&apos;s Go
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
