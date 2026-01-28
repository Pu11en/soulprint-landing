'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const router = useRouter();
  const [aiName, setAiName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [stats, setStats] = useState({ messages: 0, memories: 0 });

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load AI name
        const nameRes = await fetch('/api/profile/ai-name');
        if (nameRes.ok) {
          const data = await nameRes.json();
          setAiName(data.aiName || null);
        }

        // Load stats
        const statsRes = await fetch('/api/chat/messages?limit=1');
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats({ messages: data.total || 0, memories: data.memoryCount || 0 });
        }
      } catch (e) {
        console.error('Failed to load dashboard data', e);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handleRename = async () => {
    if (!renameInput.trim()) return;
    try {
      const res = await fetch('/api/profile/ai-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiName(data.aiName);
        setShowRenameModal(false);
        setRenameInput('');
      }
    } catch {}
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/50">
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0e0e0e]/95 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3">
              <img src="/logo.svg" alt="SoulPrint" className="w-8 h-8" />
              <span className="font-semibold text-lg">SoulPrint</span>
            </Link>
          </div>
          <Link 
            href="/chat"
            className="px-4 py-2 bg-[#f97415] text-white text-sm font-medium rounded-full hover:bg-orange-600 transition-colors"
          >
            Open Chat
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* AI Info Card */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Your AI</p>
              <h2 className="text-2xl font-semibold">{aiName || 'Unnamed'}</h2>
            </div>
            <button
              onClick={() => { setRenameInput(aiName || ''); setShowRenameModal(true); }}
              className="px-4 py-2 bg-white/10 text-white/70 text-sm rounded-xl hover:bg-white/15 transition-colors"
            >
              Rename
            </button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/[0.03] rounded-xl p-4">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Messages</p>
              <p className="text-xl font-semibold">{stats.messages.toLocaleString()}</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-4">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Memories</p>
              <p className="text-xl font-semibold">{stats.memories.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3 px-1">Settings</h3>
          
          <Link 
            href="/chat"
            className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">💬</span>
              <span className="font-medium">Chat with {aiName || 'AI'}</span>
            </div>
            <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link 
            href="/memory"
            className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🧠</span>
              <span className="font-medium">View Memory</span>
            </div>
            <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link 
            href="/achievements"
            className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🏆</span>
              <span className="font-medium">Achievements & XP</span>
            </div>
            <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link 
            href="/import"
            className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📥</span>
              <span className="font-medium">Re-import Data</span>
            </div>
            <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 pt-6 border-t border-white/[0.06]">
          <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3 px-1">Account</h3>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/15 transition-colors text-red-400"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🚪</span>
              <span className="font-medium">Sign Out</span>
            </div>
          </button>
        </div>
      </main>

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setShowRenameModal(false)}>
          <div className="bg-[#1c1c1d] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Rename your AI</h3>
            <input
              type="text"
              value={renameInput}
              onChange={e => setRenameInput(e.target.value)}
              placeholder="Enter a new name"
              className="w-full h-12 bg-[#2c2c2e] rounded-xl px-4 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 mb-4"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); }}
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRenameModal(false)}
                className="flex-1 h-11 bg-white/10 rounded-xl text-white/70 font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleRename}
                disabled={!renameInput.trim()}
                className="flex-1 h-11 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white font-medium disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
