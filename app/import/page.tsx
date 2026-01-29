'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, Shield, CheckCircle2, AlertCircle, Loader2, Lock, Clock, Database, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SpotlightCard } from '@/components/ui/spotlight';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { RingProgress } from '@/components/ui/ring-progress';
import { generateClientSoulprint, type ClientSoulprint } from '@/lib/import/client-soulprint';

type ImportStatus = 'idle' | 'processing' | 'saving' | 'success' | 'error';

const faqs = [
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
      <main className="h-screen bg-black flex items-center justify-center overflow-hidden">
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
      <main className="h-screen bg-black flex flex-col overflow-hidden relative">
        {/* Background Beams */}
        <BackgroundBeams />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-2 md:py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="SoulPrint" className="w-6 h-6 md:w-7 md:h-7" />
              <span className="text-white font-semibold text-sm md:text-base">SoulPrint</span>
            </Link>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20 transition-all text-xs">
                <Lock className="w-3 h-3" />
                <span>Private</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-zinc-900 border-white/10 text-white/80">
              <p className="text-xs">All processing happens locally in your browser</p>
            </TooltipContent>
          </Tooltip>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 relative z-10 min-h-0 py-2 md:py-4">
          {/* Title */}
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-4 md:mb-6 text-center">
            Import Your ChatGPT History
          </h1>

          {/* How to export steps */}
          <div className="text-center mb-4 md:mb-6">
            <p className="text-white/50 text-xs md:text-sm mb-2">How to export:</p>
            <div className="text-white/40 text-xs md:text-sm space-y-0.5">
              <p>1. Go to ChatGPT → Settings</p>
              <p>2. Click "Export data"</p>
              <p>3. Download the ZIP file</p>
            </div>
          </div>

          {/* Upload Zone / States */}
          <div className="w-full max-w-md">
            <AnimatePresence mode="wait">
              {status === 'idle' && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <SpotlightCard
                    className={`
                      cursor-pointer border-2 border-dashed transition-all duration-200
                      ${dragActive 
                        ? 'border-orange-500 bg-orange-500/10' 
                        : 'border-white/15 bg-white/[0.02] hover:border-orange-500/40'
                      }
                    `}
                  >
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 md:p-10 text-center"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                        className="hidden"
                      />
                      <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4 transition-colors ${dragActive ? 'bg-orange-500/20' : 'bg-white/5'}`}>
                        <Upload className={`w-5 h-5 md:w-7 md:h-7 transition-colors ${dragActive ? 'text-orange-400' : 'text-white/40'}`} />
                      </div>
                      <p className="text-white font-semibold text-base md:text-lg mb-1">
                        {dragActive ? 'Drop to upload' : 'Drop your ZIP file here'}
                      </p>
                      <p className="text-white/40 text-xs md:text-sm">or click to browse</p>
                    </div>
                  </SpotlightCard>
                </motion.div>
              )}

              {(status === 'processing' || status === 'saving') && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6 md:p-10 text-center"
                >
                  <div className="mb-4 md:mb-6">
                    <RingProgress 
                      progress={progress} 
                      size={80} 
                      strokeWidth={5}
                    />
                  </div>
                  <p className="text-white/60 text-xs md:text-sm mb-3 md:mb-4">{progressStage || 'Processing...'}</p>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
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
                  className="rounded-2xl border border-green-500/20 bg-green-500/5 backdrop-blur-sm p-6 md:p-10 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3 md:mb-4"
                  >
                    <CheckCircle2 className="w-5 h-5 md:w-7 md:h-7 text-green-500" />
                  </motion.div>
                  <h3 className="text-white font-semibold text-lg md:text-xl mb-1 md:mb-2">Import Complete</h3>
                  <p className="text-white/50 text-xs md:text-sm mb-4 md:mb-6">Your AI now knows you</p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push('/chat')}
                    className="px-6 md:px-8 py-2 md:py-2.5 bg-orange-500 hover:bg-orange-400 text-black font-semibold rounded-xl transition-colors text-sm md:text-base"
                  >
                    Start Chatting
                  </motion.button>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-6 md:p-10 text-center"
                >
                  <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <AlertCircle className="w-5 h-5 md:w-7 md:h-7 text-red-500" />
                  </div>
                  <h3 className="text-white font-semibold text-base md:text-lg mb-1 md:mb-2">Something went wrong</h3>
                  <p className="text-white/50 text-xs md:text-sm mb-4 md:mb-6">{errorMessage}</p>
                  <button
                    onClick={() => { setStatus('idle'); setErrorMessage(''); }}
                    className="px-5 md:px-6 py-2 md:py-2.5 bg-white/10 hover:bg-white/15 text-white/80 rounded-xl transition-colors font-medium text-sm md:text-base"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* FAQ Tooltips */}
          <div className="w-full max-w-xl mt-4 md:mt-8 px-2 md:px-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              {faqs.map((faq, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <button className="group flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-orange-500/20 transition-all">
                      <faq.icon className="w-4 h-4 md:w-5 md:h-5 text-white/30 group-hover:text-orange-400 transition-colors flex-shrink-0" />
                      <span className="text-sm md:text-base text-white/50 group-hover:text-white/70 transition-colors">
                        {faq.title}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    className="max-w-[280px] bg-zinc-900/95 backdrop-blur border-white/10 text-white/80 p-4"
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
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
