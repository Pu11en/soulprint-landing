'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, Shield, AlertCircle, Loader2, Lock, ChevronRight, Settings, Mail, Download, FileArchive, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { RingProgress } from '@/components/ui/ring-progress';
import { createClient } from '@/lib/supabase/client';
import JSZip from 'jszip';
import { tusUpload } from '@/lib/tus-upload';
import { getCsrfToken } from '@/lib/csrf';

type Phase = 'loading' | 'instructions' | 'upload' | 'processing' | 'error';

function ImportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReimport = searchParams.get('reimport') === 'true';
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Poll import status from database
  const startPolling = useCallback((userId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const supabase = createClient();

    pollRef.current = setInterval(async () => {
      try {
        const { data, error: pollError } = await supabase
          .from('user_profiles')
          .select('progress_percent, import_stage, import_status, import_error')
          .eq('user_id', userId)
          .single();

        if (pollError || !data) return;

        setProgress(data.progress_percent || 0);
        setStage(data.import_stage || 'Processing...');

        if (data.import_status === 'quick_ready' || data.import_status === 'complete') {
          if (pollRef.current) clearInterval(pollRef.current);
          setProgress(100);
          setStage('Done! Opening chat...');
          setTimeout(() => router.push('/chat'), 800);
        } else if (data.import_status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(data.import_error || 'Import failed. Please try again.');
          setPhase('error');
        }
      } catch {
        // Ignore poll errors, will retry next interval
      }
    }, 3000);
  }, [router]);

  // Auth gate + status check on page load
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Check current import status
      try {
        const res = await fetch('/api/memory/status');
        const data = await res.json();

        if (!isReimport && (data.status === 'ready' || data.hasSoulprint)) {
          router.push('/chat');
          return;
        }

        if (data.status === 'processing') {
          setPhase('processing');
          setProgress(data.progress_percent ?? 0);
          setStage(data.import_stage ?? 'Processing...');
          startPolling(user.id);
          return;
        }

        if (data.status === 'failed') {
          setError(data.import_error || 'Previous import failed.');
          setPhase('error');
          return;
        }
      } catch {
        // If status check fails, just show upload screen
      }

      setPhase('instructions');
    };
    init();
  }, [router, startPolling, isReimport]);

  // Handle file upload
  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError('Please upload a ZIP file from ChatGPT.');
      setPhase('error');
      return;
    }

    setPhase('processing');
    setProgress(0);
    setStage('Extracting conversations...');

    try {
      // 1. Get auth
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // 2. Extract or upload raw ZIP
      // Skip client-side extraction for files >100MB — JSZip loads the entire
      // file into memory which causes iOS/mobile browsers to hard-crash (OOM
      // kill) before any JS catch handler can run.
      let uploadBlob: Blob = file;
      let uploadFilename = file.name;
      let uploadContentType = 'application/zip';
      let fileType = 'zip';

      const FILE_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);

      if (file.size <= FILE_SIZE_LIMIT) {
        try {
          const zip = await JSZip.loadAsync(file);
          const conversationsFile = zip.file('conversations.json');

          if (!conversationsFile) {
            throw new Error('No conversations.json found in the ZIP. Make sure this is a ChatGPT export.');
          }

          const jsonBlob = await conversationsFile.async('blob');
          uploadBlob = jsonBlob;
          uploadFilename = 'conversations.json';
          uploadContentType = 'application/json';
          fileType = 'json';

          const sizeMB = (jsonBlob.size / 1024 / 1024).toFixed(1);
          setProgress(10);
          setStage(`Extracted ${sizeMB}MB — uploading...`);
        } catch (extractionError) {
          // JSZip failed — upload raw ZIP instead
          const isNoConversations = extractionError instanceof Error &&
            extractionError.message.includes('No conversations.json');
          if (isNoConversations) throw extractionError;

          console.warn('[Import] Client-side extraction failed, uploading raw ZIP:', extractionError);
          setProgress(5);
          setStage(`Uploading ${fileSizeMB}MB ZIP (server will extract)...`);
        }
      } else {
        // Large file — skip JSZip entirely, upload raw ZIP for server-side extraction
        console.log(`[Import] File is ${fileSizeMB}MB (>${FILE_SIZE_LIMIT / 1024 / 1024}MB), skipping client extraction`);
        setProgress(5);
        setStage(`Uploading ${fileSizeMB}MB ZIP (server will extract)...`);
      }

      // 3. Upload to storage
      console.log('[Import] Starting upload:', uploadFilename, uploadContentType, (uploadBlob.size / 1024 / 1024).toFixed(1), 'MB');
      const result = await tusUpload({
        file: uploadBlob,
        userId: user.id,
        filename: uploadFilename,
        contentType: uploadContentType,
        onProgress: (pct) => {
          setProgress(10 + Math.round(pct * 0.4)); // 10-50%
          setStage(`Uploading... ${pct}%`);
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setProgress(55);
      setStage('Starting analysis...');

      // 4. Trigger RLM
      const csrfToken = await getCsrfToken();
      const triggerRes = await fetch('/api/import/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        credentials: 'include',
        body: JSON.stringify({ storagePath: result.storagePath, fileType }),
      });

      if (triggerRes.status === 409) {
        setStage('Import already in progress...');
      } else if (!triggerRes.ok) {
        const err = await triggerRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start processing');
      }

      // 5. Poll for completion
      setStage('Analyzing your conversations...');
      startPolling(user.id);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      const stack = err instanceof Error ? err.stack : '';
      console.error('[Import] handleFile error:', msg, stack);

      // Log client-side error to server for debugging
      fetch('/api/import/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: msg,
          stack: stack?.slice(0, 500),
          fileSize: file.size,
          fileName: file.name,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {}); // Fire-and-forget

      // Auth errors → redirect to login
      if (msg.toLowerCase().includes('logged in') || msg.toLowerCase().includes('session expired')) {
        router.push('/login');
        return;
      }

      setError(msg);
      setPhase('error');
    }
  };

  // Reset user data
  const handleReset = async () => {
    if (!confirm('This will delete all your imported data. Are you sure?')) return;
    setIsResetting(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch('/api/user/reset', {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      if (!res.ok) throw new Error('Reset failed');
      setError('');
      setPhase('instructions');
    } catch {
      alert('Reset failed. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  // Loading screen
  if (phase === 'loading') {
    return (
      <main className="h-[100dvh] bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </main>
    );
  }

  return (
    <main className="h-[100dvh] bg-black flex flex-col overflow-hidden relative">
      <BackgroundBeams />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="SoulPrint" className="w-7 h-7" />
          <span className="text-white font-semibold text-sm">SoulPrint</span>
        </Link>
        <div className="flex items-center gap-3">
          {(phase === 'error' || phase === 'instructions') && (
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs disabled:opacity-50 transition-colors"
            >
              {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />}
              <span>{isResetting ? 'Resetting...' : 'Reset'}</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>Private</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">

          {/* INSTRUCTIONS */}
          {phase === 'instructions' && (
            <motion.div key="instructions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
              <h1 className="text-lg font-bold text-white mb-0.5 text-center">Export Your ChatGPT Data</h1>
              <p className="text-white/50 text-xs mb-3 text-center">Follow these steps, then upload the ZIP</p>

              <div className="space-y-2 mb-3">
                {[
                  { icon: Settings, title: '1. Open ChatGPT Settings', desc: 'Go to chat.openai.com → Profile → Settings' },
                  { icon: FileArchive, title: '2. Export your data', desc: 'Data Controls → Export Data → Confirm' },
                  { icon: Mail, title: '3. Check your email', desc: 'OpenAI emails you a download link (usually minutes)' },
                  { icon: Download, title: '4. Download the ZIP', desc: 'Click the link — upload the .zip file here' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-2.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/10">
                    <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3 h-3 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium leading-tight">{title}</p>
                      <p className="text-white/50 text-xs mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={() => setPhase('upload')} className="w-full bg-orange-500 hover:bg-orange-400 text-black font-semibold h-10">
                I have my ZIP file <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <a href="https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 mt-2 text-xs text-white/40 hover:text-white/60">
                Detailed guide <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>
          )}

          {/* UPLOAD */}
          {phase === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
              <h1 className="text-lg font-bold text-white mb-0.5 text-center">Upload Your Export</h1>
              <p className="text-white/50 text-xs mb-3 text-center">Drop the ZIP file you downloaded</p>

              <div
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); e.dataTransfer.files?.[0] && handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                  dragActive ? 'border-orange-500 bg-orange-500/10' : 'border-white/15 bg-white/[0.02] hover:border-orange-500/40'
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".zip" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 transition-colors ${dragActive ? 'bg-orange-500/20' : 'bg-white/5'}`}>
                  <Upload className={`w-6 h-6 ${dragActive ? 'text-orange-400' : 'text-white/40'}`} />
                </div>
                <p className="text-white font-medium text-sm mb-0.5">{dragActive ? 'Drop it here!' : 'Drop ZIP file here'}</p>
                <p className="text-white/40 text-xs">or tap to browse</p>
              </div>

              <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                <Shield className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                <p className="text-white/50 text-[11px]">Your data is encrypted and processed securely</p>
              </div>

              <button onClick={() => setPhase('instructions')} className="mt-3 text-white/40 text-xs hover:text-white/60 w-full text-center">
                &larr; Back to instructions
              </button>
            </motion.div>
          )}

          {/* PROCESSING */}
          {phase === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md text-center">
              <div className="mb-4 flex flex-col items-center">
                <RingProgress progress={progress} size={80} strokeWidth={6} showPercentage />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">{stage || 'Processing...'}</h2>
              <div className="mt-4 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
              </div>
              {progress >= 55 ? (
                <p className="text-green-400/80 text-xs mt-3">Safe to close this tab — processing continues in the background</p>
              ) : (
                <p className="text-orange-400/80 text-xs mt-3">Please keep this tab open until upload completes</p>
              )}
            </motion.div>
          )}

          {/* ERROR */}
          {phase === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Something went wrong</h2>
              <p className="text-white/50 text-xs mb-4">{error}</p>
              <div className="space-y-2">
                <Button onClick={() => { setError(''); setPhase('upload'); }} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 h-9">
                  Try Again
                </Button>
                <button onClick={handleReset} disabled={isResetting} className="w-full py-1.5 rounded bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 disabled:opacity-50">
                  {isResetting ? 'Resetting...' : 'Reset & Start Fresh'}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={
      <main className="h-[100dvh] bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </main>
    }>
      <ImportPageContent />
    </Suspense>
  );
}
