'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Paperclip, Mic, Send, MoreVertical, Moon, Sun } from 'lucide-react';
import { MessageContent } from './message-content';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

interface TelegramChatV2Props {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  aiName?: string;
  aiAvatar?: string;
  onBack?: () => void;
  onSettings?: () => void;
  defaultDarkMode?: boolean;
}

// Theme colors
const themes = {
  light: {
    background: '#ECE6DF',
    navBg: '#F5F5F5',
    navBorder: '#E9E9EB',
    senderBubble: '#E7FECC',
    recipientBubble: '#FFFFFF',
    textPrimary: '#000000',
    textSecondary: '#8E8E93',
    inputBg: '#FFFFFF',
    inputBorder: '#E9E9EB',
    accent: '#007AFF',
    homeIndicator: 'rgba(0,0,0,0.2)',
  },
  dark: {
    background: '#000000',
    navBg: '#171717',
    navBorder: '#262628',
    senderBubble: '#056162',
    recipientBubble: '#262628',
    textPrimary: '#FFFFFF',
    textSecondary: '#8E8E93',
    inputBg: '#262628',
    inputBorder: '#3A3A3C',
    accent: '#0A84FF',
    homeIndicator: 'rgba(255,255,255,0.2)',
  },
};

export function TelegramChatV2({
  messages,
  onSendMessage,
  isLoading = false,
  aiName = 'SoulPrint',
  aiAvatar,
  onBack,
  onSettings,
  defaultDarkMode = false,
}: TelegramChatV2Props) {
  const [input, setInput] = useState('');
  const [isDark, setIsDark] = useState(defaultDarkMode);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const theme = isDark ? themes.dark : themes.light;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check system preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !defaultDarkMode) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
  }, [defaultDarkMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    inputRef.current?.focus();
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  return (
    <div 
      className="flex flex-col h-full transition-colors duration-300"
      style={{ backgroundColor: theme.background }}
    >
      {/* Top Navigation */}
      <div 
        className="flex-shrink-0 safe-area-top transition-colors duration-300"
        style={{ 
          backgroundColor: theme.navBg,
          borderBottom: `1px solid ${theme.navBorder}`,
        }}
      >
        {/* Navigation Bar - 44px is the standard iOS nav height */}
        <div className="flex items-center justify-between px-3 h-[52px]">
          {/* Left - Back Button - touch target 44px */}
          <button 
            onClick={onBack}
            className="flex items-center gap-1 px-2 py-2 -ml-2 min-h-[44px] transition-colors active:opacity-70"
            style={{ color: theme.accent }}
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-[17px]">Back</span>
          </button>

          {/* Center - Profile */}
          <div className="flex flex-col items-center">
            <span 
              className="text-[17px] font-semibold transition-colors"
              style={{ color: theme.textPrimary }}
            >
              {aiName}
            </span>
            <span 
              className="text-[13px] transition-colors"
              style={{ color: theme.textSecondary }}
            >
              online
            </span>
          </div>

          {/* Right - Theme Toggle & Avatar */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors active:opacity-70"
              style={{ color: theme.accent }}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {aiAvatar ? (
              <img 
                src={aiAvatar} 
                alt={aiName}
                className="w-[34px] h-[34px] rounded-full object-cover"
              />
            ) : (
              <div 
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center"
                style={{ 
                  background: isDark 
                    ? 'linear-gradient(135deg, #7542C1 44%, #5733A5 95%)'
                    : 'linear-gradient(139deg, #B7BE6D 8%, #81AB95 66%)'
                }}
              >
                <span className="text-white text-sm font-medium">
                  {aiName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 overscroll-contain">
        <div className="flex flex-col gap-2">
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            const showTail = index === messages.length - 1 || 
              messages[index + 1]?.role !== message.role;
            
            return (
              <div
                key={message.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[75%] px-3 py-2 relative shadow-sm transition-colors duration-300 overflow-hidden"
                  style={{
                    backgroundColor: isUser ? theme.senderBubble : theme.recipientBubble,
                    borderRadius: isUser 
                      ? (showTail ? '18px 18px 4px 18px' : '18px')
                      : (showTail ? '18px 18px 18px 4px' : '18px'),
                  }}
                >
                  {/* Message Content */}
                  <MessageContent 
                    content={message.content} 
                    textColor={theme.textPrimary} 
                  />
                  
                  {/* Timestamp */}
                  <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span 
                      className="text-[11px] transition-colors"
                      style={{ color: theme.textSecondary }}
                    >
                      {formatTime(message.timestamp || new Date())}
                    </span>
                    {isUser && (
                      <svg 
                        className="w-4 h-3" 
                        viewBox="0 0 16 11" 
                        fill={isDark ? '#34C759' : '#4FC3F7'}
                      >
                        <path d="M11.071 0L5.5 5.571 3.429 3.5 2 4.929l3.5 3.5 7-7L11.071 0z"/>
                        <path d="M14.071 0L8.5 5.571 7.786 4.857 6.357 6.286l2.143 2.143 7-7L14.071 0z"/>
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div 
                className="rounded-[16px_16px_16px_4px] px-4 py-3 shadow-sm transition-colors"
                style={{ backgroundColor: theme.recipientBubble }}
              >
                <div className="flex gap-1">
                  <span 
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: theme.textSecondary, animationDelay: '0ms' }}
                  />
                  <span 
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: theme.textSecondary, animationDelay: '150ms' }}
                  />
                  <span 
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: theme.textSecondary, animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Navigation - Input Area */}
      <div 
        className="flex-shrink-0 safe-area-bottom transition-colors duration-300"
        style={{ 
          backgroundColor: theme.navBg,
          borderTop: `1px solid ${theme.navBorder}`,
        }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
          {/* Attach Button - 44px touch target */}
          <button 
            type="button"
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center transition-colors active:opacity-70"
            style={{ color: theme.textSecondary }}
          >
            <Paperclip className="w-6 h-6" />
          </button>

          {/* Input Field */}
          <div 
            className="flex-1 flex items-center rounded-full px-4 min-h-[44px] transition-colors duration-300"
            style={{ 
              backgroundColor: theme.inputBg,
              border: `1px solid ${theme.inputBorder}`,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message"
              className="flex-1 text-[16px] bg-transparent outline-none transition-colors placeholder:text-[#8E8E93]"
              style={{ color: theme.textPrimary }}
              disabled={isLoading}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="on"
            />
          </div>

          {/* Voice/Send Button - 44px touch target */}
          {input.trim() ? (
            <button 
              type="submit"
              disabled={isLoading}
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition-colors active:opacity-70"
              style={{ backgroundColor: theme.accent }}
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          ) : (
            <button 
              type="button"
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center transition-colors active:opacity-70"
              style={{ color: theme.textSecondary }}
            >
              <Mic className="w-6 h-6" />
            </button>
          )}
        </form>
        
        {/* Home Indicator - only show if no safe area */}
        <div className="flex justify-center pb-1" style={{ paddingBottom: 'max(4px, env(safe-area-inset-bottom, 4px))' }}>
          <div 
            className="w-[134px] h-[5px] rounded-full transition-colors"
            style={{ backgroundColor: theme.homeIndicator }}
          />
        </div>
      </div>
    </div>
  );
}
