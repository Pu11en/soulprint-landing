'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { TelegramChatV2 } from '@/components/chat/telegram-chat-v2';
import { ConversationSidebar } from '@/components/chat/conversation-sidebar';
import { fetchWithRetry } from '@/lib/retry';
import { AddToHomeScreen } from '@/components/ui/AddToHomeScreen';
import { getCsrfToken } from '@/lib/csrf';
import type { CitationMetadata } from '@/components/chat/message-content';
// BackgroundSync removed - RLM handles all chunk processing server-side

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  citations?: CitationMetadata[];
};

type QueuedMessage = {
  content: string;
  voiceVerified?: boolean;
  deepSearch?: boolean;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
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
  const [currentCitations, setCurrentCitations] = useState<CitationMetadata[]>([]);
  const [fullPassStatus, setFullPassStatus] = useState<string>('pending');
  const [fullPassError, setFullPassError] = useState<string | null>(null);
  const [fullPassDismissed, setFullPassDismissed] = useState(false);

  // Conversation management state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  // Message queue for handling multiple messages while AI is responding
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const processingPromiseRef = useRef<Promise<void> | null>(null);
  const latestPollIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);

  // Helper to set conversation ID in both state and ref simultaneously (avoids race conditions)
  const setCurrentConversationIdSync = useCallback((id: string | null) => {
    currentConversationIdRef.current = id; // Immediate ref update
    setCurrentConversationId(id);          // Async state update for re-render
  }, []);

  // Keep refs in sync with state (backup for any direct setState calls)
  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

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

        // Load conversations list
        const conversationsRes = await fetch('/api/conversations', { signal: controller.signal });
        if (conversationsRes.ok) {
          const convData = await conversationsRes.json();
          if (convData.conversations && convData.conversations.length > 0) {
            // Sort by updated_at descending (most recent first)
            const sorted = [...convData.conversations].sort((a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
            setConversations(sorted);

            // Set the first (most recent) conversation as active
            const mostRecentConv = sorted[0];
            setCurrentConversationIdSync(mostRecentConv.id);

            // Load messages for this conversation
            const historyRes = await fetch(`/api/chat/messages?conversation_id=${mostRecentConv.id}&limit=100`, {
              signal: controller.signal
            });
            if (historyRes.ok) {
              const data = await historyRes.json();
              if (data.messages?.length > 0) {
                setMessages(data.messages.map((m: Message) => ({
                  ...m,
                  timestamp: new Date(),
                })));
                setHasReceivedAIResponse(true);
              } else {
                // Empty conversation - show welcome
                setMessages([{
                  id: 'welcome',
                  role: 'assistant',
                  content: localGreeting
                    ? localGreeting
                    : `Hey! I'm ${localAiName || 'your AI'}. I've got your memories loaded. What's on your mind?`,
                  timestamp: new Date(),
                }]);
                setHasReceivedAIResponse(true);
              }
            }
          } else {
            // No conversations exist - create first one
            const csrfToken = await getCsrfToken();
            const createRes = await fetch('/api/conversations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
              body: JSON.stringify({ title: 'New Chat' }),
              signal: controller.signal,
            });

            if (createRes.ok) {
              const createData = await createRes.json();
              const newConv = createData.conversation ?? createData;
              setConversations([newConv]);
              setCurrentConversationIdSync(newConv.id);

              // Show welcome message
              setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: localGreeting
                  ? localGreeting
                  : `Hey! I'm ${localAiName || 'your AI'}. I've got your memories loaded. What's on your mind?`,
                timestamp: new Date(),
              }]);
              setHasReceivedAIResponse(true);
            }
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
  }, [router]);

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
        setFullPassStatus(fps);
        setFullPassError(data.fullPassError || null);

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
    const conversationId = currentConversationIdRef.current;
    if (!conversationId) {
      console.error('[Chat] Cannot save message: no conversation ID');
      return;
    }

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetchWithRetry('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ role, content, conversation_id: conversationId }),
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

  // Conversation management handlers
  const handleSelectConversation = async (id: string) => {
    // Abort any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear messages immediately
    setMessages([]);
    setCurrentConversationIdSync(id);
    setSidebarOpen(false); // Close sidebar on mobile

    // Fetch messages for new conversation
    try {
      const res = await fetch(`/api/chat/messages?conversation_id=${id}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages?.length > 0) {
          setMessages(data.messages.map((m: Message) => ({
            ...m,
            timestamp: new Date(),
          })));
        }
      }
    } catch (error) {
      console.error('Failed to load conversation messages:', error);
    }
  };

  const handleCreateConversation = async () => {
    if (isCreatingConversation) return;

    setIsCreatingConversation(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ title: 'New Chat' }),
      });

      if (res.ok) {
        const createData = await res.json();
        const newConv = createData.conversation ?? createData;
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationIdSync(newConv.id);
        setMessages([]); // Clear messages
        setSidebarOpen(false); // Close sidebar on mobile
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    // Optimistic update
    const oldConversations = conversations;
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, title: newTitle } : c)
    );

    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!res.ok) {
        // Revert on failure
        setConversations(oldConversations);
        console.error('Failed to rename conversation');
      }
    } catch (error) {
      // Revert on failure
      setConversations(oldConversations);
      console.error('Failed to rename conversation:', error);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    // Optimistic removal
    const oldConversations = conversations;
    const updatedConversations = conversations.filter(c => c.id !== id);
    setConversations(updatedConversations);

    // If deleting active conversation, switch to most recent or create new
    if (id === currentConversationId) {
      const nextConv = updatedConversations[0];
      if (nextConv) {
        await handleSelectConversation(nextConv.id);
      } else {
        // No conversations left - create a new one
        await handleCreateConversation();
      }
    }

    // Delete on server
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken },
      });

      if (!res.ok) {
        // Revert on failure
        setConversations(oldConversations);
        console.error('Failed to delete conversation');
      }
    } catch (error) {
      // Revert on failure
      setConversations(oldConversations);
      console.error('Failed to delete conversation:', error);
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

    // Reset citations for new message
    setCurrentCitations([]);

    // Create AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);
    let responseContent = '';
    let responseCitations: CitationMetadata[] = [];

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
              if (parsed.type === 'debug') {
                // Debug metadata from chat route - visible in browser devtools
                console.log('[SoulPrint Chat Debug]', parsed);
              } else if (parsed.type === 'citations' && parsed.data) {
                // Citation metadata event
                responseCitations = parsed.data;
                setCurrentCitations(parsed.data);
              } else if (parsed.content) {
                // Content chunk event
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

      // After streaming completes, update message with citations
      if (responseCitations.length > 0) {
        setMessages(prev =>
          prev.map(m => m.id === aiId ? { ...m, citations: responseCitations } : m)
        );
      }

    } catch (error) {
      // Handle AbortError gracefully - user stopped generation
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Generation stopped by user');
        // Partial response is already in messages state, will be saved in finally
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
      // Save response (full or partial from abort) to database
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

        // Auto-title generation: if this is first exchange and title is still "New Chat"
        const convId = currentConversationIdRef.current;
        const currentConvs = conversationsRef.current;
        const currentConv = currentConvs.find(c => c.id === convId);

        if (currentConv && currentConv.title === 'New Chat' && content && responseContent) {
          // Fire-and-forget title generation (non-blocking)
          (async () => {
            try {
              const titleCsrfToken = await getCsrfToken();
              const titleRes = await fetch(`/api/conversations/${convId}/title`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': titleCsrfToken },
                body: JSON.stringify({
                  userMessage: content.slice(0, 1000),
                  aiMessage: responseContent.slice(0, 1000),
                }),
              });

              if (titleRes.ok) {
                const titleData = await titleRes.json();
                if (titleData.title) {
                  // Update conversation title in state
                  setConversations(prev =>
                    prev.map(c => c.id === convId ? { ...c, title: titleData.title } : c)
                  );
                }
              }
            } catch (e) {
              console.error('[Chat] Auto-title generation failed:', e);
            }
          })();
        }
      }
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
    // Guard: ensure we have a conversation to send to
    if (!currentConversationIdRef.current) {
      console.error('[Chat] Cannot send message: no active conversation');
      return;
    }

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

  const handleRegenerate = useCallback(() => {
    // Find the last user message to re-send
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    // Remove the last AI message
    setMessages(prev => {
      const lastAiIndex = prev.findLastIndex(m => m.role === 'assistant');
      if (lastAiIndex === -1) return prev;
      return prev.slice(0, lastAiIndex);
    });

    // Re-send the last user message
    processQueue();
    messageQueueRef.current.push({ content: lastUserMsg.content });
    processQueue();
  }, [messages, processQueue]);

  // FullPassBanner component for showing full pass status
  function FullPassBanner({ status, error, onDismiss }: { status: string; error: string | null; onDismiss: () => void }) {
    if (status === 'complete' || status === 'pending') return null;

    if (status === 'processing') {
      return (
        <div className="mx-4 mt-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span>Building deep memory from your conversations...</span>
          <button onClick={onDismiss} className="ml-auto text-blue-400 hover:text-blue-600 dark:hover:text-blue-300">&times;</button>
        </div>
      );
    }

    if (status === 'failed') {
      return (
        <div className="mx-4 mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <span className="font-medium">Deep memory processing encountered an issue</span>
            <button onClick={onDismiss} className="ml-auto text-amber-400 hover:text-amber-600 dark:hover:text-amber-300">&times;</button>
          </div>
          {error && <p className="mt-1 text-xs opacity-75">{error}</p>}
          <p className="mt-1 text-xs opacity-60">Your AI still works with quick-pass data. Deep memory can be retried later.</p>
        </div>
      );
    }

    return null;
  }

  if (loadingHistory) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 h-screen w-screen bg-black flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-white/60 text-sm">Loading your memories...</span>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        style={{ position: 'fixed', inset: 0, height: '100vh', width: '100vw' }}
      >
        {/* Conversation Sidebar */}
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={currentConversationId}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelect={handleSelectConversation}
          onCreateNew={handleCreateConversation}
          onRename={handleRenameConversation}
          onDelete={handleDeleteConversation}
        />

        {/* Main Chat Area */}
        <div className="fixed inset-0 h-screen w-screen">
          <TelegramChatV2
            messages={messages}
            onSendMessage={handleSendMessage}
            onRegenerate={handleRegenerate}
            isLoading={isLoading}
            isGenerating={isGenerating}
            isDeepSearching={isDeepSearching}
            aiName={aiName}
            aiAvatar={aiAvatar || undefined}
            onBack={handleBack}
            onSettings={() => setShowSettings(true)}
            onStop={handleStop}
            onMenuClick={() => setSidebarOpen(true)}
          />
        </div>

        {/* Full Pass Status Banner */}
        {!fullPassDismissed && <FullPassBanner status={fullPassStatus} error={fullPassError} onDismiss={() => setFullPassDismissed(true)} />}
      </motion.div>

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
              onClick={() => router.push('/import?reimport=true')}
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

              {/* Re-import Data */}
              <button
                onClick={async () => {
                  if (!confirm('This will reset your personality profile and let you re-import. Continue?')) return;
                  try {
                    const csrfToken = await getCsrfToken();
                    const res = await fetch('/api/user/reset', {
                      method: 'DELETE',
                      headers: { 'X-CSRF-Token': csrfToken },
                    });
                    if (!res.ok) throw new Error('Reset failed');
                    // Hard navigation with reimport flag to skip hasSoulprint redirect
                    window.location.href = '/import?reimport=true';
                  } catch {
                    alert('Reset failed. Please try again.');
                  }
                }}
                className="w-full py-4 bg-muted text-foreground rounded-xl font-medium border border-border hover:bg-accent transition-colors"
              >
                Re-import Data
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
