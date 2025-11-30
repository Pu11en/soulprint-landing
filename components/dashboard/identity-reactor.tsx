"use client"

export function IdentityReactor() {
    return (
        <div className="flex h-full w-full gap-4">
            {/* Left Panel - SoulPrint Reactor */}
            <div className="flex flex-1 flex-col rounded-xl border border-[#333] bg-[#0A0A0A] p-4">
                {/* Panel Header */}
                <div className="mb-4 font-mono text-xs tracking-wider text-gray-500">
                    [SOULPRINT REACTOR]
                </div>

                {/* Visualizer */}
                <div className="flex flex-1 items-center justify-center">
                    <div className="relative">
                        {/* Concentric rings animation */}
                        <svg
                            width="320"
                            height="320"
                            viewBox="0 0 320 320"
                            className="animate-spin-slow"
                            style={{ animationDuration: '20s' }}
                        >
                            {/* Outer rings */}
                            {[140, 120, 100, 80, 60, 40, 25].map((radius, i) => (
                                <circle
                                    key={i}
                                    cx="160"
                                    cy="160"
                                    r={radius}
                                    fill="none"
                                    stroke="#ea580c"
                                    strokeWidth="1"
                                    opacity={0.4 + i * 0.08}
                                />
                            ))}
                            {/* Dynamic spiral element */}
                            <path
                                d="M160,160 Q200,120 240,160 Q200,200 160,160"
                                fill="none"
                                stroke="#ea580c"
                                strokeWidth="1.5"
                                opacity="0.8"
                            />
                            <path
                                d="M160,160 Q120,120 80,160 Q120,200 160,160"
                                fill="none"
                                stroke="#ea580c"
                                strokeWidth="1.5"
                                opacity="0.6"
                                transform="rotate(90, 160, 160)"
                            />
                            {/* Center dot */}
                            <circle cx="160" cy="160" r="4" fill="#ea580c" />
                        </svg>
                    </div>
                </div>

                {/* Status Info */}
                <div className="mt-4 space-y-1 font-mono text-xs text-gray-400">
                    <div>Status: <span className="text-white">ONLINE</span></div>
                    <div>Pattern Depth: <span className="text-white">1.3</span></div>
                    <div>Stability: <span className="text-white">82%</span></div>
                    <div>Signal Drift: <span className="text-white">12%</span></div>
                </div>
            </div>

            {/* Right Panels */}
            <div className="flex w-[400px] flex-col gap-4">
                {/* High-Level Signal Panel */}
                <div className="flex-1 rounded-xl border border-[#333] bg-[#0A0A0A] p-4">
                    <div className="mb-4 font-mono text-xs tracking-wider text-gray-500">
                        [HIGH-LEVEL SIGNAL]
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <div className="font-mono text-xs text-gray-500">SHADOW ARCHETYPE:</div>
                            <div className="font-koulen text-2xl text-white">The Strategist</div>
                        </div>
                        
                        <div>
                            <div className="font-mono text-xs text-gray-500">DOMINANT THINKING MODE:</div>
                            <div className="font-mono text-sm text-white">Conceptual / Pattern-Oriented</div>
                        </div>
                        
                        <div className="font-mono text-sm text-orange-500">
                            ACTIVE LAYER: CORE
                        </div>
                    </div>
                </div>

                {/* Status Panel */}
                <div className="flex-1 rounded-xl border border-[#333] bg-[#0A0A0A] p-4">
                    <div className="mb-4 font-mono text-xs tracking-wider text-gray-500">
                        [STATUS]
                    </div>
                    
                    <div className="space-y-2 font-mono text-sm">
                        <div className="text-white">Fragments Stored: <span className="text-gray-400">12</span></div>
                        <div className="text-white">Identity Stability (7d): <span className="text-gray-400">+3%</span></div>
                        <div className="text-orange-500">Trajectory: STABILIZING</div>
                        
                        <div className="mt-4 border-t border-[#333] pt-4">
                            <div className="text-gray-400">Sync: ChatGPT, Claude, Perplexity</div>
                            <div className="text-gray-400">Local Vault: ENCRYPTED / LOCAL ONLY</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
