'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Paperclip, Mic, Send, MoreVertical } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

interface TelegramChatProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  aiName?: string;
  aiAvatar?: string;
  onBack?: () => void;
  onSettings?: () => void;
}

export function TelegramChat({
  messages,
  onSendMessage,
  isLoading = false,
  aiName = 'SoulPrint',
  aiAvatar,
  onBack,
  onSettings,
}: TelegramChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    inputRef.current?.focus();
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  return (
    <div className="flex flex-col h-full bg-[#ECE6DF]">
      {/* Top Navigation */}
      <div className="bg-[#F5F5F5] border-b border-[#E9E9EB] safe-area-top">
        {/* Status Bar Spacer */}
        <div className="h-[47px]" />
        
        {/* Navigation Bar */}
        <div className="flex items-center justify-between px-2 py-1 h-[44px]">
          {/* Left - Back Button */}
          <button 
            onClick={onBack}
            className="flex items-center gap-1 text-[#007AFF] px-2 py-1 -ml-2"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-[17px]">Back</span>
          </button>

          {/* Center - Profile */}
          <div className="flex flex-col items-center">
            <span className="text-[17px] font-semibold text-[#000000]">{aiName}</span>
            <span className="text-[13px] text-[#8E8E93]">online</span>
          </div>

          {/* Right - Avatar & Menu */}
          <div className="flex items-center gap-2">
            <button onClick={onSettings} className="p-1">
              <MoreVertical className="w-5 h-5 text-[#007AFF]" />
            </button>
            {aiAvatar ? (
              <img 
                src={aiAvatar} 
                alt={aiName}
                className="w-[34px] h-[34px] rounded-full object-cover"
              />
            ) : (
              <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#B7BE6D] to-[#81AB95] flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {aiName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-[10px] py-4">
        <div className="flex flex-col gap-2">
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            const showTail = index === messages.length - 1 || 
              messages[index + 1]?.role !== message.role;
            
            return (
              <div
                key={message.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[85%] px-3 py-2 relative
                    ${isUser 
                      ? `bg-[#E7FECC] ${showTail ? 'rounded-[16px_16px_4px_16px]' : 'rounded-[16px]'}` 
                      : `bg-white ${showTail ? 'rounded-[16px_16px_16px_4px]' : 'rounded-[16px]'}`
                    }
                    shadow-sm
                  `}
                >
                  {/* Message Content */}
                  <p className="text-[15px] text-[#000000] leading-[1.35] whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  
                  {/* Timestamp */}
                  <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[11px] text-[#8E8E93]">
                      {formatTime(message.timestamp || new Date())}
                    </span>
                    {isUser && (
                      <svg className="w-4 h-3 text-[#4FC3F7]" viewBox="0 0 16 11" fill="currentColor">
                        <path d="M11.071 0L5.5 5.571 3.429 3.5 2 4.929l3.5 3.5 7-7L11.071 0z"/>
                        <path d="M14.071 0L8.5 5.571 7.786 4.857 6.357 6.286l2.143 2.143 7-7L14.071 0z"/>
                      </svg>
                    )}
                  </div>

                  {/* Tail SVG */}
                  {showTail && (
                    <div 
                      className={`absolute bottom-0 ${isUser ? '-right-2' : '-left-2'} w-3 h-3`}
                    >
                      {isUser ? (
                        <svg viewBox="0 0 12 12" className="w-3 h-3 text-[#E7FECC]">
                          <path fill="currentColor" d="M0,0 L12,0 L12,12 C12,12 12,0 0,0 Z"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 12 12" className="w-3 h-3 text-white">
                          <path fill="currentColor" d="M12,0 L0,0 L0,12 C0,12 0,0 12,0 Z"/>
                        </svg>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-[16px_16px_16px_4px] px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Navigation - Input Area */}
      <div className="bg-[#F5F5F5] border-t border-[#E9E9EB] safe-area-bottom">
        <form onSubmit={handleSubmit} className="flex items-center gap-3 px-[10px] py-2">
          {/* Attach Button */}
          <button 
            type="button"
            className="flex-shrink-0 w-[30px] h-[30px] flex items-center justify-center"
          >
            <Paperclip className="w-6 h-6 text-[#8E8E93]" />
          </button>

          {/* Input Field */}
          <div className="flex-1 flex items-center bg-white rounded-full border border-[#E9E9EB] px-4 py-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message"
              className="flex-1 text-[15px] text-[#000000] placeholder-[#8E8E93] bg-transparent outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Voice/Send Button */}
          {input.trim() ? (
            <button 
              type="submit"
              disabled={isLoading}
              className="flex-shrink-0 w-[30px] h-[30px] flex items-center justify-center bg-[#007AFF] rounded-full"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          ) : (
            <button 
              type="button"
              className="flex-shrink-0 w-[30px] h-[30px] flex items-center justify-center"
            >
              <Mic className="w-6 h-6 text-[#8E8E93]" />
            </button>
          )}
        </form>
        
        {/* Home Indicator */}
        <div className="flex justify-center pb-2">
          <div className="w-[134px] h-[5px] bg-[#000000] rounded-full opacity-20" />
        </div>
      </div>
    </div>
  );
}
