-- Enable pgvector extension for embeddings
create extension if not exists vector with schema extensions;

-- Import jobs table - tracks each data import request
create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  source_email text,
  source_type text default 'chatgpt_export',
  total_chunks integer default 0,
  processed_chunks integer default 0,
  error text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Memory chunks table - stores embedded conversation fragments
create table if not exists public.memory_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_job_id uuid references public.import_jobs(id) on delete set null,
  content text not null,
  embedding vector(1024), -- Titan embed v2 produces 1024-dim vectors
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Indexes for efficient querying
create index if not exists memory_chunks_user_id_idx on public.memory_chunks(user_id);
create index if not exists memory_chunks_import_job_idx on public.memory_chunks(import_job_id);
create index if not exists import_jobs_user_id_idx on public.import_jobs(user_id);
create index if not exists import_jobs_status_idx on public.import_jobs(status);

-- Vector similarity search index (IVFFlat for production, HNSW for dev)
create index if not exists memory_chunks_embedding_idx on public.memory_chunks 
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RLS policies
alter table public.import_jobs enable row level security;
alter table public.memory_chunks enable row level security;

-- Users can only see their own import jobs
create policy "Users can view own import jobs"
  on public.import_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own import jobs"
  on public.import_jobs for insert
  with check (auth.uid() = user_id);

-- Service role can do everything (for API routes)
create policy "Service role full access to import_jobs"
  on public.import_jobs for all
  using (auth.role() = 'service_role');

-- Users can only see their own memory chunks
create policy "Users can view own memory chunks"
  on public.memory_chunks for select
  using (auth.uid() = user_id);

create policy "Users can insert own memory chunks"
  on public.memory_chunks for insert
  with check (auth.uid() = user_id);

-- Service role can do everything (for API routes)
create policy "Service role full access to memory_chunks"
  on public.memory_chunks for all
  using (auth.role() = 'service_role');

-- Function to search memories by similarity
create or replace function search_memories(
  query_embedding vector(1024),
  match_user_id uuid,
  match_count int default 10,
  match_threshold float default 0.7
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    memory_chunks.id,
    memory_chunks.content,
    memory_chunks.metadata,
    1 - (memory_chunks.embedding <=> query_embedding) as similarity
  from memory_chunks
  where memory_chunks.user_id = match_user_id
    and 1 - (memory_chunks.embedding <=> query_embedding) > match_threshold
  order by memory_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
