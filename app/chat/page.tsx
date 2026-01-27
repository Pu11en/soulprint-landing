'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  memoriesUsed?: number;
};

type MemoryStatus = 'loading' | 'none' | 'pending' | 'ready';

const getInitialMessage = (status: MemoryStatus): Message => {
  if (status === 'ready') {
    return {
      id: '1',
      role: 'assistant',
      content: "Hey! I've loaded your memory — I know your context, preferences, and history. What would you like to talk about?",
    };
  }
  return {
    id: '1',
    role: 'assistant',
    content: "Hey! I'm your AI with memory. Import your ChatGPT export and I'll know everything about you.",
  };
};

export default function ChatPage() {
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Check memory status
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

  // Handle iOS keyboard
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const viewport = window.visualViewport;
    
    const handleResize = () => {
      const keyboardHeight = window.innerHeight - viewport.height;
      setBottomOffset(keyboardHeight);
      
      // Scroll to bottom of messages
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 10);
    };

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);
    
    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    
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

      if (!response.ok) throw new Error('Failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No body');

      let aiContent = '';
      let memoriesUsed = 0;
      const aiMessageId = (Date.now() + 1).toString();

      setMessages(prev => [...prev, { id: aiMessageId, role: 'assistant', content: '' }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n').filter(Boolean)) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'metadata') {
              memoriesUsed = data.memoryChunksUsed || 0;
            } else if (data.type === 'text') {
              aiContent += data.text;
              setMessages(prev => prev.map(m =>
                m.id === aiMessageId ? { ...m, content: aiContent, memoriesUsed } : m
              ));
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong.',
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

  return (
    <div className="fixed inset-0 bg-[#0A0A0B] flex flex-col">
      {/* FIXED HEADER */}
      <header className="flex-shrink-0 h-14 bg-[#0A0A0B] border-b border-white/10 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <img src="/logo.svg" alt="" className="w-4 h-4" />
          </div>
          <span className="text-white font-semibold">SoulPrint</span>
          {memoryStatus === 'ready' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Memory Active</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/import" className="p-2 text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </Link>
          <Link href="/api/auth/signout" className="p-2 text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </Link>
        </div>
      </header>

      {/* SCROLLABLE MESSAGES */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: bottomOffset > 0 ? bottomOffset : undefined }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' ? (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <img src="/logo.svg" alt="" className="w-4 h-4" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5">
                    <p className="text-[15px] text-gray-200 whitespace-pre-wrap">{message.content}</p>
                    {message.memoriesUsed && message.memoriesUsed > 0 && (
                      <p className="text-[11px] text-orange-400 mt-1">{message.memoriesUsed} memories used</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-[85%]">
                  <div className="bg-orange-500 rounded-2xl rounded-tr-sm px-4 py-2.5">
                    <p className="text-[15px] text-white whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                <img src="/logo.svg" alt="" className="w-4 h-4" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* FIXED INPUT */}
      <div 
        className="flex-shrink-0 bg-[#0A0A0B] border-t border-white/10 p-3"
        style={{ paddingBottom: Math.max(12, bottomOffset) }}
      >
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-[15px] placeholder:text-gray-500 resize-none outline-none focus:border-orange-500/50"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-12 h-12 rounded-full bg-orange-500 hover:bg-orange-400 disabled:bg-white/10 disabled:opacity-50 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
