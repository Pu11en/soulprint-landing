'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Sparkles } from 'lucide-react';
import { MessageContent } from './message-content';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

interface FloatingChatProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  aiName?: string;
  aiAvatar?: string;
}

export function FloatingChat({ 
  messages, 
  onSendMessage, 
  isLoading,
  aiName = 'SoulPrint',
  aiAvatar
}: FloatingChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Floating Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-black/30 border-b border-white/10 safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          {aiAvatar ? (
            <img src={aiAvatar} alt={aiName} className="w-10 h-10 rounded-full ring-2 ring-orange-500/50" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h1 className="font-semibold text-white">{aiName}</h1>
            <p className="text-xs text-white/50">Always here for you</p>
          </div>
        </div>
      </header>

      {/* Messages - Floating in the Void */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-float-in`}
            style={{ 
              animationDelay: `${index * 0.05}s`,
            }}
          >
            <div
              className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-sm ${
                message.role === 'user'
                  ? 'bg-orange-500 text-white rounded-br-md'
                  : 'bg-white/10 text-white border border-white/10 rounded-bl-md'
              }`}
              style={{
                boxShadow: message.role === 'user' 
                  ? '0 8px 32px rgba(234, 88, 12, 0.3)' 
                  : '0 8px 32px rgba(0, 0, 0, 0.5)',
              }}
            >
              <MessageContent content={message.content} textColor="#FFFFFF" />
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start animate-float-in">
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Floating Input */}
      <footer className="sticky bottom-0 z-20 safe-bottom">
        <div className="px-4 pb-4 pt-2">
          <div className="flex items-end gap-2 backdrop-blur-xl bg-black/50 rounded-2xl border border-white/10 p-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              rows={1}
              className="flex-1 bg-transparent text-white placeholder-white/40 resize-none outline-none px-3 py-2 max-h-32"
              style={{ minHeight: '40px' }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="p-3 rounded-xl bg-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-orange-600 hover:scale-105 active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>

      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes float-in {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .animate-float-in {
          animation: float-in 0.4s ease-out forwards;
          opacity: 0;
        }

        .safe-top {
          padding-top: env(safe-area-inset-top);
        }
        
        .safe-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  );
}
