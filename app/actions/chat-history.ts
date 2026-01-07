"use server";

import { createClient } from "@/lib/supabase/server";

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

// Get all unique chat sessions for the current user
export async function getChatSessions(): Promise<ChatSession[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return [];

  // Group by session_id and get metadata
  // Note: Since we don't have a sessions table, we infer sessions from logs
  // We'll get the latest message for each session
  const { data, error } = await supabase
    .from("chat_logs")
    .select("session_id, content, created_at")
    .eq("user_id", user.id)
    .not("session_id", "is", null) // Exclude legacy messages without session
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching chat sessions:", error);
    return [];
  }

  // Manually group by session_id (since we can't do complex GROUP BY via simple query easily)
  const sessionsMap = new Map<string, ChatSession>();

  data?.forEach(msg => {
    if (msg.session_id && !sessionsMap.has(msg.session_id)) {
      sessionsMap.set(msg.session_id, {
        session_id: msg.session_id,
        created_at: msg.created_at,
        last_message: msg.content.substring(0, 50) + (msg.content.length > 50 ? "..." : ""),
        message_count: 1 // Placeholder, calculating count would require more query
      });
    }
  });

  return Array.from(sessionsMap.values());
}

// Get chat history for the current user, optionally filtered by session
export async function getChatHistory(sessionId?: string): Promise<ChatMessage[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return [];
  }

  let query = supabase
    .from("chat_logs")
    .select("id, session_id, role, content, created_at")
    .eq("user_id", user.id);

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  } else {
    // If no session ID provided, maybe fetch messages with NO session ID?
    // Or just all messages? Usually we want a specific session.
    // For backward compatibility, if no session ID, we fetch everything or just legacy?
    // Let's fetch everything for now as default behavior.
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching chat history:", error);
    return [];
  }

  return data || [];
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
