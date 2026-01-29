'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Shield, CheckCircle2, AlertCircle, Loader2, HelpCircle, Lock, FileArchive, Clock, Database, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { generateClientSoulprint, type ClientSoulprint } from '@/lib/import/client-soulprint';

type ImportStatus = 'idle' | 'processing' | 'saving' | 'success' | 'error';

const faqs = [
  {
    icon: FileArchive,
    title: 'How to export',
    content: (
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-white/40 text-xs w-3">1.</span>
          <p className="text-xs text-white/70">Go to ChatGPT → Settings → Data controls</p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-white/40 text-xs w-3">2.</span>
          <p className="text-xs text-white/70">Click "Export data" and confirm</p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-white/40 text-xs w-3">3.</span>
          <p className="text-xs text-white/70">Download the ZIP from OpenAI's email</p>
        </div>
      </div>
    ),
  },
  {
    icon: Shield,
    title: 'Privacy',
    content: (
      <div className="space-y-1.5">
        <p className="text-xs text-white/80 font-medium">100% local processing</p>
        <ul className="text-xs text-white/50 space-y-1">
          <li>• Data never leaves your browser</li>
          <li>• No external server calls</li>
          <li>• You own and control everything</li>
        </ul>
      </div>
    ),
  },
  {
    icon: Database,
    title: "What's included",
    content: (
      <div className="space-y-1.5">
        <p className="text-xs text-white/80">Your ChatGPT export contains:</p>
        <ul className="text-xs text-white/50 space-y-1">
          <li>• All conversation history</li>
          <li>• Topics you've discussed</li>
          <li>• Your communication style</li>
          <li>• Interests and preferences</li>
        </ul>
      </div>
    ),
  },
  {
    icon: Clock,
    title: 'How long',
    content: (
      <div className="space-y-1.5">
        <p className="text-xs text-white/80">Processing time depends on history size:</p>
        <ul className="text-xs text-white/50 space-y-1">
          <li>• Small (~100 chats): ~30 seconds</li>
          <li>• Medium (~500 chats): 1-2 minutes</li>
          <li>• Large (1000+): 3-5 minutes</li>
        </ul>
      </div>
    ),
  },
  {
    icon: Zap,
    title: 'What happens',
    content: (
      <div className="space-y-1.5">
        <p className="text-xs text-white/80">We analyze your conversations to extract:</p>
        <ul className="text-xs text-white/50 space-y-1">
          <li>• Key facts about you</li>
          <li>• Writing patterns & style</li>
          <li>• Topics you care about</li>
          <li>• Your unique AI profile</li>
        </ul>
      </div>
    ),
  },
];

export default function ImportPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [soulprint, setSoulprint] = useState<ClientSoulprint | null>(null);
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
      <main className="h-screen max-h-screen bg-black flex items-center justify-center overflow-hidden">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
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

      setSoulprint(result);
      setStatus('saving');
      setProgressStage('Saving your memories...');
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
    <TooltipProvider delayDuration={150}>
      <main className="h-screen max-h-screen bg-black flex flex-col overflow-hidden">
        {/* Subtle background glow */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-orange-500/8 rounded-full blur-[100px]" />
        </div>

        {/* Header - compact with inline title */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-white/5"
        >
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="SoulPrint" className="w-6 h-6" />
              <span className="text-white/80 font-medium text-sm">SoulPrint</span>
            </Link>
            <span className="text-white/20">|</span>
            <h1 className="text-white/60 text-sm">Import Your ChatGPT History</h1>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1.5 text-white/30 hover:text-white/50 transition-colors text-xs">
                <Lock className="w-3 h-3" />
                <span>Private</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-zinc-900 border-white/10 text-white/80">
              <p className="text-xs">All processing happens locally in your browser</p>
            </TooltipContent>
          </Tooltip>
        </motion.header>

        {/* Main content - centered with flex-1 */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 relative z-10 min-h-0">
          {/* Upload Zone / Progress / Success / Error */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="w-full max-w-lg"
          >
            <AnimatePresence mode="wait">
              {status === 'idle' && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200
                    ${dragActive 
                      ? 'border-orange-500 bg-orange-500/10 scale-[1.01]' 
                      : 'border-white/15 bg-white/[0.02] hover:border-orange-500/40 hover:bg-white/[0.04]'
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
                  <motion.div
                    animate={{ y: dragActive ? -2 : 0 }}
                    className="flex flex-col items-center"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${dragActive ? 'bg-orange-500/20' : 'bg-white/5'}`}>
                      <Upload className={`w-6 h-6 transition-colors ${dragActive ? 'text-orange-400' : 'text-white/40'}`} />
                    </div>
                    <p className="text-white font-medium mb-1">
                      {dragActive ? 'Drop to upload' : 'Drop your ZIP file here'}
                    </p>
                    <p className="text-white/30 text-sm">or click to browse</p>
                  </motion.div>
                </motion.div>
              )}

              {(status === 'processing' || status === 'saving') && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-orange-500/15 flex items-center justify-center mx-auto mb-4 relative">
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-orange-500/30 border-t-orange-500"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <span className="text-sm font-semibold text-orange-500">{Math.round(progress)}%</span>
                  </div>
                  <p className="text-white/60 text-sm mb-3">{progressStage || 'Processing...'}</p>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </motion.div>
              )}

              {status === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl border border-green-500/20 bg-green-500/5 p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3"
                  >
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  </motion.div>
                  <h3 className="text-white font-medium text-lg mb-1">Import Complete</h3>
                  <p className="text-white/50 text-sm mb-4">Your AI now knows you</p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push('/chat')}
                    className="px-6 py-2 bg-orange-500 hover:bg-orange-400 text-black font-medium rounded-xl transition-colors text-sm"
                  >
                    Start Chatting
                  </motion.button>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="text-white font-medium mb-1">Something went wrong</h3>
                  <p className="text-white/50 text-sm mb-4">{errorMessage}</p>
                  <button
                    onClick={() => { setStatus('idle'); setErrorMessage(''); }}
                    className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white/80 rounded-xl transition-colors text-sm"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* FAQ Cards - compact grid with hover popovers */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="w-full max-w-xl mt-6"
          >
            <div className="grid grid-cols-5 gap-2">
              {faqs.map((faq, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <motion.button
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.03 }}
                      className="group flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-orange-500/20 transition-all"
                    >
                      <faq.icon className="w-4 h-4 text-white/30 group-hover:text-orange-400 transition-colors" />
                      <span className="text-[10px] text-white/40 group-hover:text-white/60 transition-colors text-center leading-tight">
                        {faq.title}
                      </span>
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    className="max-w-[260px] bg-zinc-900/95 backdrop-blur border-white/10 text-white/80 p-3"
                    sideOffset={8}
                  >
                    <p className="text-white/90 font-medium text-xs mb-2">
                      {faq.title}
                    </p>
                    {faq.content}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </motion.div>
        </div>
      </main>
    </TooltipProvider>
  );
}
