'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';

const steps = [
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
    description: 'Click the download link in ChatGPT\'s email to get your export ZIP file.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Upload it here',
    description: 'Drop your ZIP file below and we\'ll build your memory in seconds.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
];

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export default function ImportPage() {
  const [status, setStatus] = useState<ImportStatus>('idle');
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
    setProgress(10);

    try {
      // Read file as base64
      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(10 + (e.loaded / e.total) * 40);
        }
      };

      reader.onload = async () => {
        setProgress(50);
        setStatus('processing');

        try {
          // Send to API
          const base64 = (reader.result as string).split(',')[1];
          
          const res = await fetch('/api/import/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zipBase64: base64 }),
          });

          setProgress(80);
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Upload failed');
          }

          setProgress(100);
          setStatus('success');
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : 'Processing failed');
          setStatus('error');
        }
      };

      reader.onerror = () => {
        setErrorMessage('Failed to read file');
        setStatus('error');
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setErrorMessage('Failed to upload file');
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
    <main className="min-h-screen bg-[#09090B] px-6 py-12">
      {/* Ambient glow */}
      <div className="glow-ambient top-[-100px] left-1/2 -translate-x-1/2" />

      {/* Navigation */}
      <nav className="max-w-5xl mx-auto mb-16">
        <Link href="/" className="logo">
          <img src="/logo.svg" alt="SoulPrint" className="logo-icon" />
          <span className="text-white">SoulPrint</span>
        </Link>
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
        <div className="grid md:grid-cols-3 gap-6 mb-16">
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

              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-white/10 to-transparent" />
              )}
            </div>
          ))}
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
              
              <h2 className="text-title text-white mb-2">Drop your ZIP file here</h2>
              <p className="text-caption mb-4">
                or click to browse
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
