'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TelegramChatV2 } from '@/components/chat/telegram-chat-v2';
import { AddToHomeScreen } from '@/components/ui/AddToHomeScreen';
import { BackgroundSync } from '@/components/chat/BackgroundSync';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

type QueuedMessage = {
  content: string;
  voiceVerified?: boolean;
  deepSearch?: boolean;
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
  const [memoryProgress, setMemoryProgress] = useState<number | null>(null);
  const [memoryStatus, setMemoryStatus] = useState<string>('loading');
  const [importError, setImportError] = useState<string | null>(null);
  
  // Message queue for handling multiple messages while AI is responding
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const isProcessingRef = useRef(false);

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

  // Poll memory/embedding status
  useEffect(() => {
    const checkMemoryStatus = async () => {
      try {
        const res = await fetch('/api/memory/status');
        if (res.ok) {
          const data = await res.json();
          
          // If user has no soulprint and not processing, redirect to import
          if (!data.hasSoulprint && data.status === 'none') {
            router.push('/import');
            return;
          }
          
          // Handle failed imports
          if (data.status === 'failed' || data.failed) {
            setMemoryStatus('failed');
            setImportError(data.importError || 'Import processing failed. Please try again.');
            return;
          }
          
          // Still processing - show progress
          if (data.status === 'processing') {
            setMemoryStatus('processing');
            setMemoryProgress(data.embeddingProgress || 10);
            return;
          }
          
          if (data.embeddingStatus === 'complete' || data.embeddingProgress >= 100) {
            setMemoryStatus('ready');
            setMemoryProgress(100);
          } else if (data.embeddingStatus === 'processing' || data.totalChunks > 0) {
            setMemoryStatus('loading');
            const progress = data.totalChunks > 0 
              ? Math.round((data.processedChunks / data.totalChunks) * 100)
              : data.embeddingProgress || 0;
            setMemoryProgress(progress);
          } else {
            setMemoryStatus('none');
            setMemoryProgress(null);
          }
        }
      } catch (err) {
        console.error('Memory status check failed:', err);
      }
    };
    
    checkMemoryStatus();
    const interval = setInterval(checkMemoryStatus, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [router]);

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

  // Process a single message from the queue
  const processMessage = useCallback(async (content: string, voiceVerified?: boolean, deepSearch?: boolean) => {
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

    setIsDeepSearching(false);
  }, [isNamingMode, messages, aiName]);

  // Process the message queue sequentially
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || messageQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    setIsLoading(true);

    while (messageQueueRef.current.length > 0) {
      const nextMessage = messageQueueRef.current.shift()!;
      await processMessage(nextMessage.content, nextMessage.voiceVerified, nextMessage.deepSearch);
    }

    isProcessingRef.current = false;
    setIsLoading(false);
  }, [processMessage]);

  // Public handler - adds message to queue and starts processing
  const handleSendMessage = useCallback((content: string, voiceVerified?: boolean, deepSearch?: boolean) => {
    // Immediately add user message to UI
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Add to queue
    messageQueueRef.current.push({ content, voiceVerified, deepSearch });

    // Start processing if not already running
    if (!isProcessingRef.current) {
      processQueue();
    }
  }, [processQueue]);

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

      {/* Memory Loading Indicator */}
      {(memoryStatus === 'loading' || memoryStatus === 'processing') && memoryProgress !== null && memoryProgress < 100 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-[#1a1a1a]/90 backdrop-blur-sm border border-[#262626] rounded-full px-4 py-2 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#a3a3a3]">
              {memoryStatus === 'processing' ? 'Processing import...' : `Memory: ${memoryProgress}%`}
            </span>
          </div>
        </div>
      )}
      
      {/* Import Failed Indicator */}
      {memoryStatus === 'failed' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl px-4 py-3 flex flex-col items-center gap-2 max-w-xs">
            <span className="text-sm text-red-400 text-center">
              {importError || 'Import failed'}
            </span>
            <button
              onClick={() => router.push('/import')}
              className="text-xs text-[#EA580C] hover:text-[#C2410C] font-medium"
            >
              Try Again →
            </button>
          </div>
        </div>
      )}

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
      
      {/* Background sync for pending imports */}
      <BackgroundSync onComplete={() => setMemoryStatus('ready')} />
    </>
  );
}
