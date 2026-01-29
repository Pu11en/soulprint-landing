'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileArchive, Sparkles, Shield, Zap, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { generateClientSoulprint, type ClientSoulprint } from '@/lib/import/client-soulprint';

type ImportStatus = 'idle' | 'processing' | 'saving' | 'success' | 'error';

const steps = [
  {
    num: 1,
    title: 'Export from ChatGPT',
    desc: 'Settings → Data controls → Export',
    icon: FileArchive,
  },
  {
    num: 2,
    title: 'Get the email',
    desc: 'Download ZIP from OpenAI email',
    icon: Sparkles,
  },
  {
    num: 3,
    title: 'Upload here',
    desc: 'Drop the ZIP file below',
    icon: Upload,
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
      <main className="min-h-screen bg-black flex items-center justify-center">
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
    <main className="min-h-screen bg-black">
      {/* Animated background gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-orange-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 px-6 py-12 max-w-4xl mx-auto">
        {/* Header */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-16"
        >
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="SoulPrint" className="w-8 h-8" />
            <span className="text-white font-semibold text-lg">SoulPrint</span>
          </Link>
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <Shield className="w-4 h-4" />
            <span>100% Private</span>
          </div>
        </motion.nav>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Import Your <span className="text-orange-500">Memory</span>
          </h1>
          <p className="text-white/60 text-lg max-w-lg mx-auto">
            Your ChatGPT conversations become the foundation of your AI&apos;s memory. Processing happens entirely on your device.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid md:grid-cols-3 gap-4 mb-12"
        >
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="relative bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] hover:border-orange-500/30 transition-all group"
            >
              <div className="absolute top-4 right-4 text-5xl font-bold text-white/5 group-hover:text-orange-500/10 transition-colors">
                {step.num}
              </div>
              <step.icon className="w-8 h-8 text-orange-500 mb-4" />
              <h3 className="text-white font-semibold mb-1">{step.title}</h3>
              <p className="text-white/50 text-sm">{step.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
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
                  relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all
                  ${dragActive 
                    ? 'border-orange-500 bg-orange-500/10 scale-[1.02]' 
                    : 'border-white/20 bg-white/5 hover:border-orange-500/50 hover:bg-white/[0.07]'
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
                  animate={{ y: dragActive ? -5 : 0 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
                    <Upload className={`w-8 h-8 ${dragActive ? 'text-orange-400' : 'text-orange-500'}`} />
                  </div>
                  <p className="text-white font-medium text-lg mb-2">
                    {dragActive ? 'Drop your file here' : 'Drop your ChatGPT export ZIP'}
                  </p>
                  <p className="text-white/40 text-sm">or click to browse</p>
                </motion.div>
              </motion.div>
            )}

            {(status === 'processing' || status === 'saving') && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-6 relative">
                  <Zap className="w-10 h-10 text-orange-500" />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-orange-500 border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
                <p className="text-white font-medium text-lg mb-2">{progressStage || 'Processing...'}</p>
                <div className="w-64 h-2 bg-white/10 rounded-full mx-auto overflow-hidden">
                  <motion.div
                    className="h-full bg-orange-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-white/40 text-sm mt-2">{Math.round(progress)}%</p>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-green-500/30 bg-green-500/10 p-12 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </motion.div>
                <h3 className="text-white font-semibold text-xl mb-2">Import Complete!</h3>
                <p className="text-white/60 mb-6">Your AI now has your memories.</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/chat')}
                  className="px-8 py-3 bg-orange-500 hover:bg-orange-400 text-black font-semibold rounded-xl transition-colors"
                >
                  Start Chatting →
                </motion.button>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 p-12 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Something went wrong</h3>
                <p className="text-white/60 mb-4">{errorMessage}</p>
                <button
                  onClick={() => { setStatus('idle'); setErrorMessage(''); }}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="grid md:grid-cols-3 gap-6 mt-12 pt-12 border-t border-white/10"
        >
          {[
            { icon: Shield, title: 'Private', desc: 'Data never leaves your device' },
            { icon: Zap, title: 'Fast', desc: 'Processes locally in minutes' },
            { icon: Sparkles, title: 'Smart', desc: 'Creates your unique AI profile' },
          ].map((feature, i) => (
            <div key={i} className="flex items-start gap-3">
              <feature.icon className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="text-white font-medium">{feature.title}</p>
                <p className="text-white/40 text-sm">{feature.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
