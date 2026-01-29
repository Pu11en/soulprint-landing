/**
 * Apply embedding migration to Supabase
 * Run with: npx tsx scripts/apply-embedding-migration.ts
 */

import { createClient } from '@supabase/supabase-js';

// Hardcoded for script - these are already in .env.local
const SUPABASE_URL = 'https://swvljsixpvvcirjmflze.supabase.co';
const SERVICE_ROLE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY!';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('Checking if embedding column exists...');
  
  // Check if column exists
  const { data: cols, error: colError } = await supabase
    .from('conversation_chunks')
    .select('id')
    .limit(1);

  if (colError && colError.message.includes('does not exist')) {
    console.log('❌ Table conversation_chunks does not exist');
    return;
  }

  // Try to query embedding column
  const { error: embError } = await supabase
    .from('conversation_chunks')
    .select('id, embedding')
    .limit(1);

  if (embError && embError.message.includes('embedding')) {
    console.log('❌ Embedding column does not exist');
    console.log('\n⚠️  Please run the following SQL in Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/swvljsixpvvcirjmflze/sql/new\n');
    console.log(`
-- Add embedding column to conversation_chunks for vector search
-- Using 1536 dimensions for OpenAI text-embedding-3-small

-- Add embedding column
ALTER TABLE public.conversation_chunks 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create ivfflat index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_conversation_chunks_embedding 
ON public.conversation_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create vector similarity search function
CREATE OR REPLACE FUNCTION match_conversation_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    cc.id,
    cc.title,
    cc.content,
    cc.created_at,
    1 - (cc.embedding <=> query_embedding) as similarity
  FROM public.conversation_chunks cc
  WHERE cc.user_id = match_user_id
    AND cc.embedding IS NOT NULL
    AND 1 - (cc.embedding <=> query_embedding) > match_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
$$;
`);
    return;
  }

  console.log('✅ Embedding column exists!');
  
  // Check for the RPC function
  const { error: rpcError } = await supabase.rpc('match_conversation_chunks', {
    query_embedding: new Array(1536).fill(0),
    match_user_id: '00000000-0000-0000-0000-000000000000',
    match_count: 1,
    match_threshold: 0.5,
  });

  if (rpcError && rpcError.message.includes('Could not find')) {
    console.log('❌ match_conversation_chunks function does not exist');
    console.log('   Run the CREATE FUNCTION SQL above');
    return;
  }

  console.log('✅ match_conversation_chunks RPC exists!');
  console.log('\n🎉 Migration already applied!');
}

applyMigration().catch(console.error);
