"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Upload, CheckCircle, AlertCircle, ChevronRight, Mail } from "lucide-react";
import JSZip from "jszip";

type ImportStatus = "idle" | "extracting" | "uploading" | "processing" | "complete" | "error";
type ImportMethod = "upload" | "email";

const IMPORT_EMAIL = "drew@arcaforge.com";

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<{ conversations: number; messages: number } | null>(null);
  const [importMethod, setImportMethod] = useState<ImportMethod>("upload");
  const [emailSent, setEmailSent] = useState(false);

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
      if (!file.name.endsWith(".zip") && !file.name.endsWith(".json")) {
        setError("Please select a ZIP or JSON file");
        return;
      }
      // Check file size - warn if over 50MB
      if (file.size > 50 * 1024 * 1024) {
        setError("File too large for browser upload. Please use the email method instead.");
        setImportMethod("email");
        return;
      }
      setSelectedFile(file);
      setError("");
    }
  };

  const extractConversationsFromZip = async (file: File): Promise<string> => {
    // If it's a JSON file, read it directly
    if (file.name.endsWith(".json")) {
      return await file.text();
    }
    
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
      setStatusMessage("Done!");

      setTimeout(() => router.push("/chat"), 1500);

    } catch (err) {
      console.error("Import error:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col px-6 py-8 safe-area-inset">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Import your data</h1>
        <p className="text-sm text-gray-500">Upload your ChatGPT export to personalize your experience</p>
      </div>

      {/* Instructions */}
      <div className="bg-[#141414] rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-medium text-white mb-4">How to export from ChatGPT</h2>
        <div className="space-y-3">
          {[
            "Open chat.openai.com",
            "Go to Settings → Data Controls",
            "Click Export Data",
            "Wait for email from OpenAI"
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#EA580C]/20 text-[#EA580C] text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-gray-400">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Method selector */}
      {status === "idle" && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setImportMethod("upload")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
              importMethod === "upload"
                ? "bg-[#EA580C] text-white"
                : "bg-[#141414] text-gray-400"
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Direct Upload
          </button>
          <button
            onClick={() => setImportMethod("email")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
              importMethod === "email"
                ? "bg-[#EA580C] text-white"
                : "bg-[#141414] text-gray-400"
            }`}
          >
            <Mail className="w-4 h-4 inline mr-2" />
            Forward Email
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Processing state */}
      {status !== "idle" && status !== "error" && (
        <div className="flex items-center gap-4 p-5 bg-[#141414] rounded-2xl mb-6">
          {status === "complete" ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <Loader2 className="w-6 h-6 text-[#EA580C] animate-spin" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{statusMessage}</p>
            {stats && (
              <p className="text-xs text-gray-500 mt-1">
                {stats.conversations} conversations • {stats.messages} messages
              </p>
            )}
          </div>
        </div>
      )}

      {/* Upload method */}
      {importMethod === "upload" && (status === "idle" || status === "error") && (
        <div className="flex-1 flex flex-col">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-[160px] border-2 border-dashed border-[#222] rounded-2xl flex flex-col items-center justify-center gap-4 active:border-[#EA580C]/50 active:bg-[#EA580C]/5 transition-all"
          >
            {selectedFile ? (
              <>
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
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
                <div className="w-12 h-12 rounded-full bg-[#EA580C]/20 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-[#EA580C]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Select ZIP or JSON file</p>
                  <p className="text-xs text-gray-500 mt-1">Works best for files under 50MB</p>
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
              Import & Continue
              <ChevronRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => router.push("/chat")}
              className="w-full h-12 text-gray-500 text-sm"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Email method */}
      {importMethod === "email" && status === "idle" && (
        <div className="flex-1 flex flex-col">
          <div className="bg-[#141414] rounded-2xl p-5 mb-6">
            <h3 className="text-sm font-medium text-white mb-3">For large exports (over 50MB)</h3>
            <p className="text-sm text-gray-400 mb-4">
              Forward the export email from OpenAI directly to us. Make sure to forward from the same email you signed up with.
            </p>
            
            <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]">
              <p className="text-xs text-gray-500 mb-1">Forward to:</p>
              <p className="text-lg font-mono text-[#EA580C] select-all">{IMPORT_EMAIL}</p>
            </div>
          </div>

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
                <p className="text-xs text-gray-500 mt-1">We&apos;ll process your data and notify you when ready.</p>
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
        </div>
      )}
    </main>
  );
}
