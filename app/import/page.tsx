'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, Shield, CheckCircle2, AlertCircle, Loader2, Lock, ExternalLink, Settings, Mail, Download, FileArchive } from 'lucide-react';
import { Stepper, Step, useStepper } from '@/components/ui/stepper';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '@/components/ui/spotlight';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { RingProgress } from '@/components/ui/ring-progress';
import { generateClientSoulprint, type ClientSoulprint } from '@/lib/import/client-soulprint';

type ImportStatus = 'idle' | 'processing' | 'saving' | 'success' | 'error';

// Step content components
function ExportStep() {
  const { nextStep } = useStepper();
  
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 md:p-6">
        <h3 className="text-white font-semibold text-lg mb-4">How to export your ChatGPT data</h3>
        
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Settings className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-white font-medium">1. Open ChatGPT Settings</p>
              <p className="text-white/50 text-sm mt-1">
                Go to <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">chat.openai.com</a> → Click your profile picture → Select <span className="text-white/70 font-medium">Settings</span>
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
              <FileArchive className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-white font-medium">2. Request your data export</p>
              <p className="text-white/50 text-sm mt-1">
                Click <span className="text-white/70 font-medium">Data controls</span> → Click <span className="text-white/70 font-medium">Export data</span> → Click <span className="text-white/70 font-medium">Confirm export</span>
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Mail className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-white font-medium">3. Check your email</p>
              <p className="text-white/50 text-sm mt-1">
                OpenAI will send you an email (usually within a few minutes) with a download link for your data.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Download className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-white font-medium">4. Download the ZIP file</p>
              <p className="text-white/50 text-sm mt-1">
                Click the download link in the email. You'll get a <span className="text-white/70 font-medium">.zip</span> file — that's what you'll upload here.
              </p>
            </div>
          </div>
        </div>

        <a 
          href="https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 text-sm text-orange-400 hover:text-orange-300 transition-colors"
        >
          View OpenAI's official guide <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex justify-end">
        <Button onClick={nextStep} className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
          I have my ZIP file →
        </Button>
      </div>
    </div>
  );
}

function UploadStep({ onFileSelect }: { onFileSelect: (file: File) => void }) {
  const { prevStep } = useStepper();
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  return (
    <div className="mt-4 space-y-4">
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
          className="p-8 md:p-12 text-center"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
            className="hidden"
          />
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${dragActive ? 'bg-orange-500/20' : 'bg-white/5'}`}>
            <Upload className={`w-8 h-8 transition-colors ${dragActive ? 'text-orange-400' : 'text-white/40'}`} />
          </div>
          <p className="text-white font-semibold text-xl mb-2">
            {dragActive ? 'Drop it here!' : 'Drop your ZIP file here'}
          </p>
          <p className="text-white/40 text-sm">or click anywhere to browse your files</p>
        </div>
      </SpotlightCard>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
        <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-green-400 font-medium text-sm">Your privacy is protected</p>
          <p className="text-white/50 text-xs mt-1">
            All processing happens right here in your browser. Your data never leaves your device and is never uploaded to any server.
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={prevStep} className="text-white/60 hover:text-white">
          ← Back
        </Button>
      </div>
    </div>
  );
}

function ProcessingStep({ progress, stage }: { progress: number; stage: string }) {
  return (
    <div className="mt-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <div className="mb-6">
          <RingProgress 
            progress={progress} 
            size={120} 
            strokeWidth={8}
          />
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">Creating your SoulPrint</h3>
        <p className="text-white/50 text-sm">{stage || 'Analyzing your conversations...'}</p>
        
        <div className="mt-6 w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

function SuccessStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="mt-4">
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </motion.div>
        <h3 className="text-white font-semibold text-xl mb-2">You're all set!</h3>
        <p className="text-white/50 text-sm mb-6">Your AI now understands your style, interests, and preferences.</p>
        <Button 
          onClick={onContinue}
          className="bg-orange-500 hover:bg-orange-400 text-black font-semibold px-8"
        >
          Start Chatting →
        </Button>
      </div>
    </div>
  );
}

function ErrorStep({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-4">
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">Something went wrong</h3>
        <p className="text-white/50 text-sm mb-6">{message}</p>
        <Button 
          onClick={onRetry}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}

export default function ImportPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [activeStep, setActiveStep] = useState(0);

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
    setActiveStep(2);
    setProgress(0);

    try {
      const { soulprint: result, conversationChunks } = await generateClientSoulprint(file, (stage, percent) => {
        setProgressStage(stage);
        setProgress(percent);
      });

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
      setActiveStep(3);
    } catch (err) {
      console.error('Import error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Processing failed');
      setStatus('error');
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setErrorMessage('');
    setActiveStep(1);
  };

  const steps = [
    { label: 'Export', description: 'Get your ChatGPT data' },
    { label: 'Upload', description: 'Drop your ZIP file' },
    { label: 'Process', description: 'We analyze your style' },
    { label: 'Done', description: 'Start chatting!' },
  ];

  return (
    <main className="min-h-screen bg-black flex flex-col relative">
      <BackgroundBeams />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="SoulPrint" className="w-7 h-7" />
          <span className="text-white font-semibold">SoulPrint</span>
        </Link>
        
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs">
          <Lock className="w-3 h-3" />
          <span className="hidden sm:inline">100% Private</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 md:px-6 py-8 relative z-10">
        <div className="w-full max-w-2xl">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Import Your ChatGPT History
            </h1>
            <p className="text-white/50 text-sm md:text-base">
              Follow these simple steps to create your personalized AI
            </p>
          </div>

          {/* Stepper */}
          <Stepper
            initialStep={activeStep}
            steps={steps}
            orientation="horizontal"
            variant="circle-alt"
            size="md"
            styles={{
              'step-button-container': 'data-[active=true]:bg-orange-500 data-[active=true]:border-orange-500 data-[current=true]:border-orange-500',
              'step-label': 'text-white',
              'step-description': 'text-white/40',
            }}
          >
            <Step label="Export" description="Get your data">
              <ExportStep />
            </Step>
            <Step label="Upload" description="Drop ZIP file">
              <UploadStep onFileSelect={handleFile} />
            </Step>
            <Step label="Process" description="Analyzing...">
              {status === 'processing' || status === 'saving' ? (
                <ProcessingStep progress={progress} stage={progressStage} />
              ) : status === 'error' ? (
                <ErrorStep message={errorMessage} onRetry={handleRetry} />
              ) : null}
            </Step>
            <Step label="Done" description="Ready!">
              <SuccessStep onContinue={() => router.push('/chat')} />
            </Step>
          </Stepper>
        </div>
      </div>
    </main>
  );
}
