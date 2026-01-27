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
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
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
    <div className="bg-black text-white min-h-screen">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#1a1a1a] border-b border-white/10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-3 h-11">
          <Link href="/" className="p-1 text-blue-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs">🧠</div>
            <span className="font-medium text-sm">SoulPrint</span>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className="p-1 text-blue-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        </div>
        {showSettings && (
          <div className="px-3 pb-2 flex gap-2">
            <Link href="/import" className="flex-1 h-8 bg-white/10 rounded text-xs flex items-center justify-center">Re-import</Link>
            <button onClick={handleSignOut} className="flex-1 h-8 bg-white/10 rounded text-red-500 text-xs">Sign Out</button>
          </div>
        )}
      </header>

      {/* Scrollable content - messages anchored to bottom like iMessage */}
      <main 
        className="flex flex-col min-h-screen px-3" 
        style={{ 
          paddingTop: 'calc(env(safe-area-inset-top) + 52px)', 
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)' 
        }}
      >
        <div className="flex-1" /> {/* Spacer pushes messages down */}
        <div className="space-y-2 max-w-xl mx-auto w-full">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-1.5 text-sm leading-snug ${
                msg.role === 'user' ? 'bg-blue-500 rounded-2xl rounded-br-sm' : 'bg-zinc-800 rounded-2xl rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-1" />
        </div>
      </main>

      {/* Fixed Input */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1a] border-t border-white/10 px-3 py-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={scrollToBottom}
            placeholder="Message"
            className="flex-1 h-9 bg-zinc-800 rounded-full px-3 text-sm outline-none placeholder:text-zinc-500"
            style={{ fontSize: '16px' }}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" disabled={!input.trim() || isLoading} className="w-9 h-9 rounded-full bg-orange-500 disabled:opacity-40 flex items-center justify-center">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
