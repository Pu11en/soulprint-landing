"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronRight, ExternalLink } from "lucide-react";
import Image from "next/image";

export default function ExportInstructionsPage() {
  const router = useRouter();

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
    <main className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col px-6 py-8">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-full bg-[#EA580C] text-white text-sm font-bold flex items-center justify-center">1</div>
        <div className="flex-1 h-1 bg-[#222] rounded-full">
          <div className="w-1/2 h-full bg-[#EA580C] rounded-full" />
        </div>
        <div className="w-8 h-8 rounded-full bg-[#222] text-gray-500 text-sm font-bold flex items-center justify-center">2</div>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Export your ChatGPT data</h1>
        <p className="text-sm text-gray-500">Follow these steps to download your conversation history</p>
      </div>

      {/* Steps */}
      <div className="flex-1 space-y-4">
        <div className="bg-[#141414] rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <span className="w-8 h-8 rounded-full bg-[#EA580C]/20 text-[#EA580C] text-sm font-bold flex items-center justify-center flex-shrink-0">1</span>
            <div>
              <h3 className="text-white font-medium mb-1">Open ChatGPT Settings</h3>
              <p className="text-sm text-gray-500">Go to chat.openai.com → click your profile → Settings</p>
            </div>
          </div>
        </div>

        <div className="bg-[#141414] rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <span className="w-8 h-8 rounded-full bg-[#EA580C]/20 text-[#EA580C] text-sm font-bold flex items-center justify-center flex-shrink-0">2</span>
            <div>
              <h3 className="text-white font-medium mb-1">Go to Data Controls</h3>
              <p className="text-sm text-gray-500">Click the "Data controls" tab in Settings</p>
            </div>
          </div>
        </div>

        <div className="bg-[#141414] rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <span className="w-8 h-8 rounded-full bg-[#EA580C]/20 text-[#EA580C] text-sm font-bold flex items-center justify-center flex-shrink-0">3</span>
            <div>
              <h3 className="text-white font-medium mb-1">Click "Export data"</h3>
              <p className="text-sm text-gray-500">Scroll down and click the Export data button</p>
            </div>
          </div>
          {/* Screenshot showing where to click */}
          <div className="mt-4 rounded-xl overflow-hidden border border-[#333]">
            <Image
              src="/images/chatgpt-export-guide.jpg"
              alt="ChatGPT Data Controls - Export data button"
              width={400}
              height={300}
              className="w-full h-auto"
            />
          </div>
        </div>

        <div className="bg-[#141414] rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <span className="w-8 h-8 rounded-full bg-[#EA580C]/20 text-[#EA580C] text-sm font-bold flex items-center justify-center flex-shrink-0">4</span>
            <div>
              <h3 className="text-white font-medium mb-1">Wait for email</h3>
              <p className="text-sm text-gray-500">You'll see this notification, then check your email (5-30 min)</p>
            </div>
          </div>
          {/* Success notification screenshot */}
          <div className="mt-4 rounded-xl overflow-hidden border border-[#333]">
            <Image
              src="/images/chatgpt-export-success.jpg"
              alt="ChatGPT export success notification"
              width={400}
              height={100}
              className="w-full h-auto"
            />
          </div>
        </div>

        <div className="bg-[#141414] rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <span className="w-8 h-8 rounded-full bg-[#EA580C]/20 text-[#EA580C] text-sm font-bold flex items-center justify-center flex-shrink-0">5</span>
            <div>
              <h3 className="text-white font-medium mb-1">Download your ZIP</h3>
              <p className="text-sm text-gray-500">Click the link in the email to get your data file</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-3">
        <a
          href="https://chat.openai.com"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-12 bg-[#141414] border border-[#333] text-white font-medium rounded-xl flex items-center justify-center gap-2"
        >
          Open ChatGPT
          <ExternalLink className="w-4 h-4" />
        </a>
        
        <button
          onClick={() => router.push("/onboarding/upload")}
          className="w-full h-12 bg-[#EA580C] hover:bg-[#d14d0a] text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          I have my ZIP file
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </main>
  );
}
