"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Upload, CheckCircle, AlertCircle, ChevronLeft } from "lucide-react";
import JSZip from "jszip";

type ImportStatus = "idle" | "extracting" | "processing" | "complete" | "error";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<{ conversations: number; messages: number } | null>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".zip")) {
        setError("Please select a ZIP file");
        return;
      }
      setSelectedFile(file);
      setError("");
    }
  };

  const extractConversationsFromZip = async (file: File): Promise<string> => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    const conversationsFile = contents.file("conversations.json");
    if (!conversationsFile) {
      throw new Error("conversations.json not found in ZIP");
    }
    return await conversationsFile.async("text");
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setError("");
    setStatus("extracting");
    setStatusMessage("Extracting...");

    try {
      const conversationsJson = await extractConversationsFromZip(selectedFile);
      const parsed = JSON.parse(conversationsJson);
      const conversationCount = Array.isArray(parsed) ? parsed.length : 0;
      
      setStatus("processing");
      setStatusMessage(`Processing ${conversationCount} conversations...`);

      const response = await fetch("/api/import/gpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversations: conversationsJson, fastMode: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      setStats({
        conversations: result.stats?.conversationsImported || 0,
        messages: result.stats?.messagesImported || 0,
      });

      setStatus("complete");
      setStatusMessage("Import complete!");

    } catch (err) {
      console.error("Import error:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col px-6 py-8">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-full bg-[#EA580C]/20 text-[#EA580C] text-sm font-bold flex items-center justify-center">✓</div>
        <div className="flex-1 h-1 bg-[#EA580C] rounded-full" />
        <div className="w-8 h-8 rounded-full bg-[#EA580C] text-white text-sm font-bold flex items-center justify-center">2</div>
      </div>

      {/* Back button */}
      <button
        onClick={() => router.push("/onboarding/export")}
        className="flex items-center gap-1 text-gray-500 text-sm mb-4 -ml-1"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Upload your export</h1>
        <p className="text-sm text-gray-500">Select the ZIP file you downloaded from ChatGPT</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Processing state */}
      {status === "extracting" || status === "processing" ? (
        <div className="flex items-center gap-4 p-5 bg-[#141414] rounded-2xl mb-6">
          <Loader2 className="w-6 h-6 text-[#EA580C] animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{statusMessage}</p>
          </div>
        </div>
      ) : null}

      {/* Success state */}
      {status === "complete" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Import Complete!</h2>
          <p className="text-gray-500 mb-2">Your ChatGPT history has been imported.</p>
          {stats && (
            <p className="text-sm text-[#EA580C] mb-8">
              {stats.conversations} conversations • {stats.messages} messages
            </p>
          )}
          <button
            onClick={() => router.push("/onboarding/name")}
            className="w-full max-w-xs h-12 bg-[#EA580C] hover:bg-[#d14d0a] text-white font-medium rounded-xl transition-all active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      )}

      {/* File picker */}
      {(status === "idle" || status === "error") && (
        <div className="flex-1 flex flex-col">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-[200px] border-2 border-dashed border-[#333] rounded-2xl flex flex-col items-center justify-center gap-4 active:border-[#EA580C]/50 active:bg-[#EA580C]/5 transition-all"
          >
            {selectedFile ? (
              <>
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <span className="text-xs text-[#EA580C]">Tap to change</span>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-[#EA580C]/20 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-[#EA580C]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Select ZIP file</p>
                  <p className="text-xs text-gray-500 mt-1">Tap to browse</p>
                </div>
              </>
            )}
          </button>

          {/* Actions */}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleUpload}
              disabled={!selectedFile}
              className="w-full h-12 bg-[#EA580C] hover:bg-[#d14d0a] disabled:bg-[#EA580C]/40 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:active:scale-100"
            >
              Upload & Continue
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
