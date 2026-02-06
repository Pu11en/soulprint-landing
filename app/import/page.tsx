'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, Shield, CheckCircle2, AlertCircle, Loader2, Lock, ExternalLink, Settings, Mail, Download, FileArchive, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { RingProgress } from '@/components/ui/ring-progress';
// Client-side soulprint generation removed - all imports now use server-side RLM
import { createClient } from '@/lib/supabase/client';
import JSZip from 'jszip';
import { uploadWithProgress, chunkedUpload } from '@/lib/chunked-upload';

// Detect mobile devices (conservative - if unsure, treat as mobile)
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return true;
  const ua = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
}

type ImportStatus = 'idle' | 'processing' | 'saving' | 'success' | 'error';
type Step = 'export' | 'upload' | 'processing' | 'done';

// Safe JSON parsing - handles non-JSON error responses from server
async function safeJsonParse(response: Response): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return { ok: response.ok, data };
    } catch {
      // Response was not JSON (e.g., "Request Entity Too Large")
      return { ok: false, error: text || `HTTP ${response.status}` };
    }
  } catch (e) {
    return { ok: false, error: 'Failed to read response' };
  }
}

// IndexedDB helpers for storing large datasets client-side
const DB_NAME = 'soulprint_import';
const DB_VERSION = 1;

async function openImportDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('chunks')) {
        db.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('raw')) {
        db.createObjectStore('raw', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function storeChunksInDB(db: IDBDatabase, chunks: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite');
    const store = tx.objectStore('chunks');
    store.clear(); // Clear old data
    chunks.forEach(chunk => store.add(chunk));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function storeRawInDB(db: IDBDatabase, conversations: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('raw', 'readwrite');
    const store = tx.objectStore('raw');
    store.clear(); // Clear old data
    conversations.forEach(conv => store.add(conv));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function ImportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReimport = searchParams.get('reimport') === 'true';
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>('export');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (uploadProgressIntervalRef.current) clearInterval(uploadProgressIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const handleReset = async () => {
    if (!confirm('This will delete all your imported data and let you start fresh. Are you sure?')) return;

    setIsResetting(true);
    try {
      // Use user self-reset endpoint (works for any logged-in user)
      const res = await fetch('/api/user/reset', {
        method: 'DELETE',
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Reset failed');
      }

      // Refresh the page to start fresh
      window.location.reload();
    } catch (err) {
      alert('Reset failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await fetch('/api/memory/status');
        const data = await res.json();

        // Allow retry if import failed - show the error message
        if (data.status === 'failed' || data.failed) {
          setIsReturningUser(true);
          if (data.import_error) {
            setErrorMessage(data.import_error);
            setStatus('error');
          }
          setCheckingExisting(false);
          return;
        }

        // Check for STUCK imports (processing for >15 minutes)
        if (data.status === 'processing' && data.processing_started_at) {
          const startedAt = new Date(data.processing_started_at).getTime();
          const minutesElapsed = (Date.now() - startedAt) / 1000 / 60;

          if (minutesElapsed > 15) {
            // Import appears stuck - let user retry
            console.log(`[Import] Stuck detected: processing for ${minutesElapsed.toFixed(0)} minutes`);
            setIsReturningUser(true);
            setErrorMessage(
              `Your import has been processing for ${Math.round(minutesElapsed)} minutes. ` +
              `This is longer than expected. You can try again or contact support.`
            );
            setStatus('error');
            setCheckingExisting(false);
            return;
          }
        }

        // Check if user already has a soulprint (locked or complete)
        // Skip redirect if user explicitly wants to re-import
        if (!isReimport && (data.status === 'ready' || data.hasSoulprint || data.locked)) {
          router.push('/chat');
          return;
        }
        // Also redirect if import is still processing (let them see progress in chat)
        // But allow re-import if explicitly requested
        if (!isReimport && data.status === 'processing') {
          router.push('/chat');
          return;
        }

        // If re-importing, mark as returning user to show appropriate UI
        if (isReimport && (data.hasSoulprint || data.status === 'ready')) {
          setIsReturningUser(true);
        }
        // Check if this is a returning user (logged in but no soulprint)
        // They'll see a friendly message about re-importing
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user && !data.hasSoulprint) {
          setIsReturningUser(true);
        }
      } catch (error) {
        console.error('[Import] Error checking existing status:', error);
      }
      setCheckingExisting(false);
    };
    checkExisting();
  }, [router, isReimport]);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setErrorMessage('Please upload a ZIP file');
      setStatus('error');
      return;
    }

    const isMobile = isMobileDevice();
    const fileSizeMB = file.size / 1024 / 1024;

    // Mobile can't handle large files - warn early
    if (isMobile && fileSizeMB > 100) {
      setErrorMessage(
        `Your export is ${fileSizeMB.toFixed(0)}MB — too large for mobile upload. ` +
        `Please use a desktop/laptop browser for files over 100MB.`
      );
      setStatus('error');
      return;
    }

    setStatus('processing');
    setCurrentStep('processing');
    setProgress(0);

    try {
      // All imports use server-side RLM processing
        let uploadBlob: Blob;
        let uploadFilename: string;

        // DESKTOP: Extract conversations.json from ZIP client-side (much smaller upload!)
        // MOBILE: Upload full ZIP (JSZip crashes mobile browsers on large files)
        if (!isMobile) {
          setProgressStage('Extracting conversations...');
          setProgress(5);

          try {
            console.log('[Import] Desktop: extracting conversations.json from ZIP...');
            const zip = await JSZip.loadAsync(file);
            const conversationsFile = zip.file('conversations.json');

            if (!conversationsFile) {
              throw new Error('No conversations.json found in ZIP. Make sure you uploaded the correct ChatGPT export.');
            }

            const jsonContent = await conversationsFile.async('blob');
            uploadBlob = jsonContent;
            uploadFilename = 'conversations.json';

            const originalMB = (file.size / 1024 / 1024).toFixed(1);
            const extractedMB = (jsonContent.size / 1024 / 1024).toFixed(1);
            const extractedSizeNum = jsonContent.size / 1024 / 1024;
            console.log(`[Import] Extracted conversations.json: ${extractedMB}MB (original ZIP: ${originalMB}MB)`);
            
            // Warn for very large JSON files
            if (extractedSizeNum > 500) {
              setProgressStage(`Large file (${extractedMB}MB) — this may take several minutes...`);
            } else {
              setProgressStage(`Extracted ${extractedMB}MB (was ${originalMB}MB ZIP)`);
            }
          } catch (extractErr) {
            console.error('[Import] Desktop extraction failed, falling back to ZIP upload:', extractErr);
            // Fall back to ZIP upload if extraction fails
            uploadBlob = file;
            uploadFilename = file.name;
          }
        } else {
          // Mobile: upload full ZIP
          uploadBlob = file;
          uploadFilename = file.name;
        }

        const isJson = uploadFilename.endsWith('.json');

        // Use Client-Side Upload (Standard Supabase) to bypass Vercel limits
        // The 'imports' bucket must have RLS policies set for this to work
        setProgressStage('Uploading securely to storage...');
        setProgress(15);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('You must be logged in to upload');

        const timestamp = Date.now();
        // Sanitize filename to avoid issues
        const cleanName = uploadFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uploadPath = `${user.id}/${timestamp}-${cleanName}`;

        const blobSizeMB = uploadBlob.size / 1024 / 1024;
        console.log(`[Import] Starting upload: ${uploadPath} (${blobSizeMB.toFixed(1)}MB) mobile=${isMobile}`);
        setProgressStage(`Uploading ${blobSizeMB.toFixed(1)}MB...`);

        // Get Supabase storage URL and auth token for direct XHR upload
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        if (!accessToken) {
          throw new Error('Session expired. Please refresh and try again.');
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const contentType = uploadFilename.endsWith('.json') ? 'application/json' : 'application/zip';
        
        // Use chunked upload for files > 100MB, otherwise direct upload
        const CHUNKED_THRESHOLD = 100 * 1024 * 1024; // 100MB
        let storagePath: string;

        if (uploadBlob.size > CHUNKED_THRESHOLD) {
          // CHUNKED UPLOAD for large files (100MB+)
          console.log(`[Import] Using CHUNKED upload for ${blobSizeMB.toFixed(1)}MB file`);
          setProgressStage(`Uploading ${blobSizeMB.toFixed(1)}MB in chunks...`);

          const uploadId = `${user.id}-${timestamp}`;
          const chunkedUrl = '/api/import/chunked-upload';

          const chunkResult = await chunkedUpload(
            uploadBlob,
            chunkedUrl,
            accessToken,
            (progress) => {
              // Map upload progress to 15-50% range
              const mappedProgress = 15 + (progress.percent * 0.35);
              setProgress(Math.round(mappedProgress));
              setProgressStage(`Uploading chunk ${progress.chunk}/${progress.totalChunks} (${progress.percent}%)`);
            },
            uploadId
          );

          if (!chunkResult.success) {
            console.error('[Import] Chunked upload failed:', chunkResult.error);
            throw new Error(chunkResult.error || 'Upload failed');
          }

          storagePath = chunkResult.path || `imports/${user.id}/${timestamp}-conversations.json`;
          console.log('[Import] Chunked upload complete:', storagePath);
        } else {
          // DIRECT UPLOAD for smaller files (<100MB)
          const uploadUrl = `${supabaseUrl}/storage/v1/object/imports/${uploadPath}`;
          console.log(`[Import] Using direct XHR upload to: ${uploadUrl}`);

          const uploadResult = await uploadWithProgress(
            uploadBlob,
            uploadUrl,
            accessToken,
            contentType,
            (percent) => {
              // Map upload progress to 15-50% range
              const mappedProgress = 15 + (percent * 0.35);
              setProgress(Math.round(mappedProgress));
              setProgressStage(`Uploading... ${percent}%`);
            }
          );

          if (!uploadResult.success) {
            console.error('[Import] XHR upload failed:', uploadResult.error);
            throw new Error(uploadResult.error || 'Upload failed');
          }

          storagePath = `imports/${uploadPath}`;
        }

        console.log('[Import] Upload complete');
        setProgressStage('Upload complete! Starting processing...');
        setProgress(52);

        setProgressStage('Analyzing your conversations...');
        setProgress(55);

        // Small delay to let browser settle after large upload
        await new Promise(r => setTimeout(r, 500));

        // Start progress animation for server processing (55% -> 95%)
        let currentProgress = 55;
        progressIntervalRef.current = setInterval(() => {
          // Slow progress that never quite reaches 100%
          currentProgress = Math.min(currentProgress + 0.5, 95);
          setProgress(Math.round(currentProgress));

          // Update stage text based on progress
          if (currentProgress < 65) {
            setProgressStage('Downloading and extracting...');
          } else if (currentProgress < 75) {
            setProgressStage('Parsing conversations...');
          } else if (currentProgress < 85) {
            setProgressStage('Creating your SoulPrint...');
          } else {
            setProgressStage('Almost done...');
          }
        }, 1000);

        // Process on server - NO timeout, let it complete (up to 5 min)
        let queueRes;
        try {
          queueRes = await fetch('/api/import/queue-processing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              storagePath,
              filename: uploadFilename,
              fileSize: uploadBlob.size,
              isExtracted: uploadFilename.endsWith('.json'), // Tell server if we pre-extracted
            }),
          });
        } catch (e) {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          console.error('[Import] queue-processing failed:', e);
          throw new Error('Processing failed. Please try again.');
        }

        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

        if (!queueRes.ok) {
          const err = await queueRes.json().catch((e) => { console.warn("[JSON parse]", e); return {}; });
          console.error('[Import] queue-processing error:', err);
          throw new Error(err.error || 'Processing failed. Please try again.');
        }

        const result = await queueRes.json();
        console.log('[Import] Processing complete:', result);

      // Success! Show completion - DO NOT redirect, user waits for email
      setProgressStage('Complete! We\'ll email you when ready.');
      setProgress(100);
      setStatus('success');
      setCurrentStep('done');
    } catch (err) {
      console.error('Import error:', err);
      // Map technical errors to user-friendly messages
      let userMessage = 'Processing failed. Please try again.';
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
          userMessage = 'Network error. Please check your connection and try again.';
        } else if (msg.includes('timeout')) {
          userMessage = 'Upload timed out. Try with a smaller file or better connection.';
        } else if (msg.includes('size') || msg.includes('large') || msg.includes('entity too large')) {
          userMessage = 'File is too large. Maximum size is 500MB.';
        } else if (msg.includes('chatgpt export') || msg.includes("doesn't look like")) {
          // New validation error - pass through as-is (it's already user-friendly)
          userMessage = err.message;
        } else if (msg.includes('zip') || msg.includes('format') || msg.includes('conversations.json')) {
          userMessage = 'Invalid file format. Please upload the original ZIP from ChatGPT.';
        } else if (msg.includes('logged in') || msg.includes('unauthorized')) {
          userMessage = 'Session expired. Please refresh the page and try again.';
        } else if (msg.includes('no conversations') || msg.includes('empty')) {
          userMessage = 'No conversations found in your export. Make sure you have ChatGPT history before exporting.';
        } else {
          // Pass through server error messages (they're user-friendly now)
          userMessage = err.message;
        }
      }
      setErrorMessage(userMessage);
      setStatus('error');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleCancel = () => {
    setStatus('idle');
    setProgress(0);
    setProgressStage('');
    setCurrentStep('upload');
  };

  const handleRetry = () => {
    setStatus('idle');
    setErrorMessage('');
    setCurrentStep('upload');
  };

  if (checkingExisting) {
    return (
      <main className="h-[100dvh] bg-black flex items-center justify-center overflow-hidden">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </main>
    );
  }

  const steps = [
    { id: 'export', label: 'Export' },
    { id: 'upload', label: 'Upload' },
    { id: 'processing', label: 'Process' },
    { id: 'done', label: 'Done' },
  ];

  const stepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <main className="h-[100dvh] bg-black flex flex-col overflow-hidden relative">
      <BackgroundBeams />

      {/* Header - Compact */}
      <header className="relative z-10 flex items-center justify-between px-4 py-2 border-b border-white/5 flex-shrink-0 pt-[env(safe-area-inset-top)]">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="SoulPrint" className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="text-white font-semibold text-xs sm:text-sm">SoulPrint</span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Reset Button - Only show if user has data (returning user or has error) */}
          {(isReturningUser || errorMessage || status === 'error') && (
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-[10px] sm:text-xs disabled:opacity-50 transition-colors"
              title="Reset and start fresh"
            >
              {isResetting ? (
                <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" />
              ) : (
                <Settings className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              )}
              <span>{isResetting ? 'Resetting...' : 'Reset'}</span>
            </button>
          )}
          
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[10px] sm:text-xs">
            <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            <span>Private</span>
          </div>
        </div>
      </header>

      {/* Error Banner - Shows when there's an error */}
      {errorMessage && (
        <div className="relative z-10 mx-4 mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex-shrink-0">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 text-sm font-medium">Something went wrong</p>
              <p className="text-white/70 text-xs mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage('')}
              className="text-white/50 hover:text-white/80 text-xs"
            >
              ✕
            </button>
          </div>
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="mt-2 w-full py-1.5 rounded bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 disabled:opacity-50"
          >
            {isResetting ? 'Resetting...' : '🔄 Reset & Try Again'}
          </button>
        </div>
      )}

      {/* Step Indicator - Horizontal dots */}
      <div className="relative z-10 flex items-center justify-center gap-2 py-2 sm:py-3 flex-shrink-0">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${i < stepIndex ? 'bg-orange-500' :
                i === stepIndex ? 'bg-orange-500' : 'bg-white/20'
                }`}
            />
            {i < steps.length - 1 && (
              <div className={`w-6 h-0.5 transition-colors ${i < stepIndex ? 'bg-orange-500' : 'bg-white/10'
                }`} />
            )}
          </div>
        ))}
      </div>

      {/* Main Content - Fills remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 relative z-10 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          {/* EXPORT STEP */}
          {currentStep === 'export' && (
            <motion.div
              key="export"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-sm flex flex-col justify-center"
            >
              {isReturningUser && (
                <div className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <p className="text-orange-400 text-sm text-center font-medium">Welcome back! 👋</p>
                  <p className="text-white/70 text-xs text-center mt-1">We&apos;ve upgraded our memory system. Please re-import your data for the best experience.</p>
                </div>
              )}
              <h1 className="text-lg sm:text-xl font-bold text-white mb-0.5 text-center">Export Your ChatGPT Data</h1>
              <p className="text-white/50 text-xs md:text-sm mb-3 text-center">We&apos;ll guide you through it step by step</p>

              <div className="space-y-2 sm:space-y-2.5 mb-3">
                <div className="flex gap-2.5 p-2.5 sm:p-3 rounded-lg bg-white/[0.03] border border-white/10">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-tight">1. Open ChatGPT Settings</p>
                    <p className="text-white/50 text-xs leading-snug mt-0.5">
                      Go to <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">chat.openai.com</a> → Click your profile picture → Select <span className="text-white/70">Settings</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5 p-2.5 sm:p-3 rounded-lg bg-white/[0.03] border border-white/10">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <FileArchive className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-tight">2. Request your data export</p>
                    <p className="text-white/50 text-xs leading-snug mt-0.5">
                      Click <span className="text-white/70">Data controls</span> → <span className="text-white/70">Export data</span> → <span className="text-white/70">Confirm export</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5 p-2.5 sm:p-3 rounded-lg bg-white/[0.03] border border-white/10">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-tight">3. Check your email</p>
                    <p className="text-white/50 text-xs leading-snug mt-0.5">
                      OpenAI will email you a download link (usually within minutes)
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5 p-2.5 sm:p-3 rounded-lg bg-white/[0.03] border border-white/10">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-tight">4. Download the ZIP file</p>
                    <p className="text-white/50 text-xs leading-snug mt-0.5">
                      Click the link in your email — you&apos;ll get a <span className="text-white/70">.zip</span> file to upload here
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setCurrentStep('upload')}
                className="w-full bg-orange-500 hover:bg-orange-400 text-black font-semibold h-10"
              >
                I have my ZIP file <ChevronRight className="w-4 h-4 ml-1" />
              </Button>

              <a
                href="https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 mt-2 text-xs text-white/40 hover:text-white/60"
              >
                Detailed guide <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>
          )}

          {/* UPLOAD STEP */}
          {currentStep === 'upload' && status !== 'error' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-sm flex flex-col justify-center"
            >
              <h1 className="text-lg sm:text-xl font-bold text-white mb-0.5 sm:mb-1 text-center">Upload Your Export</h1>
              <p className="text-white/50 text-xs sm:text-sm mb-3 sm:mb-4 text-center">Drop the ZIP file you downloaded</p>

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  cursor-pointer border-2 border-dashed rounded-xl sm:rounded-2xl p-5 sm:p-8 text-center transition-all
                  ${dragActive
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-white/15 bg-white/[0.02] hover:border-orange-500/40'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                />
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 transition-colors ${dragActive ? 'bg-orange-500/20' : 'bg-white/5'}`}>
                  <Upload className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${dragActive ? 'text-orange-400' : 'text-white/40'}`} />
                </div>
                <p className="text-white font-medium text-sm sm:text-base mb-0.5 sm:mb-1">
                  {dragActive ? 'Drop it here!' : 'Drop ZIP file here'}
                </p>
                <p className="text-white/40 text-xs">or tap to browse</p>
              </div>

              <div className="flex items-center gap-2 mt-3 sm:mt-4 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-green-500/5 border border-green-500/20">
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
                <p className="text-white/50 text-[11px] sm:text-xs">
                  100% private — processed in your browser only
                </p>
              </div>

              <button
                onClick={() => setCurrentStep('export')}
                className="mt-3 sm:mt-4 text-white/40 text-xs hover:text-white/60"
              >
                ← Back to instructions
              </button>
            </motion.div>
          )}

          {/* ERROR STATE */}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm flex flex-col justify-center text-center"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <AlertCircle className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-1 sm:mb-2">Something went wrong</h2>
              <p className="text-white/50 text-xs sm:text-sm mb-4 sm:mb-6">{errorMessage}</p>
              <Button
                onClick={handleRetry}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 h-9 sm:h-10"
              >
                Try Again
              </Button>
            </motion.div>
          )}

          {/* PROCESSING STEP */}
          {currentStep === 'processing' && status !== 'error' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm flex flex-col justify-center text-center"
            >
              <div className="mb-3 sm:mb-4">
                <RingProgress
                  progress={progress}
                  size={80}
                  strokeWidth={5}
                />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-1 sm:mb-2">Creating your SoulPrint</h2>
              <p className="text-white/50 text-xs sm:text-sm">{progressStage || 'Analyzing your conversations...'}</p>

              {progress < 60 && (
                <p className="text-orange-400/80 text-xs mt-2">
                  ⚠️ Don&apos;t close this page until upload completes
                </p>
              )}

              <div className="mt-4 sm:mt-6 w-full h-1 sm:h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <button
                onClick={handleCancel}
                className="mt-6 text-white/40 text-sm hover:text-white/60 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          )}

          {/* DONE STEP */}
          {currentStep === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm flex flex-col justify-center text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3 sm:mb-4"
              >
                <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-green-500" />
              </motion.div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Upload Complete!</h2>
              <p className="text-white/50 text-xs sm:text-sm mb-4">We&apos;re generating your personalized SoulPrint. This takes a few minutes.</p>
              <div className="flex items-center justify-center gap-2 text-orange-400 mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Mail className="w-5 h-5" />
                <span className="font-medium text-sm">We&apos;ll email you when it&apos;s ready!</span>
              </div>
              <p className="text-white/40 text-xs">
                You can close this page. We&apos;ll send you a notification when your SoulPrint is complete.
              </p>
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
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-white/50">Loading...</div>
      </main>
    }>
      <ImportPageContent />
    </Suspense>
  );
}
