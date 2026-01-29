'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle2, AlertCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { generateClientSoulprint, type ClientSoulprint } from '@/lib/import/client-soulprint';

type ImportStatus = 'idle' | 'processing' | 'saving' | 'success' | 'error';

export default function ImportPageV2() {
  const router = useRouter();
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await fetch('/api/memory/status');
        const data = await res.json();
        if (data.status === 'ready' || data.hasSoulprint) {
          router.push('/chat');
          return;
        }
      } catch {}
      setCheckingExisting(false);
    };
    checkExisting();
  }, [router]);

  if (checkingExisting) {
    return (
      <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
      </main>
    );
  }

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setErrorMessage('Please upload a ZIP file');
      setStatus('error');
      return;
    }

    setStatus('processing');
    setProgress(0);

    try {
      const { soulprint: result, conversationChunks } = await generateClientSoulprint(file, (stage, percent) => {
        setProgressStage(stage);
        setProgress(percent);
      });

      setStatus('saving');
      setProgressStage('Saving...');
      setProgress(90);

      const response = await fetch('/api/import/save-soulprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soulprint: result, conversationChunks }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setProgress(100);
      setStatus('success');
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

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Minimal Header */}
      <header className="px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <img src="/logo.svg" alt="SoulPrint" className="w-6 h-6" />
          <span className="text-white/80 font-medium text-sm">SoulPrint</span>
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-sm text-center"
            >
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center mx-auto mb-6 border border-orange-500/20">
                <Sparkles className="w-7 h-7 text-orange-500" />
              </div>

              {/* Copy */}
              <h1 className="text-2xl font-semibold text-white mb-2">
                Let's get to know you
              </h1>
              <p className="text-white/50 text-sm mb-8 leading-relaxed">
                Upload your ChatGPT export and we'll create your personalized AI in seconds.
              </p>

              {/* Upload Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative cursor-pointer rounded-2xl border-2 border-dashed p-8 transition-all duration-200
                  ${dragActive 
                    ? 'border-orange-500 bg-orange-500/10' 
                    : 'border-white/10 hover:border-orange-500/50 hover:bg-white/[0.02]'
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
                <Upload className={`w-6 h-6 mx-auto mb-3 transition-colors ${dragActive ? 'text-orange-400' : 'text-white/30'}`} />
                <p className="text-white/70 text-sm font-medium mb-1">
                  {dragActive ? 'Drop it here' : 'Drop ZIP file or click to browse'}
                </p>
                <p className="text-white/30 text-xs">ChatGPT data export</p>
              </div>

              {/* Help Link */}
              <p className="mt-6 text-white/30 text-xs">
                Don't have it?{' '}
                <a 
                  href="https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500/70 hover:text-orange-400 transition-colors"
                >
                  Export from ChatGPT →
                </a>
              </p>
            </motion.div>
          )}

          {(status === 'processing' || status === 'saving') && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-sm text-center"
            >
              {/* Animated Loader */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="6"
                  />
                  <motion.circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={264}
                    initial={{ strokeDashoffset: 264 }}
                    animate={{ strokeDashoffset: 264 - (264 * progress / 100) }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#EA580C" />
                      <stop offset="100%" stopColor="#F97316" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-semibold">{Math.round(progress)}%</span>
                </div>
              </div>

              <h2 className="text-xl font-semibold text-white mb-2">
                Creating your SoulPrint
              </h2>
              <p className="text-white/40 text-sm">
                {progressStage || 'Processing...'}
              </p>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </motion.div>

              <h2 className="text-2xl font-semibold text-white mb-2">
                You're all set
              </h2>
              <p className="text-white/50 text-sm mb-8">
                Your AI is ready and waiting
              </p>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/chat')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-black font-semibold rounded-xl transition-colors"
              >
                Start chatting
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-sm text-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>

              <h2 className="text-xl font-semibold text-white mb-2">
                Something went wrong
              </h2>
              <p className="text-white/50 text-sm mb-6">
                {errorMessage}
              </p>

              <button
                onClick={() => { setStatus('idle'); setErrorMessage(''); }}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-colors font-medium"
              >
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-white/20 text-xs">
          Your data stays in your browser. Nothing is uploaded to our servers.
        </p>
      </footer>
    </main>
  );
}
