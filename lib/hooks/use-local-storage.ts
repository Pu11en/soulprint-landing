/**
 * useLocalStorage hook
 * 
 * Persist state to localStorage with automatic serialization.
 * Handles SSR gracefully.
 * 
 * Usage:
 * const [theme, setTheme] = useLocalStorage('theme', 'dark')
 */
import { useState, useEffect, useCallback } from 'react'

export function useLocalStorage<T>(
    key: string, 
    initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
    // Get initial value (check localStorage first)
    const getStoredValue = useCallback((): T => {
        if (typeof window === 'undefined') {
            return initialValue
        }
        try {
            const item = window.localStorage.getItem(key)
            return item ? JSON.parse(item) : initialValue
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error)
            return initialValue
        }
    }, [key, initialValue])

    const [storedValue, setStoredValue] = useState<T>(getStoredValue)

    // Update localStorage when state changes
    const setValue = useCallback((value: T | ((prev: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value
            setStoredValue(valueToStore)
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore))
            }
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error)
        }
    }, [key, storedValue])

    // Sync state across tabs/windows
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue) {
                try {
                    setStoredValue(JSON.parse(e.newValue))
                } catch {
                    // Ignore parse errors
                }
            }
        }

        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [key])

    return [storedValue, setValue]
}
