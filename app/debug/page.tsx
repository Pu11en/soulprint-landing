"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { RefreshCw, Database, Brain, MessageSquare, User, Zap } from "lucide-react";

interface DebugData {
  user: {
    id: string;
    email: string;
  } | null;
  profile: {
    full_name: string;
  } | null;
  soulprint: {
    ai_name?: string;
    soul_prompt?: string;
    communication_style?: string;
    personality_traits?: string[];
    interests?: string[];
    analyzed_at?: string;
    message_count?: number;
  } | null;
  importedChats: {
    count: number;
    sample: { role: string; content: string; conversation_title: string }[];
  };
  chatLogs: {
    count: number;
  };
}

export default function DebugPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DebugData | null>(null);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.replace("/");
        return;
      }

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      // Get soulprint
      const { data: soulprint } = await supabase
        .from("soulprints")
        .select("soulprint_data")
        .eq("user_id", user.id)
        .single();

      // Get imported chats count and sample
      const { count: importCount } = await supabase
        .from("imported_chats")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { data: importSample } = await supabase
        .from("imported_chats")
        .select("role, content, conversation_title")
        .eq("user_id", user.id)
        .order("original_timestamp", { ascending: false })
        .limit(5);

      // Get chat logs count
      const { count: chatCount } = await supabase
        .from("chat_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setData({
        user: { id: user.id, email: user.email || "" },
        profile,
        soulprint: soulprint?.soulprint_data as DebugData["soulprint"],
        importedChats: {
          count: importCount || 0,
          sample: importSample || [],
        },
        chatLogs: { count: chatCount || 0 },
      });
    } catch (err) {
      console.error("Debug fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-[#EA580C] animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-[#EA580C]" />
            Debug Panel
          </h1>
          <button
            onClick={fetchData}
            className="p-2 bg-[#1a1a1a] rounded-lg hover:bg-[#222] transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4 text-red-400">
            {error}
          </div>
        )}

        {/* User Info */}
        <Section icon={<User className="w-5 h-5" />} title="User">
          <div className="space-y-2 text-sm">
            <Row label="ID" value={data?.user?.id || "—"} mono />
            <Row label="Email" value={data?.user?.email || "—"} />
            <Row label="Name" value={data?.profile?.full_name || "—"} />
          </div>
        </Section>

        {/* SoulPrint */}
        <Section icon={<Brain className="w-5 h-5" />} title="SoulPrint (SOUL.md)">
          {data?.soulprint ? (
            <div className="space-y-4 text-sm">
              <Row label="AI Name" value={data.soulprint.ai_name || "Not set"} highlight />
              <Row label="Analyzed At" value={data.soulprint.analyzed_at || "—"} />
              <Row label="Messages Analyzed" value={String(data.soulprint.message_count || 0)} />
              <Row label="Communication Style" value={data.soulprint.communication_style || "—"} />
              
              {data.soulprint.personality_traits && data.soulprint.personality_traits.length > 0 && (
                <div>
                  <p className="text-gray-500 mb-1">Personality Traits:</p>
                  <div className="flex flex-wrap gap-2">
                    {data.soulprint.personality_traits.map((t, i) => (
                      <span key={i} className="px-2 py-1 bg-[#EA580C]/20 text-[#EA580C] rounded text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.soulprint.interests && data.soulprint.interests.length > 0 && (
                <div>
                  <p className="text-gray-500 mb-1">Interests:</p>
                  <div className="flex flex-wrap gap-2">
                    {data.soulprint.interests.map((t, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.soulprint.soul_prompt && (
                <div>
                  <p className="text-gray-500 mb-1">Soul Prompt (injected into every chat):</p>
                  <pre className="p-3 bg-[#0a0a0a] border border-[#333] rounded-lg text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">
                    {data.soulprint.soul_prompt}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No SoulPrint generated yet. Import chat history first.</p>
          )}
        </Section>

        {/* Imported Chats */}
        <Section icon={<Database className="w-5 h-5" />} title="Imported Chat History">
          <div className="space-y-3 text-sm">
            <Row label="Total Messages" value={String(data?.importedChats.count || 0)} highlight />
            
            {data?.importedChats.sample && data.importedChats.sample.length > 0 && (
              <div>
                <p className="text-gray-500 mb-2">Recent imports (newest first):</p>
                <div className="space-y-2">
                  {data.importedChats.sample.map((msg, i) => (
                    <div key={i} className="p-2 bg-[#0a0a0a] border border-[#222] rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          msg.role === 'user' ? 'bg-[#EA580C]/20 text-[#EA580C]' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {msg.role}
                        </span>
                        <span className="text-xs text-gray-600">{msg.conversation_title}</span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Chat Logs */}
        <Section icon={<MessageSquare className="w-5 h-5" />} title="Native Chat Logs">
          <Row label="Total Messages" value={String(data?.chatLogs.count || 0)} />
        </Section>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push("/chat")}
            className="flex-1 h-12 bg-[#EA580C] text-white font-medium rounded-xl"
          >
            Go to Chat
          </button>
          <button
            onClick={() => router.push("/onboarding/export")}
            className="flex-1 h-12 bg-[#1a1a1a] border border-[#333] text-white font-medium rounded-xl"
          >
            Import Data
          </button>
        </div>
      </div>
    </main>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 p-4 bg-[#111] border border-[#222] rounded-xl">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-[#EA580C]">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-[#1a1a1a] last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={`${mono ? 'font-mono text-xs' : ''} ${highlight ? 'text-[#EA580C] font-medium' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}
