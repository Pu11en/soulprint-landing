/**
 * useMediaQuery hook
 * 
 * React hook for responsive design based on CSS media queries.
 * Handles SSR gracefully.
 * 
 * Usage:
 * const isMobile = useMediaQuery('(max-width: 768px)')
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
 * const isLandscape = useMediaQuery('(orientation: landscape)')
 */
import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
    // Default to false for SSR
    const [matches, setMatches] = useState(false)

    useEffect(() => {
        // Check if window is available (client-side)
        if (typeof window === 'undefined') return

        const mediaQuery = window.matchMedia(query)
        
        // Set initial value
        setMatches(mediaQuery.matches)

        // Handler for changes
        const handler = (event: MediaQueryListEvent) => {
            setMatches(event.matches)
        }

        // Modern browsers
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handler)
            return () => mediaQuery.removeEventListener('change', handler)
        }
        // Legacy browsers
        else {
            mediaQuery.addListener(handler)
            return () => mediaQuery.removeListener(handler)
        }
    }, [query])

    return matches
}

/**
 * Preset breakpoint hooks for common Tailwind breakpoints
 */
export function useIsMobile(): boolean {
    return useMediaQuery('(max-width: 639px)')
}

export function useIsTablet(): boolean {
    return useMediaQuery('(min-width: 640px) and (max-width: 1023px)')
}

export function useIsDesktop(): boolean {
    return useMediaQuery('(min-width: 1024px)')
}

export function usePrefersDarkMode(): boolean {
    return useMediaQuery('(prefers-color-scheme: dark)')
}

export function usePrefersReducedMotion(): boolean {
    return useMediaQuery('(prefers-reduced-motion: reduce)')
}
