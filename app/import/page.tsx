'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Upload, Shield, CheckCircle2, AlertCircle, Loader2, Lock, 
  FileArchive, ArrowRight, ArrowLeft, Download, ExternalLink, Check 
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SpotlightCard } from '@/components/ui/spotlight';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { RingProgress } from '@/components/ui/ring-progress';
import { generateClientSoulprint, type ClientSoulprint } from '@/lib/import/client-soulprint';

type Step = 1 | 2 | 3 | 4;
type ImportStatus = 'idle' | 'processing' | 'saving' | 'success' | 'error';

const steps = [
  { number: 1, title: 'Export', subtitle: 'Get your data' },
  { number: 2, title: 'Upload', subtitle: 'Drop your ZIP' },
  { number: 3, title: 'Process', subtitle: 'Analyzing...' },
  { number: 4, title: 'Done', subtitle: 'Ready to chat' },
];

export default function ImportWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
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

    setCurrentStep(3);
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
      setCurrentStep(4);
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

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-12">
      {steps.map((step, index) => {
        const isActive = currentStep === step.number;
        const isComplete = currentStep > step.number;
        
        return (
          <div key={step.number} className="flex items-center">
            {/* Step circle */}
            <motion.div
              initial={false}
              animate={{
                scale: isActive ? 1.1 : 1,
                backgroundColor: isComplete ? '#f97316' : isActive ? '#f97316' : 'rgba(255,255,255,0.1)',
              }}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                transition-colors duration-300
                ${isComplete || isActive ? 'text-black' : 'text-white/40'}
              `}
            >
              {isComplete ? <Check className="w-5 h-5" /> : step.number}
            </motion.div>
            
            {/* Step text */}
            <div className="ml-3 hidden sm:block">
              <p className={`text-sm font-medium ${isActive || isComplete ? 'text-white' : 'text-white/40'}`}>
                {step.title}
              </p>
              <p className="text-xs text-white/30">{step.subtitle}</p>
            </div>
            
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className={`w-8 sm:w-16 h-0.5 mx-4 ${isComplete ? 'bg-orange-500' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const Step1Export = () => (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-xl mx-auto"
    >
      <SpotlightCard className="p-8 border border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <Download className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Export Your ChatGPT Data</h2>
            <p className="text-sm text-white/50">Follow these steps to download your history</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {[
            { step: 1, text: 'Open ChatGPT and go to Settings', link: 'https://chat.openai.com/' },
            { step: 2, text: 'Navigate to Data Controls' },
            { step: 3, text: 'Click "Export Data" and confirm your request' },
            { step: 4, text: 'Check your email for the download link (usually within 24h)' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4 group">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-orange-400 font-mono text-sm shrink-0">
                {item.step}
              </div>
              <div className="flex-1 pt-1">
                <p className="text-white/80 text-sm">{item.text}</p>
                {item.link && (
                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 mt-1"
                  >
                    Open ChatGPT <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-white/80 font-medium">Your privacy is protected</p>
              <p className="text-xs text-white/50 mt-1">
                All data processing happens locally in your browser. Nothing is sent to any server.
              </p>
            </div>
          </div>
        </div>
      </SpotlightCard>

      <div className="flex justify-end mt-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrentStep(2)}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-black font-semibold rounded-xl transition-colors"
        >
          I have my export <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );

  const Step2Upload = () => (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-xl mx-auto"
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
          className="p-12 text-center"
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
            className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-colors ${dragActive ? 'bg-orange-500/20' : 'bg-white/5'}`}
          >
            <FileArchive className={`w-10 h-10 transition-colors ${dragActive ? 'text-orange-400' : 'text-white/40'}`} />
          </motion.div>
          <p className="text-white font-semibold text-xl mb-2">
            {dragActive ? 'Release to upload' : 'Drop your export here'}
          </p>
          <p className="text-white/40 text-sm mb-6">or click to browse for your ZIP file</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white/50 text-xs">
            <Lock className="w-3 h-3" />
            100% processed in your browser
          </div>
        </div>
      </SpotlightCard>

      <div className="flex justify-between mt-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrentStep(1)}
          className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white/70 font-medium rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </motion.button>
      </div>
    </motion.div>
  );

  const Step3Processing = () => (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-md mx-auto"
    >
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-10 text-center">
        <div className="mb-8">
          <RingProgress 
            progress={progress} 
            size={140} 
            strokeWidth={8}
          />
        </div>
        
        <h2 className="text-xl font-semibold text-white mb-2">Analyzing Your History</h2>
        <p className="text-white/50 text-sm mb-6">{progressStage || 'Starting...'}</p>
        
        <div className="space-y-3">
          {['Extracting conversations', 'Finding patterns', 'Building your profile'].map((item, i) => {
            const isComplete = progress > (i + 1) * 30;
            const isActive = progress > i * 30 && progress <= (i + 1) * 30;
            
            return (
              <div key={i} className="flex items-center gap-3 justify-center">
                {isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-white/20" />
                )}
                <span className={`text-sm ${isComplete ? 'text-white/70' : isActive ? 'text-orange-400' : 'text-white/30'}`}>
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );

  const Step4Done = () => (
    <motion.div
      key="step4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto"
    >
      <div className="rounded-2xl border border-green-500/20 bg-green-500/5 backdrop-blur-sm p-10 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </motion.div>
        
        <h2 className="text-2xl font-bold text-white mb-3">You're All Set!</h2>
        <p className="text-white/50 mb-8">
          Your AI now understands your preferences, interests, and communication style.
        </p>

        {soulprint && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-2xl font-bold text-orange-400">{soulprint.facts?.length || 0}</p>
              <p className="text-xs text-white/40">Facts learned</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-2xl font-bold text-orange-400">{soulprint.interests?.length || 0}</p>
              <p className="text-xs text-white/40">Interests found</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-2xl font-bold text-orange-400">{soulprint.writingStyle ? '✓' : '-'}</p>
              <p className="text-xs text-white/40">Style mapped</p>
            </div>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push('/chat')}
          className="w-full px-8 py-3 bg-orange-500 hover:bg-orange-400 text-black font-semibold rounded-xl transition-colors"
        >
          Start Chatting
        </motion.button>
      </div>
    </motion.div>
  );

  const StepError = () => (
    <motion.div
      key="error"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto"
    >
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-white font-semibold text-xl mb-2">Something went wrong</h3>
        <p className="text-white/50 text-sm mb-6">{errorMessage}</p>
        <button
          onClick={() => { 
            setStatus('idle'); 
            setErrorMessage(''); 
            setCurrentStep(2);
          }}
          className="px-6 py-3 bg-white/10 hover:bg-white/15 text-white/80 rounded-xl transition-colors font-medium"
        >
          Try Again
        </button>
      </div>
    </motion.div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <main className="h-screen bg-black flex flex-col overflow-hidden relative">
        <BackgroundBeams />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="SoulPrint" className="w-7 h-7" />
            <span className="text-white font-semibold">SoulPrint</span>
          </Link>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20 transition-all text-xs">
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
        <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 min-h-0 overflow-y-auto py-8">
          <StepIndicator />

          <AnimatePresence mode="wait">
            {status === 'error' ? (
              <StepError />
            ) : currentStep === 1 ? (
              <Step1Export />
            ) : currentStep === 2 ? (
              <Step2Upload />
            ) : currentStep === 3 ? (
              <Step3Processing />
            ) : (
              <Step4Done />
            )}
          </AnimatePresence>
        </div>
      </main>
    </TooltipProvider>
  );
}
