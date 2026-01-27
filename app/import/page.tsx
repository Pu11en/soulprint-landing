"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, ChevronRight, Mail, Loader2, Send } from "lucide-react";

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<'initial' | 'sending' | 'sent' | 'done'>('initial');
  const [error, setError] = useState<string | null>(null);

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

  const sendInstructions = async () => {
    setStep('sending');
    setError(null);

    try {
      const res = await fetch('/api/import/send-instructions', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send email');
      }

      setStep('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('initial');
    }
  };

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
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#EA580C] text-xs mt-1">•</span>
              <span className="text-sm text-gray-400">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 2: Get our email & reply */}
      <div className="bg-[#141414] rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-7 h-7 rounded-full bg-[#EA580C] text-white text-sm font-bold flex items-center justify-center">2</span>
          <h2 className="text-sm font-medium text-white">Send us your export</h2>
        </div>
        
        {step === 'initial' && (
          <>
            <p className="text-sm text-gray-400 mb-4 ml-10">
              We&apos;ll send you an email. Just <strong className="text-white">reply</strong> to it with your OpenAI export forwarded in the reply.
            </p>

            <button
              onClick={sendInstructions}
              className="w-full bg-[#EA580C] hover:bg-[#d14d0a] text-white font-medium rounded-xl p-4 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              <Send className="w-5 h-5" />
              Send me the email
            </button>
            
            {error && (
              <p className="text-xs text-red-400 mt-3 ml-10">{error}</p>
            )}
          </>
        )}

        {step === 'sending' && (
          <div className="flex items-center justify-center gap-3 py-4">
            <Loader2 className="w-5 h-5 text-[#EA580C] animate-spin" />
            <span className="text-sm text-gray-400">Sending email...</span>
          </div>
        )}

        {(step === 'sent' || step === 'done') && (
          <div className="space-y-4 ml-10">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-5 h-5 text-green-500" />
                <span className="text-sm text-green-400 font-medium">Email sent!</span>
              </div>
              <p className="text-xs text-gray-400">
                Check your inbox for an email from SoulPrint. Reply to it with your OpenAI export forwarded.
              </p>
            </div>

            <div className="text-xs text-gray-500 space-y-2">
              <p><strong className="text-gray-400">How to reply with your export:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-gray-500">
                <li>Open our email in your inbox</li>
                <li>Click Reply</li>
                <li>Forward/paste the OpenAI export email content</li>
                <li>Send</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3 mt-auto">
        {step === 'sent' && (
          <>
            <button
              onClick={() => setStep('done')}
              className="w-full h-12 bg-[#EA580C] hover:bg-[#d14d0a] text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              I&apos;ve replied with my export
              <ChevronRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={sendInstructions}
              className="w-full h-12 text-gray-500 text-sm hover:text-gray-400 transition-colors"
            >
              Resend email
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-green-400 font-medium">Perfect!</p>
              <p className="text-xs text-gray-500 mt-1">We&apos;ll process your data automatically. This may take a few minutes.</p>
            </div>
            
            <button
              onClick={() => router.push("/chat")}
              className="w-full h-12 bg-[#EA580C] hover:bg-[#d14d0a] text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              Continue to Chat
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {(step === 'initial' || step === 'sending') && (
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
