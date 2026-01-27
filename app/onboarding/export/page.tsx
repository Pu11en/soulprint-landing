'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Download, Upload, CheckCircle } from 'lucide-react';

const steps = [
  {
    number: 1,
    title: 'Open ChatGPT Settings',
    description: 'Go to chat.openai.com → Click your profile (bottom left) → Settings',
  },
  {
    number: 2,
    title: 'Request Data Export',
    description: 'Click "Data controls" → "Export data" → "Confirm export"',
  },
  {
    number: 3,
    title: 'Check Your Email',
    description: 'OpenAI will email you a download link within a few minutes to a few hours',
  },
  {
    number: 4,
    title: 'Download the ZIP',
    description: 'Click the link in the email to download your conversations.zip file',
  },
];

export default function OnboardingExportPage() {
  const router = useRouter();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps(prev => 
      prev.includes(stepNumber) 
        ? prev.filter(n => n !== stepNumber)
        : [...prev, stepNumber]
    );
  };

  const allComplete = completedSteps.length === steps.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#EA580C]/20 mb-6">
            <Download className="w-8 h-8 text-[#EA580C]" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Export Your ChatGPT Data</h1>
          <p className="text-gray-400">
            Follow these steps to download your conversation history from OpenAI
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-12">
          {steps.map((step) => {
            const isComplete = completedSteps.includes(step.number);
            return (
              <button
                key={step.number}
                onClick={() => toggleStep(step.number)}
                className={`w-full text-left p-6 rounded-xl border transition-all ${
                  isComplete 
                    ? 'bg-[#EA580C]/10 border-[#EA580C]/50' 
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isComplete ? 'bg-[#EA580C] text-white' : 'bg-white/10 text-gray-400'
                  }`}>
                    {isComplete ? <CheckCircle className="w-5 h-5" /> : step.number}
                  </div>
                  <div>
                    <h3 className={`font-semibold mb-1 ${isComplete ? 'text-[#EA580C]' : 'text-white'}`}>
                      {step.title}
                    </h3>
                    <p className="text-gray-400 text-sm">{step.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => router.push('/import')}
            className={`inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold transition-all ${
              allComplete
                ? 'bg-[#EA580C] hover:bg-[#EA580C]/90 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Upload className="w-5 h-5" />
            {allComplete ? "I've got my ZIP — Let's go!" : 'Continue to Upload'}
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <p className="mt-4 text-gray-500 text-sm">
            Don't have your ZIP yet? Complete the steps above first.
          </p>
        </div>

        {/* Direct link to ChatGPT */}
        <div className="mt-12 p-6 rounded-xl bg-white/5 border border-white/10 text-center">
          <p className="text-gray-400 mb-3">Quick link to ChatGPT settings:</p>
          <a
            href="https://chat.openai.com/#settings/DataControls"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#EA580C] hover:underline font-medium"
          >
            Open ChatGPT Data Controls →
          </a>
        </div>
      </div>
    </div>
  );
}
