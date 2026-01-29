'use client';

import { useState } from 'react';
import Link from 'next/link';

interface MemoryResult {
  id: string;
  content: string;
  similarity: number;
  metadata?: {
    conversation_title?: string;
    timestamp?: string;
  };
}

interface MemoryStatus {
  totalChunks: number;
  importJobs: Array<{
    id: string;
    status: string;
    created_at: string;
    total_chunks: number;
    processed_chunks: number;
  }>;
}

export default function TestPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemoryResult[]>([]);
  const [status, setStatus] = useState<MemoryStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [topK, setTopK] = useState(5);

  const fetchStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/memory/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  const searchMemory = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    setResults([]);
    
    try {
      const res = await fetch('/api/memory/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK }),
      });
      
      if (!res.ok) throw new Error('Query failed');
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090B] px-6 py-12">
      <nav className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
        <Link href="/" className="text-white font-semibold">← Back</Link>
        <h1 className="text-white text-xl font-bold">RLM Test Console</h1>
        <div />
      </nav>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Status Section */}
        <div className="bg-gray-900 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Memory Status</h2>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh Status'}
            </button>
          </div>
          
          {status && (
            <div className="space-y-3">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Total Memory Chunks</p>
                <p className="text-white text-2xl font-bold">{status.totalChunks}</p>
              </div>
              
              {status.importJobs.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-2">Recent Import Jobs</p>
                  <div className="space-y-2">
                    {status.importJobs.map(job => (
                      <div key={job.id} className="flex items-center justify-between text-sm">
                        <span className={`px-2 py-1 rounded ${
                          job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          job.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
                          job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {job.status}
                        </span>
                        <span className="text-gray-400">
                          {job.processed_chunks}/{job.total_chunks} chunks
                        </span>
                        <span className="text-gray-500">
                          {new Date(job.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Query Section */}
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Query Memory</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm block mb-2">Search Query</label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What do you want to find in your memory?"
                className="w-full bg-gray-800 text-white rounded-lg p-3 border border-gray-700 focus:border-orange-500 focus:outline-none resize-none"
                rows={3}
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div>
                <label className="text-gray-400 text-sm block mb-2">Top K Results</label>
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
              
              <button
                onClick={searchMemory}
                disabled={loading || !query.trim()}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 mt-6"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">
              Results ({results.length})
            </h2>
            
            <div className="space-y-4">
              {results.map((result, i) => (
                <div key={result.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-orange-500 font-mono text-sm">
                      #{i + 1} — Similarity: {(result.similarity * 100).toFixed(1)}%
                    </span>
                    {result.metadata?.conversation_title && (
                      <span className="text-gray-500 text-sm">
                        {result.metadata.conversation_title}
                      </span>
                    )}
                  </div>
                  <p className="text-white text-sm whitespace-pre-wrap">
                    {result.content}
                  </p>
                  {result.metadata?.timestamp && (
                    <p className="text-gray-500 text-xs mt-2">
                      {new Date(result.metadata.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Test Queries */}
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Quick Test Queries</h2>
          <div className="flex flex-wrap gap-2">
            {[
              "What projects have I worked on?",
              "What are my goals?",
              "Tell me about my work",
              "What do I like?",
              "What problems have I solved?",
              "What technologies do I use?",
            ].map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
