'use client';

import Link from 'next/link';
import { useState } from 'react';

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
    title: 'Forward the email to us',
    description: 'When ChatGPT emails you, just forward that email to us. We\'ll grab the download automatically.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Memory built',
    description: 'We process your conversations and build your personal AI memory in ~5 minutes.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

export default function ImportPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendInstructions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/send-instructions', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send');
      }
      
      setEmailSent(true);
    } catch (err) {
      console.error('Failed to send instructions:', err);
      alert('Failed to send instructions. Please try again.');
    } finally {
      setIsLoading(false);
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
              {/* Step number */}
              <span className="absolute top-6 right-6 text-4xl font-bold text-white/[0.04]">
                {step.step}
              </span>
              
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-5 group-hover:bg-orange-500/15 transition-colors">
                {step.icon}
              </div>
              
              {/* Content */}
              <h3 className="text-title text-white mb-2">{step.title}</h3>
              <p className="text-body text-sm">{step.description}</p>

              {/* Connector */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-white/10 to-transparent" />
              )}
            </div>
          ))}
        </div>

        {/* Action Card */}
        <div className="max-w-lg mx-auto animate-in" style={{ animationDelay: '0.4s' }}>
          <div className="card-elevated p-8 text-center relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-orange-500/15 blur-[80px] -z-10" />
            
            {!emailSent ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 glow-orange">
                  <img src="/logo.svg" alt="SoulPrint" className="w-12 h-12" />
                </div>
                
                <h2 className="text-title text-white mb-2">Ready to import?</h2>
                <p className="text-caption mb-6">
                  We&apos;ll send detailed instructions to your email.
                </p>

                <button
                  onClick={handleSendInstructions}
                  disabled={isLoading}
                  className="btn btn-primary btn-lg w-full sm:w-auto"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Instructions'
                  )}
                </button>

                <div className="mt-6">
                  <Link href="/chat" className="text-caption hover:text-gray-300 transition-colors">
                    Skip for now →
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <h2 className="text-title text-white mb-2">Instructions sent!</h2>
                <p className="text-caption mb-6">
                  Check your inbox for the next steps. We&apos;ll notify you when your memory is ready.
                </p>

                <Link href="/chat" className="btn btn-primary btn-lg">
                  Continue to Chat
                </Link>
              </>
            )}
          </div>
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
