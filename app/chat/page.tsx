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
  const [isDeepSearching, setIsDeepSearching] = useState(false);
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

  const handleSendMessage = async (content: string, voiceVerified?: boolean, deepSearch?: boolean) => {
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
    
    // Track if this is a deep search request
    if (deepSearch) {
      setIsDeepSearching(true);
    }

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

    // Check for "what is your name" question
    if (/what.?s?\s+(?:is\s+)?(?:your|ur)\s+name/i.test(content) || 
        /(?:your|ur)\s+name\s*\?/i.test(content) ||
        /who\s+are\s+you/i.test(content)) {
      const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I'm ${aiName}! 👋 If you want to change my name, just say "call you [new name]" or tap the settings gear.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, responseMessage]);
      saveMessage('user', content);
      saveMessage('assistant', responseMessage.content);
      setIsLoading(false);
      return;
    }

    // Check for "change your name" without a new name (prompt them)
    if (/(?:change|rename|edit)\s+(?:your|the|my ai.?s?)\s+name/i.test(content) ||
        /(?:want|like)\s+to\s+(?:change|rename)\s+(?:your|you)/i.test(content) ||
        /(?:can|could)\s+(?:i|we)\s+(?:change|rename)\s+(?:your|you)/i.test(content)) {
      const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sure! What would you like to call me instead? Just say "call you [name]" and I'll update it! 💫`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, responseMessage]);
      saveMessage('user', content);
      saveMessage('assistant', responseMessage.content);
      setIsLoading(false);
      return;
    }

    // Check for rename request in conversation
    const renamePatterns = [
      /(?:call you|name you|rename you|change your name to|your new name is|i.?ll call you|let.?s call you|from now on you.?re|be called)\s+["\']?([a-zA-Z][a-zA-Z0-9\s]{0,20})["\']?/i,
      /(?:your name (?:is|should be)|i.?m (?:going to |gonna )?(?:call|name) you)\s+["\']?([a-zA-Z][a-zA-Z0-9\s]{0,20})["\']?/i,
      /(?:you.?re|you are|be)\s+(?:now\s+)?(?:called\s+)?["\']?([a-zA-Z][a-zA-Z0-9\s]{0,20})["\']?\s*(?:now)?$/i,
    ];

    for (const pattern of renamePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const newName = match[1].trim();
        if (newName.length >= 2 && newName.length <= 20) {
          try {
            const res = await fetch('/api/profile/ai-name', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: newName }),
            });
            if (res.ok) {
              const data = await res.json();
              setAiName(data.aiName);
              const responseMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `${data.aiName}! I love it. That's my name now. 💫`,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, responseMessage]);
              saveMessage('user', content);
              saveMessage('assistant', responseMessage.content);
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error('Failed to rename:', error);
          }
        }
      }
    }

    // Check for recurring task request
    const taskPatterns = [
      /(?:send|email|remind|tell|give|notify)\s+(?:me|us)\s+(?:about\s+)?(.+?)\s+(?:every|each)\s+(morning|evening|day|night|week)/i,
      /(?:every|each)\s+(morning|evening|day|night)\s+(?:send|email|remind|tell|give)\s+(?:me|us)\s+(?:about\s+)?(.+)/i,
      /(?:daily|weekly)\s+(?:send|email|remind|tell|give)\s+(?:me|us)\s+(?:about\s+)?(.+)/i,
      /(?:schedule|set up|create)\s+(?:a\s+)?(?:daily|recurring|regular)\s+(?:task|reminder|email|update)\s+(?:for|about|to)\s+(.+)/i,
    ];

    for (const pattern of taskPatterns) {
      const match = content.match(pattern);
      if (match) {
        const taskContent = match[1]?.replace(/^(the|a|an)\s+/i, '').trim() || match[2]?.trim();
        const timing = match[2] || match[1] || 'morning';
        
        if (taskContent && taskContent.length > 3) {
          // Determine hour based on timing
          let hour = 8; // default morning
          if (timing.includes('evening') || timing.includes('night')) hour = 18;
          if (timing.includes('afternoon')) hour = 14;
          
          // Determine task type
          const taskType = taskContent.toLowerCase().includes('news') ? 'news' : 'custom';
          
          try {
            const res = await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: taskContent,
                description: `${timing}: ${taskContent}`.slice(0, 50),
                task_type: taskType,
                schedule_hour: hour,
              }),
            });
            
            if (res.ok) {
              const timeStr = hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour-12}pm`;
              const responseMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Done! I'll send you "${taskContent}" every ${timing} at ${timeStr} via email. 📬\n\nYou can manage your scheduled tasks in settings.`,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, responseMessage]);
              saveMessage('user', content);
              saveMessage('assistant', responseMessage.content);
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error('Failed to create task:', error);
          }
        }
      }
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
          deepSearch: deepSearch ?? false, // Deep Search mode
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
    setIsDeepSearching(false);
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
      <div className="fixed inset-0 h-screen w-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#a3a3a3] text-sm">Loading your memories...</span>
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
          isDeepSearching={isDeepSearching}
          aiName={aiName}
          aiAvatar={aiAvatar || undefined}
          onBack={handleBack}
          onSettings={() => setShowSettings(true)}
          defaultDarkMode={true}
        />
      </div>

      {/* iOS Add to Home Screen Prompt */}
      <AddToHomeScreen canShow={hasReceivedAIResponse} />

      {/* Settings Modal - Dark Mode with SoulPrint branding */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-[#111] w-full max-w-md rounded-t-2xl p-6 safe-area-bottom border-t border-[#262626]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[#EA580C] text-[17px] min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 font-medium"
              >
                Done
              </button>
            </div>

            <div className="space-y-3">
              {/* Current AI Name */}
              <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#262626]">
                <div className="text-[#a3a3a3] text-sm mb-1">AI Name</div>
                <div className="text-white text-lg font-medium">{aiName}</div>
              </div>

              {/* Rename Button */}
              <button
                onClick={() => {
                  setRenameInput(aiName);
                  setShowRename(true);
                }}
                className="w-full py-4 bg-[#1a1a1a] text-[#EA580C] rounded-xl font-medium border border-[#262626] hover:bg-[#262626] transition-colors"
              >
                Rename AI
              </button>

              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                className="w-full py-4 bg-red-500/10 text-red-400 rounded-xl font-medium border border-red-500/20 hover:bg-red-500/20 transition-colors"
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
          <div className="bg-[#111] w-full max-w-sm rounded-2xl p-6 border border-[#262626]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white text-center mb-4">Rename Your AI</h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Enter new name"
              className="w-full bg-[#1a1a1a] text-white rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-[#EA580C] border border-[#262626] text-center text-lg placeholder:text-[#737373]"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRename(false)}
                className="flex-1 py-3 bg-[#1a1a1a] text-[#a3a3a3] rounded-xl font-medium border border-[#262626] hover:bg-[#262626] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!renameInput.trim()}
                className="flex-1 py-3 bg-[#EA580C] text-white rounded-xl font-medium disabled:opacity-50 hover:bg-[#C2410C] transition-colors"
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
