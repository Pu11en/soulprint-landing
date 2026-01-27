'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: "Hey! I'm your AI with memory. I can recall your past conversations and context to give you more personalized help. What would you like to talk about?",
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasMemoryContext, setHasMemoryContext] = useState(false);
  const [memoryChunksUsed, setMemoryChunksUsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    const currentInput = input.trim();
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setHasMemoryContext(false);
    setMemoryChunksUsed(0);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    // Prepare history (exclude the initial message and current message)
    const history = messages
      .filter(m => m.id !== '1')
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          history,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantMessageId = (Date.now() + 1).toString();

      // Add empty assistant message that we'll stream into
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'metadata') {
              setHasMemoryContext(data.hasMemoryContext);
              setMemoryChunksUsed(data.memoryChunksUsed || 0);
            } else if (data.type === 'text') {
              assistantContent += data.text;
              setMessages(prev => prev.map(m => 
                m.id === assistantMessageId 
                  ? { ...m, content: assistantContent }
                  : m
              ));
            } else if (data.type === 'error') {
              console.error('Stream error:', data.error);
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Chat error:', error);
        // Add error message
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'm sorry, I had trouble processing that. Please try again.",
        }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <main className="h-screen bg-[#09090B] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-white/[0.06] bg-[#09090B]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="logo">
            <img src="/logo.svg" alt="SoulPrint" className="w-6 h-6" />
            <span className="text-white text-base">SoulPrint</span>
          </Link>
          
          <div className="flex items-center gap-2">
            {/* Memory indicator */}
            {hasMemoryContext && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-xs text-orange-400 font-medium">
                  {memoryChunksUsed} memor{memoryChunksUsed === 1 ? 'y' : 'ies'}
                </span>
              </div>
            )}
            <Link href="/import" className="btn btn-ghost btn-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="hidden sm:inline">Import</span>
            </Link>
            <button className="btn btn-ghost btn-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in`}
            >
              {message.role === 'assistant' && (
                <div className="flex items-start gap-3 max-w-[85%] md:max-w-[75%]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <img src="/logo.svg" alt="" className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1.5 font-medium">SoulPrint</div>
                    <div className="chat-assistant">
                      <p className="text-gray-200 whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              )}
              {message.role === 'user' && (
                <div className="chat-user max-w-[85%] md:max-w-[75%]">
                  <p className="text-gray-200 whitespace-pre-wrap">{message.content}</p>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start animate-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                  <img src="/logo.svg" alt="" className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1.5 font-medium">SoulPrint</div>
                  <div className="chat-assistant">
                    <div className="typing-indicator">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#09090B]">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-4">
          <div className="card p-2 flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message SoulPrint..."
              rows={1}
              className="flex-1 bg-transparent text-white text-[15px] resize-none outline-none px-3 py-2.5 max-h-32 placeholder:text-gray-600"
              style={{ minHeight: '44px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="btn btn-primary p-2.5 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="text-center text-xs text-gray-600 mt-3">
            SoulPrint can make mistakes. Consider checking important information.
          </p>
        </form>
      </div>
    </main>
  );
}
