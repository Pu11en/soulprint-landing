'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, Brain } from 'lucide-react';

const DB_NAME = 'soulprint_import';

interface SyncStatus {
  phase: 'idle' | 'syncing' | 'embedding' | 'complete';
  progress: number;
  message: string;
}

export function BackgroundSync({ onComplete }: { onComplete?: () => void }) {
  const [status, setStatus] = useState<SyncStatus>({ 
    phase: 'idle', 
    progress: 0, 
    message: '' 
  });
  const [visible, setVisible] = useState(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    checkAndSync();
  }, []);

  async function checkAndSync() {
    // Check if there's pending sync
    const pending = sessionStorage.getItem('soulprint_pending_chunks');
    if (!pending || syncingRef.current) return;

    syncingRef.current = true;
    setVisible(true);
    setStatus({ phase: 'syncing', progress: 0, message: 'Syncing memories...' });

    try {
      const db = await openDB();
      
      // Get chunks from IndexedDB
      const chunks = await getAllFromStore(db, 'chunks');
      const raw = await getAllFromStore(db, 'raw');
      
      console.log(`[BackgroundSync] Found ${chunks.length} chunks, ${raw.length} raw`);

      if (chunks.length === 0 && raw.length === 0) {
        // Nothing to sync
        sessionStorage.removeItem('soulprint_pending_chunks');
        setVisible(false);
        return;
      }

      // Upload chunks in batches
      const CHUNK_BATCH = 50;
      for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
        const batch = chunks.slice(i, i + CHUNK_BATCH);
        const batchIndex = Math.floor(i / CHUNK_BATCH);
        const totalBatches = Math.ceil(chunks.length / CHUNK_BATCH);
        
        setStatus({ 
          phase: 'syncing', 
          progress: Math.round((i / chunks.length) * 50),
          message: `Uploading memories (${batchIndex + 1}/${totalBatches})...`
        });

        await fetch('/api/import/save-chunks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunks: batch, batchIndex, totalBatches }),
        });
      }

      // Upload raw in batches
      const RAW_BATCH = 25;
      for (let i = 0; i < raw.length; i += RAW_BATCH) {
        const batch = raw.slice(i, i + RAW_BATCH);
        const batchIndex = Math.floor(i / RAW_BATCH);
        const totalBatches = Math.ceil(raw.length / RAW_BATCH);
        
        setStatus({ 
          phase: 'syncing', 
          progress: 50 + Math.round((i / raw.length) * 20),
          message: `Saving conversations (${batchIndex + 1}/${totalBatches})...`
        });

        await fetch('/api/import/save-raw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversations: batch, batchIndex, totalBatches }),
        });
      }

      // Clear IndexedDB
      await clearStore(db, 'chunks');
      await clearStore(db, 'raw');
      sessionStorage.removeItem('soulprint_pending_chunks');

      // Start embedding
      setStatus({ phase: 'embedding', progress: 70, message: 'Building memory index...' });
      
      await fetch('/api/import/embed-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // Poll for completion
      await pollEmbeddingStatus();

      setStatus({ phase: 'complete', progress: 100, message: 'Memory ready!' });
      
      setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 2000);

    } catch (error) {
      console.error('[BackgroundSync] Error:', error);
      setStatus({ phase: 'idle', progress: 0, message: '' });
      setVisible(false);
    } finally {
      syncingRef.current = false;
    }
  }

  async function pollEmbeddingStatus() {
    let complete = false;
    while (!complete) {
      await new Promise(r => setTimeout(r, 2000));
      
      try {
        const res = await fetch('/api/memory/status');
        const data = await res.json();
        
        const progress = data.embeddingProgress || 0;
        setStatus({ 
          phase: 'embedding', 
          progress: 70 + Math.round(progress * 0.3),
          message: `Building memory index (${progress}%)...`
        });

        if (data.embeddingStatus === 'complete' || progress >= 100) {
          complete = true;
        }
      } catch {
        // Continue polling
      }
    }
  }

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="bg-zinc-900 border border-zinc-700 rounded-full px-4 py-2 flex items-center gap-3 shadow-lg">
          {status.phase === 'complete' ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : status.phase === 'embedding' ? (
            <Brain className="w-4 h-4 text-orange-500 animate-pulse" />
          ) : (
            <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
          )}
          <span className="text-sm text-white/80">{status.message}</span>
          <span className="text-xs text-white/50">{status.progress}%</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// IndexedDB helpers
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getAllFromStore(db: IDBDatabase, storeName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function clearStore(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
