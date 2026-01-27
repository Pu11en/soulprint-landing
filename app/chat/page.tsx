'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  memoriesUsed?: number;
  method?: string;
};

type MemoryStatus = 'loading' | 'none' | 'pending' | 'ready';

const getInitialMessage = (status: MemoryStatus): Message => {
  if (status === 'ready') {
    return {
      id: '1',
      role: 'assistant',
      content: "Hey! I've loaded your memory — I know your context, preferences, and history. What would you like to talk about?",
      memoriesUsed: 0,
    };
  }
  return {
    id: '1',
    role: 'assistant',
    content: "Hey! I'm your AI with memory. Import your ChatGPT export and I'll know everything about you.",
    memoriesUsed: 0,
  };
};

export default function ChatPage() {
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const checkMemoryStatus = async () => {
      try {
        const res = await fetch('/api/memory/status');
        const data = await res.json();
        setMemoryStatus(data.status || 'none');
        setMessages([getInitialMessage(data.status || 'none')]);
      } catch {
        setMemoryStatus('none');
        setMessages([getInitialMessage('none')]);
      }
    };
    checkMemoryStatus();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, history }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let aiContent = '';
      let memoriesUsed = 0;
      let method = '';
      const aiMessageId = (Date.now() + 1).toString();

      setMessages(prev => [...prev, {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        memoriesUsed: 0,
      }]);

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'metadata') {
              memoriesUsed = data.memoryChunksUsed || 0;
              method = data.method || '';
            } else if (data.type === 'text') {
              aiContent += data.text;
              setMessages(prev => prev.map(m => 
                m.id === aiMessageId 
                  ? { ...m, content: aiContent, memoriesUsed, method }
                  : m
              ));
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        memoriesUsed: 0,
      }]);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  return (
    <main className="h-screen bg-[#0A0A0B] flex overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-[280px] xl:w-[320px] border-r border-white/[0.08] bg-[#0A0A0B]">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/[0.08]">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <img src="/logo.svg" alt="SoulPrint" className="w-5 h-5" />
            </div>
            <span className="text-[17px] font-semibold text-white tracking-tight">SoulPrint</span>
          </Link>
        </div>
        
        {/* New Chat */}
        <div className="p-4">
          <button 
            onClick={() => {
              setMessages([getInitialMessage(memoryStatus)]);
              setInput('');
            }}
            className="w-full h-11 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] text-white text-sm font-medium flex items-center justify-center gap-2.5 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
        
        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-3">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider px-3 mb-2">Recent</div>
          <div className="space-y-0.5">
            {['Building AI news platform', 'Twitter automation flow', 'Logo design feedback'].map((chat, i) => (
              <button
                key={i}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all duration-150 ${
                  i === 0 
                    ? 'bg-white/[0.06] text-white' 
                    : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
                }`}
              >
                <span className="line-clamp-1">{chat}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/[0.08]">
          <Link 
            href="/import" 
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all duration-150"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Re-import Memory
          </Link>
          <Link 
            href="/api/auth/signout" 
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-gray-400 hover:text-red-400 hover:bg-red-500/[0.05] transition-all duration-150"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign Out
          </Link>
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
              D
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-white font-medium truncate">Drew</div>
              <div className="text-[11px] text-gray-500">Free plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 flex-shrink-0 border-b border-white/[0.08] bg-[#0A0A0B] flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {/* Mobile Logo */}
            <Link href="/" className="flex items-center gap-2.5 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <img src="/logo.svg" alt="SoulPrint" className="w-4 h-4" />
              </div>
              <span className="text-base font-semibold text-white">SoulPrint</span>
            </Link>
            
            {/* Desktop Title */}
            <div className="hidden lg:flex items-center gap-3">
              <h1 className="text-[15px] font-medium text-white">New conversation</h1>
              {memoryStatus === 'ready' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Memory active
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/import" className="lg:hidden p-2 rounded-lg hover:bg-white/[0.05] text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </Link>
            <button className="p-2 rounded-lg hover:bg-white/[0.05] text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Memory Banner */}
        {showBanner && memoryStatus !== 'ready' && memoryStatus !== 'loading' && (
          <div className="flex-shrink-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-b border-orange-500/20">
            <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] text-white font-medium">Import your ChatGPT history</p>
                  <p className="text-[13px] text-gray-400 mt-0.5">Your AI will remember everything about you</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/import" className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-[13px] font-medium transition-colors">
                  Import now
                </Link>
                <button 
                  onClick={() => setShowBanner(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                {message.role === 'assistant' ? (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20">
                    <img src="/logo.svg" alt="" className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold">
                    D
                  </div>
                )}
                
                {/* Message */}
                <div className={`flex-1 min-w-0 ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                  <div className={`flex items-center gap-2 mb-1.5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[13px] text-gray-500 font-medium">
                      {message.role === 'assistant' ? 'SoulPrint' : 'You'}
                    </span>
                    {message.role === 'assistant' && message.memoriesUsed && message.memoriesUsed > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[11px] font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {message.memoriesUsed} memories
                      </span>
                    )}
                  </div>
                  <div 
                    className={`rounded-2xl px-4 py-3 ${
                      message.role === 'assistant' 
                        ? 'bg-white/[0.03] border border-white/[0.06] text-gray-200' 
                        : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white'
                    } ${message.role === 'user' ? 'max-w-[85%]' : ''}`}
                  >
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading */}
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20">
                  <img src="/logo.svg" alt="" className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] text-gray-500 font-medium mb-1.5">SoulPrint</div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 inline-block">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-white/[0.08] bg-[#0A0A0B] p-6">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-2xl focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/20 transition-all duration-200">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message SoulPrint..."
                rows={1}
                className="w-full bg-transparent text-white text-[15px] resize-none outline-none px-5 py-4 pr-14 min-h-[56px] max-h-[200px] placeholder:text-gray-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-3 bottom-3 w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-white/[0.05] disabled:opacity-50 flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <p className="text-center text-[12px] text-gray-600 mt-3">
              SoulPrint may make mistakes. Verify important information.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
