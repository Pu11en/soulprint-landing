-- Enable pgvector extension (if not already enabled)
create extension if not exists vector;

-- Create memory_chunks table (if not exists)
create table if not exists memory_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(1024),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Create index for vector similarity search
create index if not exists memory_chunks_embedding_idx 
  on memory_chunks 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Create index for user_id lookups
create index if not exists memory_chunks_user_id_idx 
  on memory_chunks(user_id);

-- Row Level Security
alter table memory_chunks enable row level security;

-- Users can only see their own memory chunks
create policy if not exists "Users can view own memory_chunks"
  on memory_chunks for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert own memory_chunks"
  on memory_chunks for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can delete own memory_chunks"
  on memory_chunks for delete
  using (auth.uid() = user_id);

-- Function for vector similarity search
create or replace function match_memory_chunks(
  query_embedding vector(1024),
  match_user_id uuid,
  match_count int default 5,
  match_threshold float default 0.5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  created_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    mc.id,
    mc.content,
    mc.metadata,
    mc.created_at,
    1 - (mc.embedding <=> query_embedding) as similarity
  from memory_chunks mc
  where mc.user_id = match_user_id
    and mc.embedding is not null
    and 1 - (mc.embedding <=> query_embedding) > match_threshold
  order by mc.embedding <=> query_embedding
  limit match_count;
end;
$$;
