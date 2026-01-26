/**
 * SoulPrint Custom Hooks
 * 
 * Reusable React hooks for the SoulPrint application.
 */

// Speech recognition
export { useSpeechRecognition } from './use-speech-recognition'

// State persistence
export { useLocalStorage } from './use-local-storage'

// Performance
export { useDebounce, useDebouncedCallback } from './use-debounce'

// Responsive design
export { 
    useMediaQuery,
    useIsMobile,
    useIsTablet,
    useIsDesktop,
    usePrefersDarkMode,
    usePrefersReducedMotion
} from './use-media-query'
