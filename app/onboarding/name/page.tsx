"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ChevronLeft, Sparkles } from "lucide-react";

export default function NamePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
      }
    };
    checkAuth();
  }, [router]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Save the AI name to soulprints table
      const { error: dbError } = await supabase
        .from("soulprints")
        .upsert({
          user_id: user.id,
          soulprint_data: {
            ai_name: name.trim(),
            created_at: new Date().toISOString(),
          },
        }, {
          onConflict: "user_id",
        });

      if (dbError) {
        throw dbError;
      }

      router.push("/chat");
    } catch (err) {
      console.error("Error saving name:", err);
      setError("Failed to save. Please try again.");
      setLoading(false);
    }
  };

  const suggestions = ["Atlas", "Nova", "Echo", "Sage", "Aria", "Kai"];

  return (
    <main className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col px-6 py-8">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-full bg-[#EA580C]/20 text-[#EA580C] text-sm font-bold flex items-center justify-center">✓</div>
        <div className="flex-1 h-1 bg-[#EA580C] rounded-full" />
        <div className="w-8 h-8 rounded-full bg-[#EA580C]/20 text-[#EA580C] text-sm font-bold flex items-center justify-center">✓</div>
        <div className="flex-1 h-1 bg-[#EA580C] rounded-full" />
        <div className="w-8 h-8 rounded-full bg-[#EA580C] text-white text-sm font-bold flex items-center justify-center">3</div>
      </div>

      {/* Back button */}
      <button
        onClick={() => router.push("/onboarding/upload")}
        className="flex items-center gap-1 text-gray-500 text-sm mb-4 -ml-1"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Name your AI</h1>
        <p className="text-sm text-gray-500">Give your personal AI companion a name</p>
      </div>

      {/* Icon */}
      <div className="flex justify-center mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#EA580C] to-[#dc2626] flex items-center justify-center shadow-lg shadow-[#EA580C]/30">
          <Sparkles className="w-12 h-12 text-white" />
        </div>
      </div>

      {/* Name input */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Enter a name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          className="w-full h-14 px-5 bg-[#141414] border border-[#333] rounded-xl text-lg text-white text-center placeholder:text-gray-600 focus:outline-none focus:border-[#EA580C] transition-colors"
        />
      </div>

      {/* Suggestions */}
      <div className="mb-8">
        <p className="text-xs text-gray-500 text-center mb-3">Or pick a suggestion:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setName(s)}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                name === s
                  ? "bg-[#EA580C] text-white"
                  : "bg-[#1a1a1a] text-gray-400 hover:bg-[#222]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
          {error}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={loading || !name.trim()}
        className="w-full h-12 bg-[#EA580C] hover:bg-[#d14d0a] disabled:bg-[#EA580C]/40 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:active:scale-100"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          "Continue"
        )}
      </button>
    </main>
  );
}
