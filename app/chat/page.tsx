'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FloatingChat } from '@/components/chat/floating-chat';
import { InfiniteVoidBackground } from '@/components/chat/infinite-void-bg';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [aiName, setAiName] = useState<string>('SoulPrint');
  const [aiAvatar, setAiAvatar] = useState<string | null>(null);

  // Load initial state
  useEffect(() => {
    const loadChatState = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Load AI name
        const nameRes = await fetch('/api/profile/ai-name');
        if (nameRes.ok) {
          const nameData = await nameRes.json();
          if (nameData.aiName) setAiName(nameData.aiName);
        }

        // Load avatar
        const avatarRes = await fetch('/api/profile/ai-avatar');
        if (avatarRes.ok) {
          const avatarData = await avatarRes.json();
          if (avatarData.avatarUrl) setAiAvatar(avatarData.avatarUrl);
        }

        // Load chat history
        const historyRes = await fetch('/api/chat/messages?limit=100');
        if (historyRes.ok) {
          const data = await historyRes.json();
          if (data.messages?.length > 0) {
            setMessages(data.messages.map((m: Message) => ({
              ...m,
              timestamp: new Date(),
            })));
          } else {
            setMessages([{
              id: 'welcome',
              role: 'assistant',
              content: `Hey! I'm here. What's on your mind?`,
              timestamp: new Date(),
            }]);
          }
        }
      } catch (error) {
        console.error('Failed to load chat:', error);
        setMessages([{
          id: 'error',
          role: 'assistant',
          content: 'Had trouble loading. Try refreshing?',
          timestamp: new Date(),
        }]);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadChatState();
  }, [router]);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.response || data.message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (loadingHistory) {
    return (
      <div className="min-h-screen bg-black relative">
        <InfiniteVoidBackground />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white/60 animate-pulse flex items-center gap-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* The Infinite Void */}
      <InfiniteVoidBackground />
      
      {/* Floating Chat Interface */}
      <div className="relative z-10">
        <FloatingChat
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          aiName={aiName}
          aiAvatar={aiAvatar || undefined}
        />
      </div>
    </div>
  );
}
