'use client';

import { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const sampleMessages: Message[] = [
  { id: '1', role: 'assistant', content: "Hey! I'm your AI — built from your memories. What's on your mind?" },
  { id: '2', role: 'user', content: "Tell me something I talked about last week" },
  { id: '3', role: 'assistant', content: "You mentioned wanting to start a morning routine — wake up at 6am, meditate, then work on SoulPrint before the day gets busy. You seemed excited about it." },
  { id: '4', role: 'user', content: "Oh yeah! Did I actually do it?" },
  { id: '5', role: 'assistant', content: "Based on our chats... you tried it twice. 😅 But hey, that's two more times than before. Want to give it another shot tomorrow?" },
];

export default function GlassmorphicChat() {
  const [messages, setMessages] = useState<Message[]>(sampleMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // Simulate response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "This is a demo response. The glassmorphic UI is looking clean! ✨",
      }]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Ambient gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-500/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-[150px]" />
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-orange-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-pink-500/15 rounded-full blur-[100px]" />
      </div>

      {/* Glass header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/[0.02] border-b border-white/[0.08]">
        <div className="flex items-center px-6 h-20 max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/30">
                ✨
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0a0a0f]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white/90 tracking-tight">SoulPrint</h1>
              <p className="text-sm text-white/40">your memory, amplified</p>
            </div>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <main className="relative z-10 px-4 sm:px-6 pb-32 pt-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`relative max-w-[85%] sm:max-w-[75%] px-5 py-4 rounded-3xl ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-orange-500/20 to-pink-500/20 backdrop-blur-xl border border-orange-400/20 shadow-lg shadow-orange-500/10'
                    : 'bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] shadow-lg shadow-purple-500/5'
                } ${msg.role === 'user' ? 'rounded-br-lg' : 'rounded-bl-lg'}`}
              >
                {/* Subtle inner glow */}
                <div
                  className={`absolute inset-0 rounded-3xl ${
                    msg.role === 'user' ? 'rounded-br-lg' : 'rounded-bl-lg'
                  } bg-gradient-to-br ${
                    msg.role === 'user'
                      ? 'from-orange-400/10 via-transparent to-pink-400/10'
                      : 'from-blue-400/5 via-transparent to-purple-400/5'
                  } pointer-events-none`}
                />
                <p className={`relative text-[15px] leading-relaxed ${
                  msg.role === 'user' ? 'text-white/95' : 'text-white/80'
                }`}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] rounded-3xl rounded-bl-lg px-5 py-4 shadow-lg">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-purple-400/60 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <span className="w-2 h-2 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Glass input bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            {/* Glass background */}
            <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.1] shadow-2xl shadow-black/20" />
            
            <div className="relative flex items-center gap-3 p-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 h-12 px-5 bg-white/[0.05] rounded-xl text-white/90 text-[15px] placeholder:text-white/30 outline-none border border-white/[0.05] focus:border-purple-500/30 transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="h-12 px-6 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium text-sm disabled:opacity-40 hover:shadow-lg hover:shadow-purple-500/30 active:scale-[0.98] transition-all"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </footer>
    </div>
  );
}
