'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

export default function TestUploadPage() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setStatus('uploading');
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/test-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult(data);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen bg-[#09090B] px-6 py-12">
      <nav className="max-w-2xl mx-auto mb-8">
        <Link href="/" className="text-gray-400 hover:text-white">← Back</Link>
      </nav>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Test Upload</h1>
        <p className="text-gray-400 mb-8">
          Direct upload test — bypasses R2, tests parsing only.<br/>
          Upload your ZIP or just the conversations.json file.
        </p>

        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            className="hidden"
          />

          {status === 'idle' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-gray-700 rounded-xl text-gray-400 hover:border-orange-500 hover:text-orange-500 transition-colors"
            >
              Tap to select ZIP or JSON file
            </button>
          )}

          {status === 'uploading' && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-white">Processing...</p>
            </div>
          )}

          {status === 'done' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold">Parsing successful!</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">File Size</p>
                  <p className="text-white text-xl font-bold">{result.stats.fileSize}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">JSON Size</p>
                  <p className="text-white text-xl font-bold">{result.stats.jsonSize}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Conversations</p>
                  <p className="text-white text-xl font-bold">{result.stats.conversationCount}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Messages</p>
                  <p className="text-white text-xl font-bold">{result.stats.totalMessages}</p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-2">Sample Conversation Titles</p>
                <ul className="text-white text-sm space-y-1">
                  {result.stats.sampleTitles.map((title: string, i: number) => (
                    <li key={i} className="truncate">• {title}</li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => { setStatus('idle'); setResult(null); }}
                className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Test Another File
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => { setStatus('idle'); setError(''); }}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <div className="text-gray-500 text-sm">
          <p><strong>Note:</strong> This test accepts files up to ~50MB (Vercel limit).</p>
          <p>For larger files, extract just conversations.json from your ZIP and upload that.</p>
        </div>
      </div>
    </main>
  );
}
