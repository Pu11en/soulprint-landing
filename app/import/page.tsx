"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, ChevronRight, Mail } from "lucide-react";

const IMPORT_EMAIL = "waitlist@archeforge.com";

export default function ImportPage() {
  const router = useRouter();
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

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

  return (
    <main className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col px-6 py-8 safe-area-inset">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Import your data</h1>
        <p className="text-sm text-gray-500">Connect your ChatGPT history to personalize your experience</p>
      </div>

      {/* Step 1: Export from ChatGPT */}
      <div className="bg-[#141414] rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-7 h-7 rounded-full bg-[#EA580C] text-white text-sm font-bold flex items-center justify-center">1</span>
          <h2 className="text-sm font-medium text-white">Export from ChatGPT</h2>
        </div>
        <div className="space-y-3 ml-10">
          {[
            "Open chat.openai.com",
            "Go to Settings → Data Controls",
            "Click \"Export Data\"",
            "Wait for email from OpenAI (5-30 min)"
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#EA580C] text-xs mt-1">•</span>
              <span className="text-sm text-gray-400">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 2: Forward the email */}
      <div className="bg-[#141414] rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-7 h-7 rounded-full bg-[#EA580C] text-white text-sm font-bold flex items-center justify-center">2</span>
          <h2 className="text-sm font-medium text-white">Forward the email to us</h2>
        </div>
        
        <p className="text-sm text-gray-400 mb-4 ml-10">
          When you receive the email from OpenAI, forward the entire email to:
        </p>

        <button
          onClick={() => {
            navigator.clipboard.writeText(IMPORT_EMAIL);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="w-full bg-[#0a0a0a] rounded-xl p-4 border border-[#222] hover:border-[#EA580C]/50 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-xs text-gray-500 mb-1">Tap to copy</p>
              <p className="text-lg font-mono text-[#EA580C] group-hover:text-[#ff6b1a] transition-colors">{IMPORT_EMAIL}</p>
            </div>
            <Mail className="w-5 h-5 text-gray-500 group-hover:text-[#EA580C] transition-colors" />
          </div>
          {copied && <p className="text-xs text-green-400 mt-2 text-left">Copied to clipboard!</p>}
        </button>

        <p className="text-xs text-gray-500 mt-3 ml-10">
          ⚠️ Forward from the same email you signed up with
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-3 mt-auto">
        {!emailSent ? (
          <button
            onClick={() => setEmailSent(true)}
            className="w-full h-12 bg-[#EA580C] hover:bg-[#d14d0a] text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            I&apos;ve forwarded the email
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-green-400 font-medium">Got it!</p>
            <p className="text-xs text-gray-500 mt-1">We&apos;ll process your data automatically. This may take a few minutes.</p>
          </div>
        )}
        
        {emailSent && (
          <button
            onClick={() => router.push("/chat")}
            className="w-full h-12 bg-[#EA580C] hover:bg-[#d14d0a] text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            Continue to Chat
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {!emailSent && (
          <button
            onClick={() => router.push("/chat")}
            className="w-full h-12 text-gray-500 text-sm"
          >
            Skip for now
          </button>
        )}
      </div>
    </main>
  );
}
