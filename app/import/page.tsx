'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, Shield, CheckCircle2, AlertCircle, Loader2, Lock, ExternalLink, Settings, Mail, Download, FileArchive, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { RingProgress } from '@/components/ui/ring-progress';
import { generateClientSoulprint, type ClientSoulprint } from '@/lib/import/client-soulprint';

type ImportStatus = 'idle' | 'processing' | 'saving' | 'success' | 'error';
type Step = 'export' | 'upload' | 'processing' | 'done';

export default function ImportPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>('export');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await fetch('/api/memory/status');
        const data = await res.json();
        // Check if user already has a soulprint (locked or complete)
        if (data.status === 'ready' || data.hasSoulprint || data.locked) {
          router.push('/chat');
          return;
        }
        // Also redirect if import is still processing (let them see progress in chat)
        if (data.status === 'processing') {
          router.push('/chat');
          return;
        }
      } catch {}
      setCheckingExisting(false);
    };
    checkExisting();
  }, [router]);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setErrorMessage('Please upload a ZIP file');
      setStatus('error');
      return;
    }

    setStatus('processing');
    setCurrentStep('processing');
    setProgress(0);

    try {
      const { soulprint: result, conversationChunks } = await generateClientSoulprint(file, (stage, percent) => {
        setProgressStage(stage);
        setProgress(percent);
      });

      setStatus('saving');
      setProgressStage('Saving your profile...');
      setProgress(85);

      // Step 1: Save soulprint metadata first (small payload)
      const response = await fetch('/api/import/save-soulprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soulprint: result }), // No chunks - sent separately
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.code === 'ALREADY_HAS_SOULPRINT' || data.code === 'ALREADY_IMPORTED') {
          router.push('/chat');
          return;
        }
        throw new Error(data.error || 'Failed to save');
      }

      // Step 2: Send chunks in batches to avoid body size limits
      const BATCH_SIZE = 50;
      const totalBatches = Math.ceil(conversationChunks.length / BATCH_SIZE);
      
      for (let i = 0; i < conversationChunks.length; i += BATCH_SIZE) {
        const batch = conversationChunks.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE);
        
        setProgressStage(`Uploading memories (${batchIndex + 1}/${totalBatches})...`);
        setProgress(85 + Math.round((batchIndex / totalBatches) * 10));

        const chunkResponse = await fetch('/api/import/save-chunks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chunks: batch, 
            batchIndex, 
            totalBatches,
          }),
        });

        if (!chunkResponse.ok) {
          const data = await chunkResponse.json();
          throw new Error(data.error || 'Failed to save memories');
        }
      }

      setProgressStage('Starting embedding process...');
      setProgress(95);

      // Trigger background embedding process
      await fetch('/api/embeddings/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }),
      });

      setProgress(100);
      setStatus('success');
      setCurrentStep('done');
    } catch (err) {
      console.error('Import error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Processing failed');
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
        
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[10px] sm:text-xs">
          <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          <span>Private</span>
        </div>
      </header>

      {/* Step Indicator - Horizontal dots */}
      <div className="relative z-10 flex items-center justify-center gap-2 py-2 sm:py-3 flex-shrink-0">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <div 
              className={`w-2 h-2 rounded-full transition-colors ${
                i < stepIndex ? 'bg-orange-500' : 
                i === stepIndex ? 'bg-orange-500' : 'bg-white/20'
              }`}
            />
            {i < steps.length - 1 && (
              <div className={`w-6 h-0.5 transition-colors ${
                i < stepIndex ? 'bg-orange-500' : 'bg-white/10'
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
              
              <div className="mt-4 sm:mt-6 w-full h-1 sm:h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
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
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">You&apos;re all set!</h2>
              <p className="text-white/50 text-xs sm:text-sm mb-4 sm:mb-6">Your AI now understands you</p>
              <Button 
                onClick={() => router.push('/chat')}
                className="w-full bg-orange-500 hover:bg-orange-400 text-black font-semibold h-10 sm:h-11"
              >
                Start Chatting <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
