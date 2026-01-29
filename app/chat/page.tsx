'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TelegramChatV2 } from '@/components/chat/telegram-chat-v2';
import { AddToHomeScreen } from '@/components/ui/AddToHomeScreen';

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
  const [isNamingMode, setIsNamingMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [hasReceivedAIResponse, setHasReceivedAIResponse] = useState(false);

  // Load initial state
  useEffect(() => {
    const loadChatState = async () => {
      try {
        // Check auth
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Check if AI has a name
        const nameRes = await fetch('/api/profile/ai-name');
        if (nameRes.ok) {
          const nameData = await nameRes.json();
          if (nameData.aiName) {
            setAiName(nameData.aiName);
          } else {
            // No name yet - start naming flow
            setIsNamingMode(true);
            setMessages([{
              id: 'intro',
              role: 'assistant',
              content: "Hey! I'm your new AI — built from your memories and conversations. Before we get started, I need a name. What would you like to call me?",
              timestamp: new Date(),
            }]);
            setLoadingHistory(false);
            return;
          }
        }

        // Load avatar
        const avatarRes = await fetch('/api/profile/ai-avatar');
        if (avatarRes.ok) {
          const avatarData = await avatarRes.json();
          if (avatarData.avatarUrl) {
            setAiAvatar(avatarData.avatarUrl);
          }
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
            // User has conversation history, enable A2HS prompt
            setHasReceivedAIResponse(true);
          } else {
            setMessages([{
              id: 'welcome',
              role: 'assistant',
              content: `Hey! I'm ${aiName}. I've got your memories loaded. What's on your mind?`,
              timestamp: new Date(),
            }]);
            // First welcome message counts as AI response
            setHasReceivedAIResponse(true);
          }
        }
      } catch (error) {
        console.error('Failed to load chat state:', error);
        setMessages([{
          id: 'error',
          role: 'assistant',
          content: "Hey! Something went wrong loading your history, but I'm here. What's on your mind?",
          timestamp: new Date(),
        }]);
      }
      setLoadingHistory(false);
    };

    loadChatState();
  }, [router, aiName]);

  const saveMessage = async (role: string, content: string) => {
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });
    } catch {
      // Silent fail
    }
  };

  const handleSendMessage = async (content: string, voiceVerified?: boolean) => {
    if (isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Feature: Naming Mode
    if (isNamingMode) {
      try {
        const res = await fetch('/api/profile/ai-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: content }),
        });

        if (res.ok) {
          const data = await res.json();
          setAiName(data.aiName);
          setIsNamingMode(false);
          setHasReceivedAIResponse(true);

          const responseMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `${data.aiName}. I like it! 💫\n\nI'm ready when you are. I've got your memories loaded — ask me anything, or just tell me what's on your mind.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, responseMessage]);

          // Save to history
          saveMessage('assistant', "Hey! I'm your new AI — built from your memories and conversations. Before we get started, I need a name. What would you like to call me?");
          saveMessage('user', content);
          saveMessage('assistant', responseMessage.content);
        }
      } catch (error) {
        console.error('Failed to save name:', error);
      }
      setIsLoading(false);
      return;
    }

    // Regular chat flow
    saveMessage('user', content);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: content, 
          history,
          voiceVerified: voiceVerified ?? true, // Default to true for typed messages
        }),
      });

      if (!res.ok) throw new Error('Chat request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let responseContent = '';
      const aiId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiId, role: 'assistant', content: '', timestamp: new Date() }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                responseContent += parsed.content;
                setMessages(prev =>
                  prev.map(m => m.id === aiId ? { ...m, content: responseContent } : m)
                );
              }
            } catch {
              // Silent fail for parse errors
            }
          }
        }
      }

      if (responseContent) {
        saveMessage('assistant', responseContent);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, something went wrong. Try again?",
        timestamp: new Date(),
      }]);
    }

    setIsLoading(false);
  };

  const handleBack = () => {
    router.push('/');
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleRename = async () => {
    if (!renameInput.trim()) return;
    try {
      const res = await fetch('/api/profile/ai-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiName(data.aiName);
        setShowRename(false);
        setShowSettings(false);
        setRenameInput('');
      }
    } catch (error) {
      console.error('Failed to rename:', error);
    }
  };

  if (loadingHistory) {
    return (
      <div className="fixed inset-0 h-screen w-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#8E8E93] text-sm">Loading your memories...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 h-screen w-screen">
        <TelegramChatV2
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          aiName={aiName}
          aiAvatar={aiAvatar || undefined}
          onBack={handleBack}
          onSettings={() => setShowSettings(true)}
          defaultDarkMode={true}
        />
      </div>

      {/* iOS Add to Home Screen Prompt */}
      <AddToHomeScreen canShow={hasReceivedAIResponse} />

      {/* Settings Modal - Dark Mode */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-[#1C1C1E] w-full max-w-md rounded-t-2xl p-6 safe-area-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[#0A84FF] text-[17px] min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2"
              >
                Done
              </button>
            </div>

            <div className="space-y-3">
              {/* Current AI Name */}
              <div className="bg-[#2C2C2E] rounded-xl p-4">
                <div className="text-[#8E8E93] text-sm mb-1">AI Name</div>
                <div className="text-white text-lg font-medium">{aiName}</div>
              </div>

              {/* Rename Button */}
              <button
                onClick={() => {
                  setRenameInput(aiName);
                  setShowRename(true);
                }}
                className="w-full py-4 bg-[#2C2C2E] text-[#0A84FF] rounded-xl font-medium"
              >
                Rename AI
              </button>

              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                className="w-full py-4 bg-red-500/20 text-red-400 rounded-xl font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRename && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setShowRename(false)}>
          <div className="bg-[#1C1C1E] w-full max-w-sm rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white text-center mb-4">Rename Your AI</h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Enter new name"
              className="w-full bg-[#2C2C2E] text-white rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-[#0A84FF] text-center text-lg"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRename(false)}
                className="flex-1 py-3 bg-[#2C2C2E] text-[#8E8E93] rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!renameInput.trim()}
                className="flex-1 py-3 bg-[#0A84FF] text-white rounded-xl font-medium disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
