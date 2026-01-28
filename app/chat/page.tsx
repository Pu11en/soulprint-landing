'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { showAchievementToasts } from '@/components/AchievementToast';
import type { Achievement } from '@/lib/gamification/xp';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [aiName, setAiName] = useState<string | null>(null);
  const [aiAvatar, setAiAvatar] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isNamingMode, setIsNamingMode] = useState(false);
  const [isAvatarPromptMode, setIsAvatarPromptMode] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Check if should show PWA install prompt (iOS Safari, not standalone)
  useEffect(() => {
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    
    if (isIos && !isStandalone && !dismissed) {
      // Show after 3 seconds, auto-hide after 8 seconds
      const showTimer = setTimeout(() => setShowPwaPrompt(true), 3000);
      const hideTimer = setTimeout(() => {
        setShowPwaPrompt(false);
        localStorage.setItem('pwa-prompt-dismissed', 'true');
      }, 11000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  // iOS keyboard handling
  useEffect(() => {
    // Use visualViewport for keyboard detection
    const updateKeyboard = () => {
      if (window.visualViewport) {
        const keyboardH = window.innerHeight - window.visualViewport.height;
        setKeyboardHeight(Math.max(0, keyboardH));
      }
    };

    window.visualViewport?.addEventListener('resize', updateKeyboard);
    window.visualViewport?.addEventListener('scroll', updateKeyboard);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboard);
      window.visualViewport?.removeEventListener('scroll', updateKeyboard);
    };
  }, []);

  // Scroll when messages change (not on keyboard - causes jank)
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (!win.webkitSpeechRecognition && !win.SpeechRecognition) {
      alert('Speech recognition not supported');
      return;
    }
    
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    let finalTranscript = input; // Start with existing text
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if we didn't manually stop (handles browser timeouts)
      if (recognitionRef.current && !recognitionRef.current._manualStop) {
        try {
          recognition.start();
        } catch {
          // Already started or other error
        }
      }
    };
    recognition.onerror = (e: { error: string }) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setIsListening(false);
      }
    };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Show final + interim
      setInput(finalTranscript + (interimTranscript ? ' ' + interimTranscript : ''));
    };
    
    recognitionRef.current = recognition;
    recognitionRef.current._manualStop = false;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current._manualStop = true;
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const clearVoiceInput = () => {
    stopListening();
    setInput('');
  };

  const handleRename = async () => {
    if (!renameInput.trim()) return;
    
    try {
      const res = await fetch('/api/profile/ai-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameInput.trim() }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setAiName(data.aiName);
        setShowRenameModal(false);
        setRenameInput('');
      }
    } catch {
      // Handle error silently
    }
  };

  // Function to generate avatar - returns true on success, false on failure
  const generateAvatar = async (customPrompt?: string): Promise<boolean> => {
    setIsGeneratingAvatar(true);
    try {
      const res = await fetch('/api/profile/ai-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAvatar(data.avatarUrl);
        setIsGeneratingAvatar(false);
        return true;
      }
    } catch {
      console.error('Failed to generate avatar');
    }
    setIsGeneratingAvatar(false);
    return false;
  };

  useEffect(() => {
    const loadChatState = async () => {
      try {
        // Check if AI has a name and avatar
        const [nameRes, avatarRes] = await Promise.all([
          fetch('/api/profile/ai-name'),
          fetch('/api/profile/ai-avatar'),
        ]);
        
        let loadedAiName: string | null = null;
        if (nameRes.ok) {
          const nameData = await nameRes.json();
          if (nameData.aiName) {
            loadedAiName = nameData.aiName;
            setAiName(nameData.aiName);
          } else {
            // No name yet - start naming flow
            setIsNamingMode(true);
            setMessages([{ 
              id: 'intro', 
              role: 'assistant', 
              content: "Hey! I'm your new AI — built from your memories and conversations. Before we get started, I need a name. What would you like to call me?" 
            }]);
            setLoadingHistory(false);
            return;
          }
        }

        // Load avatar (if exists)
        let hasAvatar = false;
        if (avatarRes.ok) {
          const avatarData = await avatarRes.json();
          if (avatarData.avatarUrl) {
            setAiAvatar(avatarData.avatarUrl);
            hasAvatar = true;
          }
        }

        // Load chat history
        const res = await fetch('/api/chat/messages?limit=100');
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length > 0) {
            setMessages(data.messages);
          } else {
            const name = loadedAiName || 'your AI';
            setMessages([{ id: 'welcome', role: 'assistant', content: `Hey! I'm ${name}. I've got your memories loaded. What's on your mind?` }]);
          }
        }
      } catch {
        setMessages([{ id: 'welcome', role: 'assistant', content: "Hey! I've got your memories loaded. What's on your mind?" }]);
      }
      setLoadingHistory(false);
    };
    loadChatState();
  }, []);

  useEffect(() => {
    if (!loadingHistory) scrollToBottom();
  }, [loadingHistory]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Hard reload to clear all state
    window.location.href = '/login';
  };

  const saveMessage = async (role: string, content: string) => {
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });
    } catch {}
  };

  // Award XP for user actions
  const awardXP = async (action: 'message' | 'memory' | 'daily') => {
    try {
      const res = await fetch('/api/gamification/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        // Show achievement toasts if any were unlocked
        if (data.newAchievements?.length > 0) {
          showAchievementToasts(data.newAchievements as Achievement[]);
        }
      }
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    
    // Keep focus to prevent keyboard from closing/reopening (causes flicker)
    inputRef.current?.focus();
    
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userContent }]);
    setInput('');
    setIsLoading(true);

    // Handle naming mode
    if (isNamingMode) {
      try {
        const res = await fetch('/api/profile/ai-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: userContent }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setAiName(data.aiName);
          setIsNamingMode(false);
          
          // Skip avatar, go straight to ready state
          setMessages(prev => [...prev, { 
            id: (Date.now() + 1).toString(), 
            role: 'assistant', 
            content: `${data.aiName}. I like it! 💫\n\nI'm ready when you are. I've got your memories loaded — ask me anything, or just tell me what's on your mind.`
          }]);
          
          // Save the intro messages to history
          saveMessage('assistant', "Hey! I'm your new AI — built from your memories and conversations. Before we get started, I need a name. What would you like to call me?");
          saveMessage('user', userContent);
          saveMessage('assistant', `${data.aiName}. I like it! 💫\n\nI'm ready when you are. I've got your memories loaded — ask me anything, or just tell me what's on your mind.`);
        } else {
          setMessages(prev => [...prev, { 
            id: (Date.now() + 1).toString(), 
            role: 'assistant', 
            content: "Hmm, I couldn't save that name. Try again?"
          }]);
        }
      } catch {
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: "Something went wrong. Try giving me a name again?"
        }]);
      }
      setIsLoading(false);
      return;
    }

    // Handle avatar prompt mode
    if (isAvatarPromptMode) {
      const answer = userContent.toLowerCase();
      const isYes = answer.includes('yes') || answer.includes('yeah') || answer.includes('sure') || answer.includes('ok') || answer.includes('yep') || answer.includes('yea') || answer.includes('go ahead') || answer === 'y';
      
      setIsAvatarPromptMode(false);
      
      if (isYes) {
        // Generate avatar
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: `Give me a moment... ✨`
        }]);
        saveMessage('user', userContent);
        saveMessage('assistant', `Give me a moment... ✨`);
        
        const success = await generateAvatar();
        
        if (success) {
          setMessages(prev => [...prev, { 
            id: (Date.now() + 2).toString(), 
            role: 'assistant', 
            content: `There we go! That's me now. 😊\n\nI'm ready when you are. I've got your memories loaded — ask me anything, or just tell me what's on your mind.`
          }]);
          saveMessage('assistant', `There we go! That's me now. 😊\n\nI'm ready when you are. I've got your memories loaded — ask me anything, or just tell me what's on your mind.`);
        } else {
          setMessages(prev => [...prev, { 
            id: (Date.now() + 2).toString(), 
            role: 'assistant', 
            content: `Hmm, something went wrong with my look. Say "try again" if you want me to give it another shot, or we can just skip it for now.`
          }]);
          saveMessage('assistant', `Hmm, something went wrong with my look. Say "try again" if you want me to give it another shot, or we can just skip it for now.`);
          setIsAvatarPromptMode(true); // Stay in mode to handle retry
        }
      } else {
        // Skip avatar
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: `No problem! I'm ready when you are. I've got your memories loaded — ask me anything, or just tell me what's on your mind.`
        }]);
        saveMessage('user', userContent);
        saveMessage('assistant', `No problem! I'm ready when you are. I've got your memories loaded — ask me anything, or just tell me what's on your mind.`);
      }
      
      setIsLoading(false);
      return;
    }

    // Regular chat flow
    saveMessage('user', userContent);
    awardXP('message'); // Award XP for sending a message

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userContent, history }),
      });

      if (!res.ok) throw new Error();
      const reader = res.body?.getReader();
      if (!reader) throw new Error();

      let content = '';
      const aiId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiId, role: 'assistant', content: '' }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n').filter(Boolean)) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'text') {
              content += data.text;
              setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content } : m));
            }
          } catch {}
        }
      }
      if (content) saveMessage('assistant', content);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Something went wrong.' }]);
    }
    setIsLoading(false);
  };

  if (loadingHistory) {
    return <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center text-white/50">Loading...</div>;
  }

  // Calculate heights
  const safeAreaTop = 'env(safe-area-inset-top, 0px)';
  const safeAreaBottom = 'env(safe-area-inset-bottom, 0px)';

  return (
    <div 
      className="bg-[#0e0e0e] text-white flex flex-col h-[100dvh] overflow-hidden"
    >
      {/* Header */}
      <header 
        className="flex-shrink-0 bg-[#0e0e0e]/95 backdrop-blur-lg z-20 border-b border-white/[0.06]"
        style={{ paddingTop: safeAreaTop }}
      >
        <div className="flex items-center px-5 sm:px-8 lg:px-10 h-[72px] max-w-5xl mx-auto">
          <div className="flex-1 flex items-center gap-4">
            <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xl lg:text-2xl shadow-lg shadow-orange-500/20 overflow-hidden">
              {aiAvatar ? (
                <img src={aiAvatar} alt={aiName || 'AI'} className="w-full h-full object-cover" />
              ) : isGeneratingAvatar ? (
                <div className="animate-pulse">✨</div>
              ) : (
                '🧠'
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-[18px] lg:text-xl tracking-[-0.02em]">{aiName || 'SoulPrint'}</span>
              <span className="text-[13px] lg:text-sm text-white/40 tracking-[-0.01em]">
                {isLoading ? 'typing...' : (aiName ? 'your AI' : 'your memory')}
              </span>
            </div>
          </div>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/achievements" className="text-sm text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1">🏆 XP</Link>
            <button onClick={() => { setRenameInput(aiName || ''); setShowRenameModal(true); }} className="text-sm text-white/60 hover:text-white transition-colors">Rename AI</button>
            <Link href="/memory" className="text-sm text-white/60 hover:text-white transition-colors">Memory</Link>
            <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors">Home</Link>
            <Link href="/import" className="text-sm text-white/60 hover:text-white transition-colors">Re-import</Link>
            <button onClick={handleSignOut} className="text-sm text-red-400 hover:text-red-300 transition-colors">Sign Out</button>
          </div>
          {/* Mobile menu button */}
          <button onClick={() => setShowSettings(!showSettings)} className="md:hidden p-2 -mr-2 text-orange-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>
        </div>
        {showSettings && (
          <div className="md:hidden px-5 pb-3 border-t border-white/5 pt-3 space-y-2">
            <Link href="/achievements" className="w-full h-10 bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg text-sm flex items-center justify-center font-medium text-orange-300 gap-2">🏆 Achievements & XP</Link>
            <div className="flex gap-2">
              <button onClick={() => { setRenameInput(aiName || ''); setShowRenameModal(true); setShowSettings(false); }} className="flex-1 h-10 bg-white/10 rounded-lg text-sm flex items-center justify-center font-medium">Rename AI</button>
              <Link href="/memory" className="flex-1 h-10 bg-white/10 rounded-lg text-sm flex items-center justify-center font-medium">Memory</Link>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="flex-1 h-10 bg-white/10 rounded-lg text-sm flex items-center justify-center font-medium">Home</Link>
              <Link href="/import" className="flex-1 h-10 bg-white/10 rounded-lg text-sm flex items-center justify-center font-medium">Re-import</Link>
            </div>
            <button onClick={handleSignOut} className="w-full h-10 bg-white/10 rounded-lg text-red-500 text-sm font-medium">Sign Out</button>
          </div>
        )}
      </header>

      {/* PWA Install Prompt - subtle bottom toast */}
      {showPwaPrompt && (
        <div 
          className="fixed left-4 right-4 z-50 bg-[#262628] border border-white/10 rounded-2xl px-4 py-3 shadow-xl animate-in bottom-24"
          onClick={() => {
            setShowPwaPrompt(false);
            localStorage.setItem('pwa-prompt-dismissed', 'true');
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📲</span>
            <p className="text-white/90 text-sm flex-1">
              <span className="font-medium">Install app:</span> Tap <span className="text-orange-400">Share</span> → <span className="text-orange-400">Add to Home Screen</span>
            </p>
            <span className="text-white/40 text-xs">tap to close</span>
          </div>
        </div>
      )}

      {/* Messages - scrollable area */}
      <main className="flex-1 overflow-y-auto overscroll-none px-5 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-end min-h-full">
          <div className="space-y-6 max-w-2xl mx-auto w-full py-6">
            {messages.map((msg) => (
              msg.role === 'user' ? (
                /* User Message - Right aligned, orange bubble */
                <div key={msg.id} className="flex flex-col items-end gap-1.5">
                  <div className="bg-[#f97415] text-white px-5 py-4 rounded-3xl rounded-tr-sm max-w-[85%] shadow-lg shadow-orange-500/20">
                    <p className="text-[15px] font-medium leading-normal whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                /* AI Message - Left aligned, no bubble */
                <div key={msg.id} className="flex gap-4 items-start max-w-[90%]">
                  <div className="w-8 h-8 shrink-0 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mt-1 overflow-hidden">
                    {aiAvatar ? (
                      <img src={aiAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm">✨</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-white/40 text-[11px] font-bold tracking-widest uppercase ml-1">{aiName || 'SoulPrint'}</p>
                    <div className="text-white text-[15px] font-normal leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                  </div>
                </div>
              )
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-4 items-start max-w-[90%] opacity-60">
                <div className="w-8 h-8 shrink-0 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mt-1 overflow-hidden">
                  {aiAvatar ? (
                    <img src={aiAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm">✨</span>
                  )}
                </div>
                <div className="flex gap-1.5 py-3">
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-8" />
          </div>
        </div>
      </main>

      {/* Footer - input bar (Stitch design) */}
      <footer 
        className="flex-shrink-0 backdrop-blur-xl bg-[#0e0e0e]/80 border-t border-white/10 px-5 py-4 sm:px-8"
        style={{ paddingBottom: `calc(${safeAreaBottom} + 20px)` }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-4 max-w-2xl mx-auto">
          {/* Input with mic button inside */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening..." : "Whisper something..."}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-full pl-6 pr-14 text-white text-center placeholder:text-center placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#f97415] focus:border-transparent transition-all"
              autoComplete="off"
              enterKeyHint="send"
            />
            {/* Mic button inside input */}
            <button 
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isListening ? 'text-red-500' : 'text-white/30 hover:text-white'}`}
            >
              {isListening ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V19h4v2H8v-2h4v-3.07z"/>
                </svg>
              )}
            </button>
          </div>
          
          {/* Send button */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-14 h-14 bg-[#f97415] text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 active:scale-95 transition-transform disabled:opacity-40"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </form>
        
        {/* Safe area spacer */}
        <div className="h-2" />
      </footer>

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setShowRenameModal(false)}>
          <div className="bg-[#1c1c1d] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Rename your AI</h3>
            <input
              type="text"
              value={renameInput}
              onChange={e => setRenameInput(e.target.value)}
              placeholder="Enter a new name"
              className="w-full h-12 bg-[#2c2c2e] rounded-xl px-4 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 mb-4"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); }}
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRenameModal(false)}
                className="flex-1 h-11 bg-white/10 rounded-xl text-white/70 font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleRename}
                disabled={!renameInput.trim()}
                className="flex-1 h-11 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white font-medium disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
