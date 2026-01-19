export type SoulprintTheme = {
    key: string
    label: string
    fontFamily: string
    colors: {
        primary: string
        primaryDark: string
        accent: string
        text: string
        bg: string
        surface: string
        muted: string
    }
}

type SoulprintData = {
    name?: string
    archetype?: string
    profile_summary?: {
        archetype?: string
        core_essence?: string
    }
}

const themes: Array<{ match: RegExp; theme: SoulprintTheme }> = [
    {
        match: /visionary/i,
        theme: {
            key: "visionary",
            label: "Visionary",
            fontFamily: "'Geist', 'Inter', ui-sans-serif",
            colors: {
                primary: "#2563EB",
                primaryDark: "#1D4ED8",
                accent: "#38BDF8",
                text: "#0F172A",
                bg: "#F8FAFC",
                surface: "#FFFFFF",
                muted: "#64748B"
            }
        }
    },
    {
        match: /maverick/i,
        theme: {
            key: "maverick",
            label: "Maverick",
            fontFamily: "'Manrope', 'Inter', ui-sans-serif",
            colors: {
                primary: "#F97316",
                primaryDark: "#EA580C",
                accent: "#F59E0B",
                text: "#1C1917",
                bg: "#FFF7ED",
                surface: "#FFFFFF",
                muted: "#78716C"
            }
        }
    },
    {
        match: /sage|oracle/i,
        theme: {
            key: "sage",
            label: "Sage",
            fontFamily: "'Source Serif 4', 'Georgia', serif",
            colors: {
                primary: "#0F766E",
                primaryDark: "#115E59",
                accent: "#14B8A6",
                text: "#0F172A",
                bg: "#F0FDFA",
                surface: "#FFFFFF",
                muted: "#475569"
            }
        }
    },
    {
        match: /mystic|seer/i,
        theme: {
            key: "mystic",
            label: "Mystic",
            fontFamily: "'Playfair Display', 'Georgia', serif",
            colors: {
                primary: "#7C3AED",
                primaryDark: "#6D28D9",
                accent: "#A78BFA",
                text: "#1E1B4B",
                bg: "#F5F3FF",
                surface: "#FFFFFF",
                muted: "#6B7280"
            }
        }
    },
    {
        match: /creator|artist|maker/i,
        theme: {
            key: "creator",
            label: "Creator",
            fontFamily: "'Space Grotesk', 'Inter', ui-sans-serif",
            colors: {
                primary: "#DB2777",
                primaryDark: "#BE185D",
                accent: "#F472B6",
                text: "#111827",
                bg: "#FFF1F2",
                surface: "#FFFFFF",
                muted: "#6B7280"
            }
        }
    }
]

const defaultTheme: SoulprintTheme = {
    key: "default",
    label: "Default",
    fontFamily: "'Inter', ui-sans-serif",
    colors: {
        primary: "#EA580C",
        primaryDark: "#C2410C",
        accent: "#FDBA74",
        text: "#0F172A",
        bg: "#F8FAFC",
        surface: "#FFFFFF",
        muted: "#64748B"
    }
}

function normalizeSoulprintData(data: unknown): SoulprintData | null {
    if (!data) return null
    if (typeof data === "string") {
        try {
            return JSON.parse(data) as SoulprintData
        } catch {
            return null
        }
    }
    if (typeof data === "object") return data as SoulprintData
    return null
}

export function getSoulprintTheme(data: unknown): SoulprintTheme {
    const normalized = normalizeSoulprintData(data)
    const archetype = normalized?.archetype || normalized?.profile_summary?.archetype || ""
    const name = normalized?.name || ""
    const essence = normalized?.profile_summary?.core_essence || ""
    const search = `${name} ${archetype} ${essence}`.trim()

    if (!search) return defaultTheme

    for (const entry of themes) {
        if (entry.match.test(search)) {
            return entry.theme
        }
    }

    return defaultTheme
}
