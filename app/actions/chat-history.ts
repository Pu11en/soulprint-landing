"use server";

import { createClient } from "@/lib/supabase/server";

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

// Get chat history for the current user
export async function getChatHistory(): Promise<ChatMessage[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from("chat_logs")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

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

// Clear chat history for the current user
export async function clearChatHistory(): Promise<boolean> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return false;
  }

  const { error } = await supabase
    .from("chat_logs")
    .delete()
    .eq("user_id", user.id);

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
