'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';

interface Step {
  step: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tip?: string;
}

const steps: Step[] = [
  {
    step: '01',
    title: 'Request your ChatGPT export',
    description: 'Go to ChatGPT Settings → Data Controls → Export. ChatGPT will email you when it\'s ready.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Download the ZIP file',
    description: 'Open the download link in ChatGPT app. Keep your phone on while downloading. If it pauses, tap the refresh icon to resume.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
    tip: 'Large exports can take a few minutes. The download can be resumed if interrupted.',
  },
  {
    step: '03',
    title: 'Upload it here',
    description: 'Upload your ZIP below and we\'ll build your memory in seconds.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
];

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

function DownloadGuide() {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 mt-4">
      <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Download Tips
      </h4>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-xs text-gray-400">Keep your phone <span className="text-white">screen on</span> while downloading</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className="text-xs text-gray-400">If paused, tap <span className="text-white">refresh ↻</span> to resume</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-gray-400">Large exports may take <span className="text-white">5-10 minutes</span></p>
        </div>
      </div>
    </div>
  );
}

export default function ImportPage() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [showGuide, setShowGuide] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setErrorMessage('Please upload a ZIP file');
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setProgress(5);

    // Keep screen on during upload
    let wakeLock: WakeLockSentinel | null = null;
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {
      console.log('Wake lock not available:', e);
    }

    try {
      // Step 1: Get signed upload URL from our API
      const urlRes = await fetch('/api/import/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      });

      if (!urlRes.ok) {
        const data = await urlRes.json();
        throw new Error(data.error || 'Failed to get upload URL');
      }

      const { uploadUrl, path } = await urlRes.json();
      setProgress(10);

      // Step 2: Upload directly to Supabase Storage (bypasses Vercel limit)
      const xhr = new XMLHttpRequest();
      
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            // 10-80% is upload progress
            setProgress(10 + (e.loaded / e.total) * 70);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', 'application/zip');
        xhr.send(file);
      });

      setProgress(85);
      setStatus('processing');

      // Step 3: Tell our API to process the uploaded file
      const processRes = await fetch('/api/import/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: path }),
      });

      if (!processRes.ok) {
        const data = await processRes.json();
        throw new Error(data.error || 'Processing failed');
      }

      setProgress(100);
      setStatus('success');

    } catch (err) {
      console.error('Upload error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
    } finally {
      // Release wake lock
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
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
    <main className="min-h-screen bg-[#09090B] px-6 py-12">
      {/* Ambient glow */}
      <div className="glow-ambient top-[-100px] left-1/2 -translate-x-1/2" />

      {/* Navigation */}
      <nav className="max-w-5xl mx-auto mb-16 flex items-center justify-between">
        <Link href="/" className="logo">
          <img src="/logo.svg" alt="SoulPrint" className="logo-icon" />
          <span className="text-white">SoulPrint</span>
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="w-10 h-10 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
          aria-label="Refresh"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </nav>

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 animate-in">
          <p className="text-micro text-orange-500 mb-3">Import your data</p>
          <h1 className="text-headline text-white mb-4">
            Connect your <span className="text-gradient">memory</span>
          </h1>
          <p className="text-body max-w-xl mx-auto">
            Import your ChatGPT conversations to give your AI perfect context about you.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {steps.map((step, i) => (
            <div 
              key={i} 
              className="card card-hover p-6 animate-in relative group"
              style={{ animationDelay: `${0.1 + i * 0.1}s` }}
            >
              <span className="absolute top-6 right-6 text-4xl font-bold text-white/[0.04]">
                {step.step}
              </span>
              
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-5 group-hover:bg-orange-500/15 transition-colors">
                {step.icon}
              </div>
              
              <h3 className="text-title text-white mb-2">{step.title}</h3>
              <p className="text-body text-sm">{step.description}</p>
              
              {step.tip && (
                <p className="text-xs text-orange-500/70 mt-3 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  {step.tip}
                </p>
              )}

              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-white/10 to-transparent" />
              )}
            </div>
          ))}
        </div>

        {/* Help Guide Toggle */}
        <div className="max-w-lg mx-auto mb-8">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-2 mx-auto"
          >
            <svg className={`w-4 h-4 transition-transform ${showGuide ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showGuide ? 'Hide' : 'Need help downloading?'}
          </button>
          {showGuide && <DownloadGuide />}
        </div>

        {/* Upload Area */}
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
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              
              <h2 className="text-title text-white mb-2">Tap to upload your ZIP</h2>
              <p className="text-caption mb-4">
                Select your ChatGPT export file
              </p>
              
              <p className="text-xs text-gray-600">
                Accepts ChatGPT export ZIP files
              </p>

              <div className="mt-6">
                <Link href="/chat" className="text-caption hover:text-gray-300 transition-colors">
                  Skip for now →
                </Link>
              </div>
            </div>
          )}

          {(status === 'uploading' || status === 'processing') && (
            <div className="card-elevated p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-orange-500/15 blur-[80px] -z-10" />
              
              <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="animate-spin h-8 w-8 text-orange-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              
              <h2 className="text-title text-white mb-2">
                {status === 'uploading' ? 'Uploading...' : 'Building your memory...'}
              </h2>
              <p className="text-caption mb-4">
                {status === 'uploading' ? 'Reading your conversations' : 'Processing and storing memories'}
              </p>
              
              <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-orange-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">{Math.round(progress)}%</p>
            </div>
          )}

          {status === 'success' && (
            <div className="card-elevated p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-green-500/15 blur-[80px] -z-10" />
              
              <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h2 className="text-title text-white mb-2">Memory imported!</h2>
              <p className="text-caption mb-6">
                Your AI now knows you. Start chatting and experience the difference.
              </p>

              <Link href="/chat" className="btn btn-primary btn-lg">
                Start Chatting
              </Link>
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

              <button
                onClick={() => { setStatus('idle'); setErrorMessage(''); }}
                className="btn btn-secondary btn-lg"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Security note */}
        <div className="text-center mt-8">
          <p className="text-micro text-gray-600 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Your data is encrypted and never shared
          </p>
        </div>
      </div>
    </main>
  );
}
