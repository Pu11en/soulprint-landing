"use client"

import Image from "next/image"

interface SoulPrintLogoProps {
    variant?: "light" | "dark"
    showEngine?: boolean
    size?: "sm" | "md" | "lg"
}

export function SoulPrintLogo({ 
    variant = "dark", 
    showEngine = true,
    size = "md" 
}: SoulPrintLogoProps) {
    const textColor = variant === "light" ? "text-white" : "text-black"
    
    const sizeClasses = {
        sm: {
            icon: "w-8 h-8",
            soulprint: "text-xl",
            engine: "text-lg tracking-[1px]"
        },
        md: {
            icon: "w-[45px] h-[45px]",
            soulprint: "text-[32px] leading-[38px]",
            engine: "text-[30px] leading-[38px] tracking-[2px]"
        },
        lg: {
            icon: "w-14 h-14",
            soulprint: "text-[40px] leading-[46px]",
            engine: "text-[36px] leading-[46px] tracking-[3px]"
        }
    }

    const classes = sizeClasses[size]

    return (
        <div className="flex items-center gap-2">
            {/* Logo Icon */}
            <div className={`${classes.icon} relative`}>
                <Image
                    src="/images/Soulprintengine-logo.png"
                    alt="SoulPrint"
                    fill
                    className="object-contain"
                />
            </div>
            
            {/* Text */}
            <div className="flex items-baseline gap-1">
                <span className={`font-koulen ${classes.soulprint} ${textColor}`}>
                    SoulPrint
                </span>
                {showEngine && (
                    <span className={`font-cinzel font-normal ${classes.engine} ${textColor} uppercase`}>
                        Engine
                    </span>
                )}
            </div>
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SoulPrintLogoCompact(_props: {
    variant?: "light" | "dark"
} = {}) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-9 h-9 relative">
                <Image
                    src="/images/Soulprintengine-logo.png"
                    alt="SoulPrint"
                    fill
                    className="object-contain"
                />
            </div>
        </div>
    )
}
