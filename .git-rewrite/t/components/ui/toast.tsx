/**
 * Simple Toast Notification Component
 * 
 * Custom toast implementation for consistent error/success/warning/info feedback
 * No external dependencies required
 */

"use client"

import * as React from "react"
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"

export type ToastType = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  title?: string
  description?: string
  type: ToastType
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
  clearAllToasts: () => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

export function useToast() {
  const context = React.useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

const toastConfig = {
  success: {
    icon: CheckCircle,
    className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200"
  },
  error: {
    icon: AlertCircle,
    className: "border-red-500 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200"
  },
  warning: {
    icon: AlertTriangle,
    className: "border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200"
  },
  info: {
    icon: Info,
    className: "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200"
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const toastTimeouts = React.useRef<Map<string, NodeJS.Timeout>>(new Map())

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = { id, duration: 5000, ...toast }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      const timeout = setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
      toastTimeouts.current.set(id, timeout)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
    
    // Clear timeout
    const timeout = toastTimeouts.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      toastTimeouts.current.delete(id)
    }
  }, [])

  const clearAllToasts = React.useCallback(() => {
    setToasts([])
    // Clear all timeouts
    toastTimeouts.current.forEach(timeout => clearTimeout(timeout))
    toastTimeouts.current.clear()
  }, [])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      toastTimeouts.current.forEach(timeout => clearTimeout(timeout))
    }
  }, [])

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    clearAllToasts
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-0 right-0 z-50 flex flex-col gap-2 p-4 pointer-events-none">
        {toasts.map(toast => {
          const config = toastConfig[toast.type]
          const Icon = config.icon
          
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-right",
                config.className
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
              
              <div className="flex flex-col gap-1 flex-1">
                {toast.title && (
                  <div className="text-sm font-semibold">
                    {toast.title}
                  </div>
                )}
                {toast.description && (
                  <div className="text-sm opacity-90">
                    {toast.description}
                  </div>
                )}
                {toast.action && (
                  <button
                    onClick={toast.action.onClick}
                    className="mt-2 text-sm font-medium underline hover:no-underline"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              
              <button
                onClick={() => removeToast(toast.id)}
                className="absolute right-2 top-2 rounded-md p-1 opacity-60 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// Hook helpers
export const toast = {
  success: (title: string, description?: string) => {
    const { addToast } = React.useContext(ToastContext) || { addToast: () => {} }
    addToast({ title, description, type: "success" })
  },
  error: (title: string, description?: string) => {
    const { addToast } = React.useContext(ToastContext) || { addToast: () => {} }
    addToast({ title, description, type: "error" })
  },
  warning: (title: string, description?: string) => {
    const { addToast } = React.useContext(ToastContext) || { addToast: () => {} }
    addToast({ title, description, type: "warning" })
  },
  info: (title: string, description?: string) => {
    const { addToast } = React.useContext(ToastContext) || { addToast: () => {} }
    addToast({ title, description, type: "info" })
  }
}

// Add styles safely
const addToastStyles = () => {
  if (typeof window === 'undefined') return
  
  const existingStyle = document.head.querySelector('style[data-toast-styles]')
  if (existingStyle) return
  
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slide-in-from-right {
      from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-in {
          animation: slide-in-from-right 0.3s ease-out;
        }
    `
  style.setAttribute('data-toast-styles', '')
  document.head.appendChild(style)
}

if (typeof window !== 'undefined') {
  addToastStyles()
}