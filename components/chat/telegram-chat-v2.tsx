'use client';

import { useState, useRef, useEffect, TouchEvent } from 'react';
import { ArrowLeft, Mic, Send, Moon, Sun, Settings, Search, Square, Menu, Copy, Check, RefreshCw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { MessageContent, CitationMetadata } from './message-content';
import { getCsrfToken } from '@/lib/csrf';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  citations?: CitationMetadata[];
};

interface TelegramChatV2Props {
  messages: Message[];
  onSendMessage: (content: string, voiceVerified?: boolean, deepSearch?: boolean) => void;
  onRegenerate?: () => void;
  isLoading?: boolean;
  isGenerating?: boolean;
  isDeepSearching?: boolean;
  aiName?: string;
  aiAvatar?: string;
  onBack?: () => void;
  onSettings?: () => void;
  onStop?: () => void;
  onMenuClick?: () => void;
}

// Swipeable message component
function SwipeableMessage({
  message,
  isUser,
  showTail,
  isLastAI,
  onRegenerate,
}: {
  message: Message;
  isUser: boolean;
  showTail: boolean;
  isLastAI?: boolean;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
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
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isHorizontalSwipe.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping || isDesktop) return;

    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

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
          <span className="text-[11px] whitespace-nowrap text-muted-foreground">
            {formatTime(message.timestamp || new Date())}
          </span>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-[75%] relative shadow-sm transition-colors duration-300 ${
          isUser ? 'bg-primary' : 'bg-muted'
        }`}
        style={{
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
        <div className={`px-4 py-3 ${isUser ? 'text-primary-foreground' : 'text-foreground'}`}>
          <MessageContent
            content={message.content}
            isUser={isUser}
            citations={message.citations}
          />
        </div>
        {/* Desktop timestamp + action buttons */}
        {isDesktop && (
          <div className="px-4 pb-2 -mt-1 flex items-center gap-2">
            <span className={`text-[11px] ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
              {formatTime(message.timestamp || new Date())}
            </span>
            <div className="flex-1" />
            {/* Copy button */}
            {message.content && message.id !== 'welcome' && (
              <button
                onClick={handleCopy}
                className={`p-0.5 rounded transition-colors ${isUser ? 'text-primary-foreground/50 hover:text-primary-foreground/80' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                title="Copy message"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
            {/* Regenerate button - only on last AI message */}
            {isLastAI && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                title="Regenerate response"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile action buttons - below bubble */}
      {!isDesktop && message.content && message.id !== 'welcome' && (
        <div className={`flex gap-2 mt-0.5 ${isUser ? 'justify-end' : 'justify-start'} px-1`}>
          <button
            onClick={handleCopy}
            className="p-1 rounded text-muted-foreground/40 active:text-muted-foreground transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
          {isLastAI && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1 rounded text-muted-foreground/40 active:text-muted-foreground transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TelegramChatV2({
  messages,
  onSendMessage,
  onRegenerate,
  isLoading = false,
  isGenerating = false,
  isDeepSearching = false,
  aiName = 'SoulPrint',
  aiAvatar,
  onBack,
  onSettings,
  onStop,
  onMenuClick,
}: TelegramChatV2Props) {
  const [input, setInput] = useState('');
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

  // Theme integration
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

      const csrfToken = await getCsrfToken();
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
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
      <div className="fixed inset-0 bg-background transition-colors duration-300 overflow-hidden" style={{ touchAction: 'pan-y' }} />

      {/* FIXED Header - ALWAYS visible at top */}
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 md:left-72 z-50 bg-card border-b border-border transition-colors duration-300"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="flex items-center justify-between px-3 h-[52px]">
          {/* Left - Menu (mobile) or Back Button (desktop) */}
          {onMenuClick ? (
            <button
              onClick={onMenuClick}
              className="flex items-center gap-1 px-2 py-2 -ml-2 min-h-[44px] min-w-[44px] text-primary transition-colors active:opacity-70 md:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={onBack}
              className="flex items-center gap-1 px-2 py-2 -ml-2 min-h-[44px] min-w-[44px] text-primary transition-colors active:opacity-70"
            >
              <ArrowLeft className="w-6 h-6" />
              <span className="text-[17px]">Back</span>
            </button>
          )}
          {/* Desktop: show back button even with menu */}
          {onMenuClick && onBack && (
            <button
              onClick={onBack}
              className="hidden md:flex items-center gap-1 px-2 py-2 -ml-2 min-h-[44px] min-w-[44px] text-primary transition-colors active:opacity-70"
            >
              <ArrowLeft className="w-6 h-6" />
              <span className="text-[17px]">Back</span>
            </button>
          )}

          {/* Center - Profile */}
          <div className="flex flex-col items-center">
            <span className="text-[17px] font-semibold text-foreground transition-colors">
              {aiName}
            </span>
            <span className="text-[13px] text-muted-foreground transition-colors">
              {isGenerating ? 'typing...' : 'online'}
            </span>
          </div>

          {/* Right - Menu & Theme Toggle */}
          <div className="flex items-center">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-primary transition-colors active:opacity-70"
              aria-label="Toggle dark mode"
            >
              {mounted ? (
                resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
              ) : (
                <div className="w-5 h-5" />
              )}
            </button>
            {onSettings && (
              <button
                onClick={onSettings}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-primary transition-colors active:opacity-70"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
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
        className="fixed left-0 right-0 md:left-72 overflow-x-hidden overflow-y-auto overscroll-contain"
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
            // Last AI message (for regenerate button)
            const isLastAI = !isUser && index === messages.length - 1;

            return (
              <SwipeableMessage
                key={message.id}
                message={message}
                isUser={isUser}
                showTail={showTail}
                isLastAI={isLastAI}
                onRegenerate={onRegenerate}
              />
            );
          })}

          {/* Suggested prompts - show for new conversations (only welcome message exists) */}
          {messages.length === 1 && messages[0]?.id === 'welcome' && !isLoading && (
            <div className="flex flex-wrap gap-2 px-1 mt-1">
              {[
                'What do you know about me?',
                'Help me brainstorm an idea',
                'What should I work on today?',
                'Tell me something surprising about myself',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSendMessage(prompt)}
                  className="px-3 py-2 rounded-2xl text-sm bg-muted/80 border border-border text-foreground hover:bg-accent transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Loading indicator - only show during pre-streaming wait */}
          {isLoading && !isGenerating && (
            <div className="flex justify-start">
              <div className="rounded-[16px_16px_16px_4px] px-4 py-3 shadow-sm bg-muted transition-colors">
                {isDeepSearching ? (
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 animate-pulse text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Researching...
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <span
                      className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: '300ms' }}
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
        className="fixed bottom-0 left-0 right-0 md:left-72 z-50 bg-card border-t border-border transition-colors duration-300"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
          {/* Web Search Toggle */}
          <button
            type="button"
            onClick={() => setDeepSearchEnabled(!deepSearchEnabled)}
            className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition-all active:opacity-70 ${
              deepSearchEnabled ? 'scale-110 text-primary bg-primary/15' : 'text-muted-foreground bg-transparent'
            }`}
            title={deepSearchEnabled ? 'Web Search ON - Click to disable' : 'Enable Web Search'}
          >
            <Search className={`w-5 h-5 transition-all ${deepSearchEnabled ? 'stroke-[2.5px]' : ''}`} />
          </button>

          {/* Input Field */}
          <div
            className={`flex-1 flex items-center rounded-full px-4 min-h-[44px] bg-card transition-colors duration-300 ${
              deepSearchEnabled ? 'border border-primary ring-1 ring-primary/30' : 'border border-input'
            }`}
          >
            {deepSearchEnabled && (
              <span className="text-[11px] font-medium mr-2 px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                🔍
              </span>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={deepSearchEnabled ? "Web search enabled..." : "Message"}
              className="flex-1 text-[16px] bg-transparent outline-none text-foreground transition-colors placeholder:text-muted-foreground"
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="on"
            />
          </div>

          {/* Send/Mic/Stop Button */}
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-red-500 transition-colors active:opacity-70"
              title="Stop generation"
            >
              <Square className="w-5 h-5 text-white fill-white" />
            </button>
          ) : input.trim() ? (
            <button
              type="submit"
              disabled={isLoading}
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-primary transition-colors active:opacity-70"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMicClick}
              disabled={isTranscribing}
              className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition-all active:opacity-70 ${
                isRecording ? 'animate-pulse text-red-500 bg-red-500/10' : 'text-muted-foreground bg-transparent'
              }`}
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
          <div className="w-[134px] h-[5px] rounded-full bg-muted-foreground/20 transition-colors" />
        </div>
      </footer>
    </>
  );
}
