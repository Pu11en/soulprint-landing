'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  memoriesUsed?: number;
};

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: "Hey! I'm your AI with memory. I can recall your past conversations and context to give you more personalized help. What would you like to talk about?",
    memoriesUsed: 0,
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    setInput('');
    setIsLoading(true);

    // TODO: Replace with real API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: "I understand! Based on our previous conversations, I can provide more contextual responses. This is a demo response — once you connect your import, I'll have full context of your history.",
      memoriesUsed: 5,
    };

    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <main className="h-screen bg-[#09090B] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 xl:w-80 border-r border-white/[0.06] bg-[#09090B]">
        {/* Sidebar Header */}
        <div className="p-4 xl:p-6 border-b border-white/[0.06]">
          <Link href="/" className="logo">
            <img src="/logo.svg" alt="SoulPrint" className="w-7 h-7" />
            <span className="text-white text-lg">SoulPrint</span>
          </Link>
        </div>
        
        {/* New Chat Button */}
        <div className="p-4 xl:p-6">
          <button className="btn btn-secondary w-full justify-start gap-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
        
        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-4 xl:px-6">
          <div className="text-micro text-gray-600 mb-3">Recent</div>
          <div className="space-y-1">
            {['Next.js deployment help', 'React patterns discussion', 'API design questions'].map((chat, i) => (
              <button
                key={i}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/[0.03] hover:text-gray-200 transition-colors truncate"
              >
                {chat}
              </button>
            ))}
          </div>
        </div>
        
        {/* Sidebar Footer */}
        <div className="p-4 xl:p-6 border-t border-white/[0.06]">
          <Link href="/import" className="btn btn-ghost w-full justify-start gap-3 text-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Memory
          </Link>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-white/[0.06] bg-[#09090B]/80 backdrop-blur-xl">
          <div className="px-4 lg:px-8 h-14 lg:h-16 flex items-center justify-between">
            {/* Mobile Logo */}
            <Link href="/" className="logo lg:hidden">
              <img src="/logo.svg" alt="SoulPrint" className="w-6 h-6" />
              <span className="text-white text-base">SoulPrint</span>
            </Link>
            
            {/* Desktop: Chat Title */}
            <div className="hidden lg:block">
              <h1 className="text-lg font-medium text-white">Chat</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <Link href="/import" className="btn btn-ghost btn-sm lg:hidden">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
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
          <div className="max-w-3xl lg:max-w-4xl mx-auto px-4 lg:px-8 py-8 lg:py-12 space-y-6 lg:space-y-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in`}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-start gap-3 lg:gap-4 max-w-[85%] lg:max-w-[80%]">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                      <img src="/logo.svg" alt="" className="w-5 h-5 lg:w-6 lg:h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs lg:text-sm text-gray-500 font-medium">SoulPrint</span>
                        {message.memoriesUsed && message.memoriesUsed > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-xs">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {message.memoriesUsed} memories
                          </span>
                        )}
                      </div>
                      <div className="chat-assistant lg:text-base">
                        <p className="text-gray-200">{message.content}</p>
                      </div>
                    </div>
                  </div>
                )}
                {message.role === 'user' && (
                  <div className="chat-user max-w-[85%] lg:max-w-[80%] lg:text-base">
                    <p className="text-gray-200">{message.content}</p>
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start animate-in">
                <div className="flex items-start gap-3 lg:gap-4">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <img src="/logo.svg" alt="" className="w-5 h-5 lg:w-6 lg:h-6" />
                  </div>
                  <div>
                    <div className="text-xs lg:text-sm text-gray-500 mb-1.5 font-medium">SoulPrint</div>
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
          <form onSubmit={handleSubmit} className="max-w-3xl lg:max-w-4xl mx-auto px-4 lg:px-8 py-4 lg:py-6">
            <div className="card p-2 lg:p-3 flex items-end gap-2 lg:gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message SoulPrint..."
                rows={1}
                className="flex-1 bg-transparent text-white text-[15px] lg:text-base resize-none outline-none px-3 py-2.5 lg:py-3 max-h-32 placeholder:text-gray-600"
                style={{ minHeight: '44px' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="btn btn-primary p-2.5 lg:p-3 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              >
                <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs lg:text-sm text-gray-600 mt-3">
              SoulPrint can make mistakes. Consider checking important information.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
