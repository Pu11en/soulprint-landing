'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  memoriesUsed?: number;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: "Hey! I've got your memories loaded. What's on your mind?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check auth
  useEffect(() => {
    fetch('/api/memory/status').then(r => r.json()).then(data => {
      if (data.status === 'ready') {
        setMessages([{ id: '1', role: 'assistant', content: "Hey! I've got your memories loaded. What's on your mind?" }]);
      } else {
        setMessages([{ id: '1', role: 'assistant', content: "Hey! Import your ChatGPT history so I can remember everything about you." }]);
      }
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, history }),
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
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Something went wrong. Try again.' }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[#000000]">
      {/* iMessage Header */}
      <div className="flex-shrink-0 bg-[#1c1c1e] border-b border-[#38383a] px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <Link href="/" className="text-[#0a84ff] text-[17px]">
          ‹
        </Link>
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-1">
            <span className="text-white text-lg">🧠</span>
          </div>
          <span className="text-white text-[13px] font-semibold">SoulPrint</span>
        </div>
        <Link href="/import" className="text-[#0a84ff] text-[24px]">
          ⋯
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-lg mx-auto space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-[#0a84ff] text-white rounded-[20px] rounded-br-[4px]'
                    : 'bg-[#3a3a3c] text-white rounded-[20px] rounded-bl-[4px]'
                }`}
              >
                <p className="text-[16px] leading-[22px] whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#3a3a3c] rounded-[20px] rounded-bl-[4px] px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* iMessage Input */}
      <div className="flex-shrink-0 bg-[#1c1c1e] border-t border-[#38383a] px-3 py-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 bg-[#3a3a3c] rounded-full px-4 py-2 flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="iMessage"
              className="flex-1 bg-transparent text-white text-[16px] outline-none placeholder:text-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-full bg-[#0a84ff] disabled:bg-[#3a3a3c] flex items-center justify-center flex-shrink-0"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
