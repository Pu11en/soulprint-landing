'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Memory {
  id: string;
  conversationId: string;
  title: string;
  snippet: string;
  fullContent: string;
  messageCount: number;
  createdAt: string;
  isRecent: boolean;
  source: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MemoryControlPage() {
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'selected' | 'single' | null>(null);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  const fetchMemories = useCallback(async (page = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(searchQuery && { search: searchQuery }),
      });
      
      const res = await fetch(`/api/memory/list?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch memories:', error);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    // Check auth
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      fetchMemories();
    };
    checkAuth();
  }, [router, fetchMemories]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setSelectedIds(new Set());
    fetchMemories(1, searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    fetchMemories(1, '');
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === memories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(memories.map(m => m.id)));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const idsToDelete = deleteTarget === 'single' && singleDeleteId 
        ? [singleDeleteId] 
        : Array.from(selectedIds);
      
      const res = await fetch('/api/memory/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryIds: idsToDelete }),
      });
      
      if (res.ok) {
        // Refresh list
        await fetchMemories(pagination.page);
        setSelectedIds(new Set());
        setExpandedId(null);
      }
    } catch (error) {
      console.error('Failed to delete memories:', error);
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
    setSingleDeleteId(null);
  };

  const confirmDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget('selected');
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSingle = (id: string) => {
    setSingleDeleteId(id);
    setDeleteTarget('single');
    setShowDeleteConfirm(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Header */}
      <header className="sticky top-0 bg-[#0e0e0e]/95 backdrop-blur-lg z-20 border-b border-white/[0.06]">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/chat" className="p-2 -ml-2 text-white/60 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-semibold tracking-tight">Memory Control</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/chat" className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block">
                Back to Chat
              </Link>
              <button onClick={handleSignOut} className="text-sm text-red-400 hover:text-red-300 transition-colors">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Stats & Search */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-white/60">
                {pagination.total.toLocaleString()} memories stored
              </p>
              
              {/* Search */}
              <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search memories..."
                    className="w-full h-10 bg-white/[0.06] border border-white/[0.06] rounded-xl pl-10 pr-4 text-sm outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all placeholder:text-white/30"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="h-10 px-3 bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/[0.1] transition-all"
                  >
                    Clear
                  </button>
                )}
              </form>
            </div>

            {/* Actions bar */}
            {memories.length > 0 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={selectAll}
                  className="text-sm text-orange-500 hover:text-orange-400 transition-colors"
                >
                  {selectedIds.size === memories.length ? 'Deselect all' : 'Select all'}
                </button>
                
                {selectedIds.size > 0 && (
                  <button
                    onClick={confirmDeleteSelected}
                    className="flex items-center gap-2 h-9 px-4 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete {selectedIds.size} selected
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Memory List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse bg-white/[0.03] rounded-xl h-24" />
              ))}
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {search ? 'No memories found' : 'No memories yet'}
              </h3>
              <p className="text-white/50 text-sm max-w-sm mx-auto">
                {search ? 'Try a different search term' : 'Import your ChatGPT history to see your memories here'}
              </p>
              {!search && (
                <Link href="/import" className="inline-block mt-4 text-orange-500 hover:text-orange-400 text-sm font-medium">
                  Import data →
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {memories.map((memory) => (
                <div 
                  key={memory.id}
                  className={`bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden transition-all ${
                    selectedIds.has(memory.id) ? 'ring-1 ring-orange-500/50 bg-orange-500/5' : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(memory.id)}
                        className={`flex-shrink-0 w-5 h-5 rounded border mt-0.5 transition-all ${
                          selectedIds.has(memory.id) 
                            ? 'bg-orange-500 border-orange-500' 
                            : 'border-white/20 hover:border-white/40'
                        }`}
                      >
                        {selectedIds.has(memory.id) && (
                          <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-medium text-white truncate">{memory.title}</h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-white/40">{formatDate(memory.createdAt)}</span>
                            <button
                              onClick={() => confirmDeleteSingle(memory.id)}
                              className="p-1 text-white/30 hover:text-red-400 transition-colors"
                              title="Delete memory"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-sm text-white/60 leading-relaxed">
                          {expandedId === memory.id ? memory.fullContent : memory.snippet}
                        </p>
                        
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-white/30 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {memory.messageCount} messages
                          </span>
                          <span className="text-xs text-white/30">{memory.source}</span>
                          {memory.isRecent && (
                            <span className="text-xs px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded">Recent</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expand/collapse */}
                  {memory.fullContent.length > 200 && (
                    <button
                      onClick={() => setExpandedId(expandedId === memory.id ? null : memory.id)}
                      className="w-full px-4 py-2 text-xs text-orange-500 hover:text-orange-400 hover:bg-white/[0.02] border-t border-white/[0.06] transition-all"
                    >
                      {expandedId === memory.id ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => fetchMemories(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="h-9 px-3 bg-white/[0.06] border border-white/[0.06] rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.1] transition-all"
              >
                Previous
              </button>
              <span className="text-sm text-white/50 px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchMemories(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="h-9 px-3 bg-white/[0.06] border border-white/[0.06] rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.1] transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-[#1c1c1d] rounded-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            
            <h3 className="text-lg font-semibold text-white text-center mb-2">Delete memories?</h3>
            <p className="text-sm text-white/60 text-center mb-6">
              {deleteTarget === 'single' 
                ? 'This memory will be permanently deleted and cannot be recovered.'
                : `${selectedIds.size} memories will be permanently deleted and cannot be recovered.`
              }
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 h-11 bg-white/10 rounded-xl text-white/70 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-11 bg-red-500 hover:bg-red-600 rounded-xl text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
