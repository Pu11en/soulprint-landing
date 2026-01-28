'use client';

import { cn } from '@/lib/utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

interface ChatMessageProps {
  message: Message;
  aiName?: string | null;
  aiAvatar?: string | null;
}

export function ChatMessage({ message, aiName, aiAvatar }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'group/message w-full animate-in fade-in duration-200',
        'flex items-start gap-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-sm shadow-lg shadow-orange-500/20 overflow-hidden">
          {aiAvatar ? (
            <img src={aiAvatar} alt={aiName || 'AI'} className="w-full h-full object-cover" />
          ) : (
            <span>✨</span>
          )}
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={cn(
          'relative max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl',
          'text-[15px] leading-relaxed',
          isUser
            ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-br-sm shadow-lg shadow-orange-500/15'
            : 'bg-[#1a1a1c] text-white/90 rounded-bl-sm border border-white/[0.06]'
        )}
      >
        <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere">
          {message.content}
        </div>
      </div>
    </div>
  );
}

export function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3 justify-start animate-in fade-in duration-300">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-sm shadow-lg shadow-orange-500/20">
        <span className="animate-pulse">✨</span>
      </div>
      <div className="bg-[#1a1a1c] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-white/50 text-sm">Thinking</span>
          <span className="flex gap-0.5">
            <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      </div>
    </div>
  );
}
