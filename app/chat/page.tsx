'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  };

  // Handle iOS keyboard - lock footer position
  useEffect(() => {
    const handleViewport = () => {
      if (!window.visualViewport) return;
      
      const viewport = window.visualViewport;
      
      // Resize container to visual viewport
      if (containerRef.current) {
        containerRef.current.style.height = `${viewport.height}px`;
      }
      
      // Lock footer to bottom of visual viewport
      if (footerRef.current) {
        const bottomOffset = window.innerHeight - viewport.height - viewport.offsetTop;
        footerRef.current.style.transform = `translateY(-${bottomOffset}px)`;
      }
      
      setTimeout(scrollToBottom, 50);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewport);
      window.visualViewport.addEventListener('scroll', handleViewport);
      handleViewport();
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewport);
        window.visualViewport.removeEventListener('scroll', handleViewport);
      }
    };
  }, []);

  const startListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (!win.webkitSpeechRecognition && !win.SpeechRecognition) {
      alert('Speech recognition not supported in this browser');
      return;
    }
    
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((result: any) => result[0].transcript)
        .join('');
      setInput(transcript);
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const res = await fetch('/api/chat/messages?limit=100');
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length > 0) {
            setMessages(data.messages);
          } else {
            setMessages([{ id: 'welcome', role: 'assistant', content: "Hey! I've got your memories loaded. What's on your mind?" }]);
          }
        }
      } catch {
        setMessages([{ id: 'welcome', role: 'assistant', content: "Hey! I've got your memories loaded. What's on your mind?" }]);
      }
      setLoadingHistory(false);
    };
    loadMessages();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || null));
  }, []);

  useEffect(() => {
    if (!loadingHistory) scrollToBottom();
  }, [messages, loadingHistory]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userContent }]);
    setInput('');
    // Keep keyboard open by refocusing input
    setTimeout(() => inputRef.current?.focus(), 0);
    setIsLoading(true);
    saveMessage('user', userContent);
    scrollToBottom();

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
              scrollToBottom();
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
    return <div className="min-h-screen bg-black flex items-center justify-center text-white/50">Loading...</div>;
  }

  return (
    <div ref={containerRef} className="bg-[#0e0e0e] text-white h-[100dvh] flex flex-col overflow-hidden">
      {/* Fixed Header - Telegram style */}
      <header className="flex-shrink-0 bg-[#1c1c1d]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center px-4 h-16">
          <div className="flex-1 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-lg shadow-lg">
              🧠
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-[17px] leading-tight">SoulPrint</span>
              <span className="text-[13px] text-orange-500/80 leading-tight">
                {isLoading ? 'typing...' : 'your memory'}
              </span>
            </div>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 -mr-2 text-orange-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>
        </div>
        {showSettings && (
          <div className="px-4 pb-3 flex gap-2 border-t border-white/5 pt-2">
            <Link href="/" className="flex-1 h-9 bg-white/10 rounded-lg text-sm flex items-center justify-center font-medium">Home</Link>
            <Link href="/import" className="flex-1 h-9 bg-white/10 rounded-lg text-sm flex items-center justify-center font-medium">Re-import</Link>
            <button onClick={handleSignOut} className="flex-1 h-9 bg-white/10 rounded-lg text-red-500 text-sm font-medium">Sign Out</button>
          </div>
        )}
      </header>

      {/* Scrollable messages area */}
      <main ref={messagesRef} className="flex-1 overflow-y-auto px-4 flex flex-col">
        <div className="flex-1" />
        <div className="space-y-3 max-w-2xl mx-auto w-full py-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-[20px] rounded-br-[4px]' 
                    : 'bg-[#262628] text-white/90 rounded-[20px] rounded-bl-[4px]'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-[#262628] rounded-[20px] rounded-bl-[4px] px-4 py-3 flex gap-1.5">
                <span className="w-2 h-2 bg-orange-500/60 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-orange-500/60 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-2 h-2 bg-orange-500/60 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-1" />
        </div>
      </main>

      {/* Input - stays at bottom */}
      <footer 
        ref={footerRef}
        className="flex-shrink-0 bg-[#1c1c1d] border-t border-white/5 px-4 py-3" 
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className={`flex-1 flex items-center bg-[#2c2c2e] rounded-full px-4 transition-all ${isListening ? 'ring-2 ring-orange-500/50' : ''}`}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setTimeout(scrollToBottom, 100)}
              placeholder={isListening ? "Listening..." : "Message"}
              className="flex-1 h-11 bg-transparent text-[16px] outline-none placeholder:text-white/30"
              autoComplete="off"
              enterKeyHint="send"
            />
          </div>
          {input.trim() ? (
            <button 
              type="submit" 
              disabled={isLoading} 
              className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 disabled:opacity-40 flex items-center justify-center shadow-lg shadow-orange-500/20 active:scale-95 transition-transform"
            >
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          ) : (
            <button 
              type="button" 
              onClick={isListening ? stopListening : startListening}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isListening 
                  ? 'bg-red-500 shadow-lg shadow-red-500/30 animate-pulse' 
                  : 'bg-[#2c2c2e] text-white/60'
              }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V19h4v2H8v-2h4v-3.07z"/>
              </svg>
            </button>
          )}
        </form>
      </footer>
    </div>
  );
}
