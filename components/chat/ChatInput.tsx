'use client';

import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  isListening?: boolean;
  onStartListening?: () => void;
  onStopListening?: () => void;
  onClear?: () => void;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  isListening = false,
  onStartListening,
  onStopListening,
  onClear,
  placeholder = 'Message',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '24px';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        textareaRef.current?.focus();
        onSubmit();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      textareaRef.current?.focus();
      onSubmit();
    }
  };

  const showClearButton = isListening || value.trim();

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 w-full max-w-2xl mx-auto">
      {/* Clear button */}
      {showClearButton && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/[0.1] flex items-center justify-center active:scale-95 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Input container */}
      <div
        className={cn(
          'flex-1 flex items-end gap-2 px-4 py-2 rounded-[20px] transition-all duration-200',
          'bg-[#1a1a1c] border',
          isListening
            ? 'border-red-500/40 ring-1 ring-red-500/20'
            : 'border-white/[0.08] focus-within:border-white/[0.15]'
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening...' : placeholder}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent text-[16px] text-white/90',
            'placeholder:text-white/30 outline-none',
            'min-h-[24px] max-h-[120px] py-1',
            'leading-normal'
          )}
          style={{ height: '24px' }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />

        {/* Listening indicator */}
        {isListening && (
          <div className="flex items-center pb-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </div>
        )}
      </div>

      {/* Send or Mic button */}
      {value.trim() ? (
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all',
            'bg-gradient-to-br from-orange-500 to-orange-600 text-white',
            'shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40',
            'active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={isListening ? onStopListening : onStartListening}
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95',
            isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
              : 'bg-[#2a2a2c] text-white/60 hover:text-white/80'
          )}
        >
          {isListening ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V19h4v2H8v-2h4v-3.07z" />
            </svg>
          )}
        </button>
      )}
    </form>
  );
}
