"use server";

import { createClient } from "@/lib/supabase/server";

// Constants for pagination
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export interface ChatMessage {
  id?: string;
  session_id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

export interface ChatSession {
  session_id: string;
  created_at: string;
  last_message: string;
  message_count: number;
}

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
  total?: number;
}

// Get all unique chat sessions for the current user
export async function getChatSessions(): Promise<ChatSession[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return [];

  // 1. Get messages with sessions
  const { data: sessionMessages, error } = await supabase
    .from("chat_logs")
    .select("session_id, content, created_at")
    .eq("user_id", user.id)
    .not("session_id", "is", null) // Exclude legacy messages here
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching chat sessions:", error);
    return [];
  }

  const sessionsMap = new Map<string, ChatSession>();

  // 2. Process Session Messages
  sessionMessages?.forEach(msg => {
    if (msg.session_id && !sessionsMap.has(msg.session_id)) {
      sessionsMap.set(msg.session_id, {
        session_id: msg.session_id,
        created_at: msg.created_at,
        last_message: msg.content.substring(0, 50) + (msg.content.length > 50 ? "..." : ""),
        message_count: 1
      });
    }
  });

  // 3. Check for Legacy Messages (NULL session_id)
  const { data: legacyMsg } = await supabase
    .from("chat_logs")
    .select("content, created_at")
    .eq("user_id", user.id)
    .is("session_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (legacyMsg) {
    // Add a virtual "Legacy" session
    const legacySession: ChatSession = {
      session_id: "legacy",
      created_at: legacyMsg.created_at, // Use date of most recent legacy msg
      last_message: "Legacy History", // Or use legacyMsg.content
      message_count: 1
    };
    // We can add it to the map or array. 
    // Let's add it to the map with a key that won't collide with UUIDs
    sessionsMap.set("legacy", legacySession);
  }

  // Convert map to array and sort by date descending
  return Array.from(sessionsMap.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// Get chat history for the current user, optionally filtered by session
// Now supports pagination with cursor-based navigation
export async function getChatHistory(
  sessionId?: string,
  options?: {
    limit?: number;
    cursor?: string;  // Message ID to start after
    direction?: 'older' | 'newer';
  }
): Promise<PaginatedResult<ChatMessage>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return { data: [], hasMore: false };
  }

  const limit = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const direction = options?.direction || 'newer';

  let query = supabase
    .from("chat_logs")
    .select("id, session_id, role, content, created_at")
    .eq("user_id", user.id);

  if (sessionId === "legacy") {
    query = query.is("session_id", null);
  } else if (sessionId) {
    query = query.eq("session_id", sessionId);
  } else {
    query = query.is("session_id", null);
  }

  // Apply cursor-based pagination
  if (options?.cursor) {
    if (direction === 'older') {
      query = query.lt("id", options.cursor);
    } else {
      query = query.gt("id", options.cursor);
    }
  }

  // Fetch one extra to check if there are more
  const { data, error } = await query
    .order("created_at", { ascending: direction === 'newer' })
    .limit(limit + 1);

  if (error) {
    console.error("Error fetching chat history:", error);
    return { data: [], hasMore: false };
  }

  const hasMore = (data?.length || 0) > limit;
  const results = data?.slice(0, limit) || [];

  // If fetching older, reverse to maintain chronological order
  if (direction === 'older') {
    results.reverse();
  }

  return {
    data: results,
    hasMore,
    nextCursor: hasMore && results.length > 0
      ? results[results.length - 1].id
      : undefined
  };
}

// Legacy function for backwards compatibility
export async function getChatHistoryLegacy(sessionId?: string): Promise<ChatMessage[]> {
  const result = await getChatHistory(sessionId, { limit: MAX_PAGE_SIZE });
  return result.data;
}

// Save a message to chat history
export async function saveChatMessage(message: ChatMessage): Promise<boolean> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return false;
  }

  const { error } = await supabase
    .from("chat_logs")
    .insert({
      user_id: user.id,
      session_id: message.session_id, // Now using the session_id
      role: message.role,
      content: message.content,
    });

  if (error) {
    console.error("Error saving chat message:", error);
    return false;
  }

  return true;
}

// Save multiple messages at once (for batch saving)
export async function saveChatMessages(messages: ChatMessage[]): Promise<boolean> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return false;
  }

  const messagesWithUser = messages.map(msg => ({
    user_id: user.id,
    session_id: msg.session_id,
    role: msg.role,
    content: msg.content,
  }));

  const { error } = await supabase
    .from("chat_logs")
    .insert(messagesWithUser);

  if (error) {
    console.error("Error saving chat messages:", error);
    return false;
  }

  return true;
}

// Clear chat history for the current user (optionally just one session)
export async function clearChatHistory(sessionId?: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return false;
  }

  let query = supabase
    .from("chat_logs")
    .delete()
    .eq("user_id", user.id);

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { error } = await query;

  if (error) {
    console.error("Error clearing chat history:", error);
    return false;
  }

  return true;
}

// Check if user has completed the questionnaire (has a soulprint)
export async function hasCompletedQuestionnaire(): Promise<boolean> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return false;
  }

  const { data, error } = await supabase
    .from("soulprints")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error checking soulprint:", error);
    return false;
  }

  return !!data;
}
