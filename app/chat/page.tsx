'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TelegramChatV2 } from '@/components/chat/telegram-chat-v2';
import { fetchWithRetry } from '@/lib/retry';
import { AddToHomeScreen } from '@/components/ui/AddToHomeScreen';
import { getCsrfToken } from '@/lib/csrf';
// BackgroundSync removed - RLM handles all chunk processing server-side

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
  const [isGenerating, setIsGenerating] = useState(false);
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
  const [saveError, setSaveError] = useState<string | null>(null);

  // Message queue for handling multiple messages while AI is responding
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const processingPromiseRef = useRef<Promise<void> | null>(null);
  const latestPollIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load initial state
  useEffect(() => {
    const controller = new AbortController();

    const loadChatState = async () => {
      try {
        // Check auth
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Check if AI has a name and signature greeting (if not, will be auto-generated on first chat)
        let localAiName: string | null = null;
        let localGreeting: string | null = null;

        const nameRes = await fetch('/api/profile/ai-name', { signal: controller.signal });
        if (nameRes.ok) {
          const nameData = await nameRes.json();
          localAiName = nameData.aiName || null;
          localGreeting = nameData.signatureGreeting || null;

          if (localAiName) {
            setAiName(localAiName);
          }
          // If no name yet, keep default "SoulPrint" - API will auto-name on first message
        }

        // Load avatar
        const avatarRes = await fetch('/api/profile/ai-avatar', { signal: controller.signal });
        if (avatarRes.ok) {
          const avatarData = await avatarRes.json();
          if (avatarData.avatarUrl) {
            setAiAvatar(avatarData.avatarUrl);
          }
        }

        // Load chat history
        const historyRes = await fetch('/api/chat/messages?limit=100', { signal: controller.signal });
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
            // Use signature greeting if available, otherwise fall back to default
            setMessages([{
              id: 'welcome',
              role: 'assistant',
              content: localGreeting
                ? localGreeting
                : `Hey! I'm ${localAiName || 'your AI'}. I've got your memories loaded. What's on your mind?`,
              timestamp: new Date(),
            }]);
            // First welcome message counts as AI response
            setHasReceivedAIResponse(true);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to load chat state:', error);
        setMessages([{
          id: 'error',
          role: 'assistant',
          content: "Hey! Something went wrong loading your history, but I'm here. What's on your mind?",
          timestamp: new Date(),
        }]);
      }
      if (!controller.signal.aborted) {
        setLoadingHistory(false);
      }
    };

    loadChatState();

    return () => controller.abort();
  }, [router, aiName]);

  // Poll memory/embedding status
  useEffect(() => {
    const controller = new AbortController();
    const shouldPoll = { current: true };

    const checkMemoryStatus = async () => {
      if (!shouldPoll.current) return;

      try {
        const res = await fetch('/api/memory/status', {
          signal: controller.signal
        });
        if (controller.signal.aborted) return;
        if (!res.ok) return;

        const data = await res.json();

        // Gate: no soulprint and not ready -> redirect to import
        if (!data.hasSoulprint && (data.status === 'none' || data.status === 'processing')) {
          router.push('/import');
          return;
        }

        // Gate: failed import
        if (data.status === 'failed' || data.failed) {
          setMemoryStatus('failed');
          setImportError(data.import_error || data.importError || 'Import processing failed. Please try again.');
          return;
        }

        // Has soulprint (quick_ready or complete) -- check full pass status
        const fps = data.fullPassStatus || 'pending';
        if (fps === 'complete') {
          setMemoryStatus('ready');
          shouldPoll.current = false; // Stop polling
        } else if (fps === 'failed') {
          // Full pass failure is non-fatal -- user can still chat with v1 sections
          setMemoryStatus('ready');
          shouldPoll.current = false;
          console.warn('[Chat] Full pass failed (non-fatal):', data.fullPassError);
        } else {
          // pending or processing
          setMemoryStatus('building');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Memory status check failed:', err);
      }
    };

    checkMemoryStatus();
    const interval = setInterval(checkMemoryStatus, 5000);

    return () => {
      controller.abort();
      shouldPoll.current = false;
      clearInterval(interval);
    };
  }, [router]);

  const saveMessage = async (role: string, content: string) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetchWithRetry('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ role, content }),
      });
      if (!response.ok) {
        console.error('[Chat] Failed to save message after retries:', response.status);
        setSaveError('Message may not have been saved. Check your connection.');
      } else {
        // Clear any previous save error on success
        if (saveError) setSaveError(null);
      }
    } catch (error) {
      console.error('[Chat] Message save failed after all retries:', error);
      setSaveError('Failed to save message. Your conversation may not be fully saved.');
    }
  };

  // Process a single message from the queue
  const processMessage = useCallback(async (content: string, voiceVerified?: boolean, deepSearch?: boolean) => {
    // Get CSRF token once for all requests in this function
    const csrfToken = await getCsrfToken();

    // Track if this is a deep search request
    if (deepSearch) {
      setIsDeepSearching(true);
    }

    // Feature: Naming Mode
    if (isNamingMode) {
      try {
        const res = await fetch('/api/profile/ai-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
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
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
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
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
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

    // Create AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({
          message: content,
          history,
          voiceVerified: voiceVerified ?? true, // Default to true for typed messages
          deepSearch: deepSearch ?? false, // Deep Search mode
        }),
        signal: controller.signal,
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
        
        // If AI name was default, refresh it (may have been auto-generated)
        if (aiName === 'SoulPrint') {
          try {
            const nameRes = await fetch('/api/profile/ai-name');
            if (nameRes.ok) {
              const nameData = await nameRes.json();
              if (nameData.aiName && nameData.aiName !== 'SoulPrint') {
                setAiName(nameData.aiName);
              }
            }
          } catch (e) {
            console.error('Failed to refresh AI name:', e);
          }
        }
      }
    } catch (error) {
      // Handle AbortError gracefully - user stopped generation
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Generation stopped by user');
        // Partial response is already in messages state
      } else {
        console.error('Chat error:', error);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Sorry, something went wrong. Try again?",
          timestamp: new Date(),
        }]);
      }
    } finally {
      setIsGenerating(false);
      setIsDeepSearching(false);
      abortControllerRef.current = null;
    }
  }, [isNamingMode, messages, aiName]);

  // Process the message queue sequentially with mutex pattern
  const processQueue = useCallback(async () => {
    // If already processing, return existing promise to avoid race
    if (processingPromiseRef.current) {
      return processingPromiseRef.current;
    }

    if (messageQueueRef.current.length === 0) {
      return;
    }

    const processAll = async () => {
      setIsLoading(true);

      while (messageQueueRef.current.length > 0) {
        const nextMessage = messageQueueRef.current.shift()!;
        await processMessage(nextMessage.content, nextMessage.voiceVerified, nextMessage.deepSearch);
      }

      setIsLoading(false);
      processingPromiseRef.current = null;
    };

    processingPromiseRef.current = processAll();
    return processingPromiseRef.current;
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

    // Start processing (processQueue handles its own mutex)
    processQueue();
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
      const csrfToken = await getCsrfToken();
      const res = await fetch('/api/profile/ai-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
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

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  if (loadingHistory) {
    return (
      <div className="fixed inset-0 h-screen w-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">Loading your memories...</span>
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
          isGenerating={isGenerating}
          isDeepSearching={isDeepSearching}
          aiName={aiName}
          aiAvatar={aiAvatar || undefined}
          onBack={handleBack}
          onSettings={() => setShowSettings(true)}
          onStop={handleStop}
        />
      </div>

      {saveError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 max-w-sm w-full px-4">
          <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-sm text-red-400 flex-1">{saveError}</span>
            <button
              onClick={() => setSaveError(null)}
              className="text-red-400/60 hover:text-red-400 text-xs font-medium shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Memory Building Indicator */}
      {memoryStatus === 'building' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-full px-4 py-2 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">
              Building deep memory...
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
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              Try Again →
            </button>
          </div>
        </div>
      )}

      {/* iOS Add to Home Screen Prompt */}
      <AddToHomeScreen canShow={hasReceivedAIResponse} />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-card w-full max-w-md rounded-t-2xl p-6 safe-area-bottom border-t border-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-foreground">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-primary text-[17px] min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 font-medium"
              >
                Done
              </button>
            </div>

            <div className="space-y-3">
              {/* Current AI Name */}
              <div className="bg-muted rounded-xl p-4 border border-border">
                <div className="text-muted-foreground text-sm mb-1">AI Name</div>
                <div className="text-foreground text-lg font-medium">{aiName}</div>
              </div>

              {/* Rename Button */}
              <button
                onClick={() => {
                  setRenameInput(aiName);
                  setShowRename(true);
                }}
                className="w-full py-4 bg-muted text-primary rounded-xl font-medium border border-border hover:bg-accent transition-colors"
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
          <div className="bg-card w-full max-w-sm rounded-2xl p-6 border border-border" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground text-center mb-4">Rename Your AI</h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Enter new name"
              className="w-full bg-muted text-foreground rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-primary border border-border text-center text-lg placeholder:text-muted-foreground"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRename(false)}
                className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-medium border border-border hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!renameInput.trim()}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50 hover:bg-primary/80 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Background sync removed - RLM handles all processing server-side */}
    </>
  );
}
