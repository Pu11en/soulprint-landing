'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateClientSoulprint, type ClientSoulprint, type ConversationChunk } from '@/lib/import/client-soulprint';

interface Step {
  step: string;
  title: string;
  description: string;
  substeps?: string[];
  icon: React.ReactNode;
  tip?: string;
}

const steps: Step[] = [
  {
    step: '01',
    title: 'Request your export from ChatGPT',
    description: 'Go to ChatGPT and request your data:',
    substeps: [
      'Go to chatgpt.com (or open the ChatGPT app)',
      'Click your profile picture → Settings',
      'Click "Data controls"',
      'Click "Export data" → "Confirm export"',
      '⏳ Wait for email from OpenAI (5-30 min)',
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    tip: 'Important: The email comes from OpenAI, not SoulPrint. Check spam if you don\'t see it!',
  },
  {
    step: '02',
    title: 'Download from OpenAI\'s email',
    description: 'Check your inbox for an email from OpenAI:',
    substeps: [
      'Look for email from "noreply@tm.openai.com"',
      'Subject: "Your ChatGPT data export is ready"',
      'Click "Download data export" in the email',
      'Click "Download" on the ChatGPT page',
      'Save the ZIP file to your device',
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
    tip: 'Can\'t find the email? Check spam/junk. Still nothing after 30 min? Try requesting again.',
  },
  {
    step: '03',
    title: 'Upload the ZIP here',
    description: 'Bring your downloaded ZIP back here:',
    substeps: [
      'Find the ZIP file you just downloaded',
      'Drag it onto the upload area below',
      '(or tap below to browse your files)',
      'We\'ll analyze it right in your browser',
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    tip: '🔒 Your data never leaves your device. Processing happens 100% locally.',
  },
];

const faqs = [
  {
    q: "I haven't received an email yet",
    a: "The export email comes from OpenAI (noreply@tm.openai.com), not from us. It usually takes 5-30 minutes. Check your spam folder! If it's been over an hour, try requesting the export again from ChatGPT.",
  },
  {
    q: "Where do I request the export?",
    a: "Go to chatgpt.com → click your profile picture (bottom left) → Settings → Data controls → Export data. You'll need to confirm, then wait for OpenAI's email.",
  },
  {
    q: "The download link expired",
    a: "OpenAI's download links expire after 24 hours. Just go back to ChatGPT and request a new export — it only takes a minute.",
  },
  {
    q: "Is my data safe?",
    a: "Yes! Your ZIP file is processed entirely in your browser — nothing is uploaded to our servers. We only save the analyzed results (your interests, communication style, etc.), not your actual conversations.",
  },
  {
    q: "How long does processing take?",
    a: "Usually 1-3 minutes, depending on how many conversations you have. Large exports (1GB+) may take a bit longer. Keep this tab open!",
  },
  {
    q: "Can I use this on mobile?",
    a: "Yes! Works on iPhone/Android. Just make sure to download the ZIP file fully before uploading it here. If you're on iOS, you might need to use Safari and \"Download\" to Files first.",
  },
];

type ImportStatus = 'idle' | 'processing' | 'saving' | 'success' | 'error';

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

  // Check if user already has a soulprint
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await fetch('/api/memory/status');
        const data = await res.json();
        if (data.status === 'ready' || data.hasSoulprint) {
          // User already has a soulprint, redirect to chat
          router.push('/chat');
          return;
        }
      } catch {
        // Continue showing import page on error
      }
      setCheckingExisting(false);
    };
    checkExisting();
  }, [router]);

  // Show loading while checking
  if (checkingExisting) {
    return (
      <main className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
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
      // Process entirely client-side
      const { soulprint: result, conversationChunks } = await generateClientSoulprint(file, (stage, percent) => {
        setProgressStage(stage);
        setProgress(percent);
      });

      setSoulprint(result);
      setStatus('saving');
      setProgressStage('Saving to cloud...');
      setProgress(90);

      // Save soulprint + conversation chunks to server
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090B] px-5 sm:px-8 py-12 sm:py-16">
      <div className="glow-ambient top-[-100px] left-1/2 -translate-x-1/2" />

      <nav className="max-w-5xl mx-auto mb-12 sm:mb-16 flex items-center justify-between">
        <Link href="/" className="logo">
          <img src="/logo.svg" alt="SoulPrint" className="logo-icon" />
          <span className="text-white">SoulPrint</span>
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 sm:mb-16 animate-in">
          <p className="text-micro text-orange-500 mb-4">Import your data</p>
          <h1 className="text-headline text-white mb-5">
            Connect your <span className="text-gradient">memory</span>
          </h1>
          <p className="text-body max-w-xl mx-auto leading-relaxed">
            Your data stays on your device. We analyze it locally and only save the results.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 sm:gap-6 mb-10">
          {steps.map((step, i) => (
            <div key={i} className="card card-hover p-6 sm:p-7 animate-in relative group" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
              <span className="absolute top-6 right-6 text-4xl font-bold text-white/[0.04]">{step.step}</span>
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4 group-hover:bg-orange-500/15 transition-colors">
                {step.icon}
              </div>
              <h3 className="text-title text-white mb-2">{step.title}</h3>
              <p className="text-body text-sm mb-3">{step.description}</p>
              {step.substeps && (
                <ol className="space-y-1.5 mb-3">
                  {step.substeps.map((substep, j) => (
                    <li key={j} className="text-xs text-white/60 flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-white/10 text-white/40 flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5">{j + 1}</span>
                      {substep}
                    </li>
                  ))}
                </ol>
              )}
              {step.tip && (
                <p className="text-xs text-orange-500/70 mt-3 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  {step.tip}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="max-w-lg mx-auto animate-in" style={{ animationDelay: '0.4s' }}>
          {status === 'idle' && (
            <div
              className={`card-elevated p-8 text-center relative overflow-hidden cursor-pointer transition-all ${
                dragActive ? 'ring-2 ring-orange-500 bg-orange-500/5' : ''
              }`}
              onDrop={handleDrop}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-orange-500/15 blur-[80px] -z-10" />
              
              <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileSelect} className="hidden" />
              
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              
              <h2 className="text-title text-white mb-2">Tap to upload your ZIP</h2>
              <p className="text-caption mb-4">Processed locally — your data never leaves your device</p>
              <p className="text-xs text-gray-600">Supports any size export</p>

              <div className="mt-6">
                
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="card-elevated p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-orange-500/15 blur-[80px] -z-10" />
              
              <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="animate-spin h-8 w-8 text-orange-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              
              <h2 className="text-title text-white mb-2">Analyzing your conversations...</h2>
              <p className="text-caption mb-4">{progressStage}</p>
              
              <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                <div className="bg-gradient-to-r from-orange-500 to-orange-400 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-600">{Math.round(progress)}%</p>
            </div>
          )}

          {status === 'saving' && (
            <div className="card-elevated p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-orange-500/15 blur-[80px] -z-10" />
              
              <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="animate-spin h-8 w-8 text-orange-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              
              <h2 className="text-title text-white mb-2">Saving your SoulPrint...</h2>
              <p className="text-caption mb-4">Almost there</p>
            </div>
          )}

          {status === 'success' && soulprint && (
            <div className="card-elevated p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-orange-500/15 blur-[80px] -z-10" />
              
              <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-6 relative">
                <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h2 className="text-title text-white mb-2">Your SoulPrint is ready!</h2>
              <p className="text-caption mb-4">AI personalized to match your style</p>

              <div className="bg-gray-900/50 rounded-xl p-4 mb-6 text-left">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Conversations</p>
                    <p className="text-white font-medium">{soulprint.stats.totalConversations.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Messages</p>
                    <p className="text-white font-medium">{soulprint.stats.totalMessages.toLocaleString()}</p>
                  </div>
                </div>
                {soulprint.interests.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-gray-500 text-xs mb-2">Detected interests</p>
                    <div className="flex flex-wrap gap-1.5">
                      {soulprint.interests.slice(0, 5).map((interest, i) => (
                        <span key={i} className="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-xs rounded-full">{interest}</span>
                      ))}
                    </div>
                  </div>
                )}
                {soulprint.aiPersona.traits.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-gray-500 text-xs mb-2">AI personality</p>
                    <div className="flex flex-wrap gap-1.5">
                      {soulprint.aiPersona.traits.slice(0, 4).map((trait, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-full">{trait}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link href="/chat" className="btn btn-primary btn-lg">Start Chatting →</Link>
            </div>
          )}

          {status === 'error' && (
            <div className="card-elevated p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-red-500/15 blur-[80px] -z-10" />
              
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              
              <h2 className="text-title text-white mb-2">Something went wrong</h2>
              <p className="text-caption mb-6">{errorMessage}</p>

              <button onClick={() => { setStatus('idle'); setErrorMessage(''); }} className="btn btn-secondary btn-lg">Try again</button>
            </div>
          )}
        </div>

        {/* FAQ Section */}
        <div className="max-w-2xl mx-auto mt-16 animate-in" style={{ animationDelay: '0.5s' }}>
          <h2 className="text-lg font-semibold text-white mb-6 text-center">Common Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details key={i} className="group card p-4 cursor-pointer">
                <summary className="flex items-center justify-between text-white font-medium list-none">
                  {faq.q}
                  <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="text-sm text-gray-400 mt-3 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-micro text-gray-600 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Processed locally — your data never leaves your device
          </p>
        </div>
      </div>
    </main>
  );
}
