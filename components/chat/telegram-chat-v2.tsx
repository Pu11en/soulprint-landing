'use client';

import { useState, useRef, useEffect, TouchEvent } from 'react';
import { ArrowLeft, Mic, Send, Moon, Sun, LogOut, Search } from 'lucide-react';
import { MessageContent } from './message-content';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

interface TelegramChatV2Props {
  messages: Message[];
  onSendMessage: (content: string, voiceVerified?: boolean, deepSearch?: boolean) => void;
  isLoading?: boolean;
  isDeepSearching?: boolean;
  aiName?: string;
  aiAvatar?: string;
  onBack?: () => void;
  onSettings?: () => void;
  defaultDarkMode?: boolean;
}

// Theme colors - SoulPrint Branding
const themes = {
  light: {
    background: '#FAFAFA',
    navBg: '#FFFFFF',
    navBorder: '#E5E5E5',
    senderBubble: '#EA580C', // SoulPrint orange for user messages
    senderText: '#FFFFFF',
    recipientBubble: '#F5F5F5',
    textPrimary: '#0a0a0a',
    textSecondary: '#737373',
    inputBg: '#FFFFFF',
    inputBorder: '#E5E5E5',
    accent: '#EA580C', // SoulPrint primary orange
    homeIndicator: 'rgba(0,0,0,0.15)',
  },
  dark: {
    background: '#0a0a0a', // SoulPrint dark background
    navBg: '#111111', // SoulPrint nav dark
    navBorder: '#262626',
    senderBubble: '#EA580C', // SoulPrint orange for user messages
    senderText: '#FFFFFF',
    recipientBubble: '#1a1a1a',
    textPrimary: '#FFFFFF',
    textSecondary: '#a3a3a3',
    inputBg: '#1a1a1a',
    inputBorder: '#262626',
    accent: '#EA580C', // SoulPrint primary orange
    homeIndicator: 'rgba(255,255,255,0.15)',
  },
};

// Swipeable message component
function SwipeableMessage({
  message,
  isUser,
  showTail,
  theme,
}: {
  message: Message;
  isUser: boolean;
  showTail: boolean;
  theme: typeof themes.dark;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  // Detect desktop viewport
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (isDesktop) return; // No swipe on desktop
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping || isDesktop) return;

    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    // Only handle horizontal swipes (to the left)
    if (isHorizontalSwipe.current && deltaX < 0) {
      // Max swipe distance of 80px
      const newOffset = Math.max(deltaX, -80);
      setOffsetX(newOffset);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    isHorizontalSwipe.current = null;
    // Animate back to original position
    setOffsetX(0);
  };

  // Calculate timestamp visibility based on swipe offset
  const timestampOpacity = Math.min(1, Math.abs(offsetX) / 40);
  const timestampTranslate = Math.max(0, 60 + offsetX * 0.75);

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} relative`}
    >
      {/* Timestamp that reveals on swipe - mobile only */}
      {!isDesktop && (
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center pr-2 pointer-events-none md:hidden"
          style={{
            opacity: timestampOpacity,
            transform: `translateX(${timestampTranslate}px) translateY(-50%)`,
            transition: isSwiping ? 'none' : 'all 0.3s ease-out',
          }}
        >
          <span
            className="text-[11px] whitespace-nowrap"
            style={{ color: theme.textSecondary }}
          >
            {formatTime(message.timestamp || new Date())}
          </span>
        </div>
      )}

      {/* Message bubble */}
      <div
        className="max-w-[75%] relative shadow-sm transition-colors duration-300"
        style={{
          backgroundColor: isUser ? theme.senderBubble : theme.recipientBubble,
          borderRadius: isUser
            ? (showTail ? '18px 18px 4px 18px' : '18px')
            : (showTail ? '18px 18px 18px 4px' : '18px'),
          transform: isDesktop ? 'none' : `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          touchAction: isDesktop ? 'auto' : 'pan-x',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Message Content */}
        <div className="px-4 py-3">
          <MessageContent
            content={message.content}
            textColor={isUser && 'senderText' in theme ? theme.senderText : theme.textPrimary}
          />
        </div>
        {/* Desktop timestamp - always visible */}
        {isDesktop && (
          <div className="px-4 pb-2 -mt-1">
            <span
              className="text-[11px]"
              style={{ color: isUser ? 'rgba(255,255,255,0.7)' : theme.textSecondary }}
            >
              {formatTime(message.timestamp || new Date())}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TelegramChatV2({
  messages,
  onSendMessage,
  isLoading = false,
  isDeepSearching = false,
  aiName = 'SoulPrint',
  aiAvatar,
  onBack,
  onSettings,
  defaultDarkMode = false,
}: TelegramChatV2Props) {
  const [input, setInput] = useState('');
  const [isDark, setIsDark] = useState(defaultDarkMode);
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputHeight, setInputHeight] = useState(70);
  const headerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastVoiceVerified, setLastVoiceVerified] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const theme = isDark ? themes.dark : themes.light;

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try different MIME types for browser compatibility
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = ''; // Let browser choose
        }
      }
      
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.text) {
          setInput(prev => prev + (prev ? ' ' : '') + data.text);
          // Store voice verification status for when message is sent
          setLastVoiceVerified(data.voiceVerified ?? true);
          inputRef.current?.focus();
        }
      } else {
        console.error('Transcription failed');
      }
    } catch (error) {
      console.error('Transcription error:', error);
    }
    setIsTranscribing(false);
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Measure actual input height
  useEffect(() => {
    if (inputAreaRef.current) {
      setInputHeight(inputAreaRef.current.offsetHeight);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check system preference on mount
  // System preference sync - intentional setState in effect
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window !== 'undefined' && !defaultDarkMode) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
  }, [defaultDarkMode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    // Pass voice verification status and deep search flag
    // Allow sending even while loading - messages will queue
    onSendMessage(input.trim(), lastVoiceVerified ?? undefined, deepSearchEnabled);
    setInput('');
    setLastVoiceVerified(null); // Reset for next message
    // Keep deep search enabled after send (user can toggle it off manually)
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Background - covers full screen, locked horizontal */}
      <div
        className="fixed inset-0 transition-colors duration-300 overflow-hidden"
        style={{ 
          backgroundColor: theme.background,
          touchAction: 'pan-y',
        }}
      />

      {/* FIXED Header - ALWAYS visible at top */}
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 transition-colors duration-300"
        style={{
          backgroundColor: theme.navBg,
          borderBottom: `1px solid ${theme.navBorder}`,
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="flex items-center justify-between px-3 h-[52px]">
          {/* Left - Back Button */}
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2 py-2 -ml-2 min-h-[44px] min-w-[44px] transition-colors active:opacity-70"
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

          {/* Right - Menu & Theme Toggle */}
          <div className="flex items-center">
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors active:opacity-70"
              style={{ color: theme.accent }}
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {onSettings && (
              <button
                onClick={onSettings}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors active:opacity-70"
                style={{ color: theme.accent }}
                aria-label="Settings"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
            {aiAvatar ? (
              <img
                src={aiAvatar}
                alt={aiName}
                className="w-[34px] h-[34px] rounded-full object-cover ml-1"
              />
            ) : (
              <div
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center ml-1 shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)',
                  boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)'
                }}
              >
                <span className="text-white text-sm font-medium">
                  {aiName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable Messages Area - vertical only */}
      <main
        className="fixed left-0 right-0 overflow-x-hidden overflow-y-auto overscroll-contain"
        style={{
          top: `calc(52px + env(safe-area-inset-top, 0px))`,
          bottom: `calc(${inputHeight}px + env(safe-area-inset-bottom, 0px))`,
          overscrollBehaviorX: 'none',
          touchAction: 'pan-y',
        }}
      >
        <div className="flex flex-col gap-2 px-3 py-4 overflow-x-hidden">
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            const showTail = index === messages.length - 1 ||
              messages[index + 1]?.role !== message.role;

            return (
              <SwipeableMessage
                key={message.id}
                message={message}
                isUser={isUser}
                showTail={showTail}
                theme={theme}
              />
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div
                className="rounded-[16px_16px_16px_4px] px-4 py-3 shadow-sm transition-colors"
                style={{ backgroundColor: theme.recipientBubble }}
              >
                {isDeepSearching ? (
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 animate-pulse" style={{ color: '#EA580C' }} />
                    <span className="text-sm" style={{ color: theme.textSecondary }}>
                      Researching...
                    </span>
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* FIXED Input Area - ALWAYS visible at bottom */}
      <footer
        ref={inputAreaRef}
        className="fixed bottom-0 left-0 right-0 z-50 transition-colors duration-300"
        style={{
          backgroundColor: theme.navBg,
          borderTop: `1px solid ${theme.navBorder}`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
          {/* Deep Search Toggle */}
          <button
            type="button"
            onClick={() => setDeepSearchEnabled(!deepSearchEnabled)}
            className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition-all active:opacity-70 ${
              deepSearchEnabled ? 'scale-110' : ''
            }`}
            style={{ 
              color: deepSearchEnabled ? '#EA580C' : theme.textSecondary,
              backgroundColor: deepSearchEnabled ? 'rgba(234, 88, 12, 0.15)' : 'transparent',
            }}
            title={deepSearchEnabled ? 'Deep Search ON - Click to disable' : 'Enable Deep Search'}
          >
            <Search className={`w-5 h-5 transition-all ${deepSearchEnabled ? 'stroke-[2.5px]' : ''}`} />
          </button>

          {/* Input Field */}
          <div
            className="flex-1 flex items-center rounded-full px-4 min-h-[44px] transition-colors duration-300"
            style={{
              backgroundColor: theme.inputBg,
              border: `1px solid ${deepSearchEnabled ? '#EA580C' : theme.inputBorder}`,
              boxShadow: deepSearchEnabled ? '0 0 0 1px rgba(234, 88, 12, 0.3)' : 'none',
            }}
          >
            {deepSearchEnabled && (
              <span className="text-[11px] font-medium mr-2 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(234, 88, 12, 0.15)', color: '#EA580C' }}>
                🔍
              </span>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={deepSearchEnabled ? "Deep search..." : "Message"}
              className="flex-1 text-[16px] bg-transparent outline-none transition-colors placeholder:text-[#8E8E93]"
              style={{ color: theme.textPrimary }}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="on"
            />
          </div>

          {/* Send/Mic Button */}
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
              onClick={handleMicClick}
              disabled={isTranscribing}
              className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition-all active:opacity-70 ${
                isRecording ? 'animate-pulse' : ''
              }`}
              style={{ 
                color: isRecording ? '#EF4444' : theme.textSecondary,
                backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
              }}
            >
              {isTranscribing ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>
          )}
        </form>

        {/* Home Indicator */}
        <div className="flex justify-center pb-1">
          <div
            className="w-[134px] h-[5px] rounded-full transition-colors"
            style={{ backgroundColor: theme.homeIndicator }}
          />
        </div>
      </footer>
    </>
  );
}
