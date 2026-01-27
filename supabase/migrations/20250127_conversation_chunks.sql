-- Store raw conversation chunks for RLM
create table if not exists public.conversation_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id text not null,
  title text,
  content text not null,
  message_count int,
  created_at timestamptz not null,
  updated_at timestamptz default now(),
  
  -- For ordering and filtering
  is_recent boolean default false -- within 6 months
);

-- Indexes
create index if not exists idx_conversation_chunks_user_id on public.conversation_chunks(user_id);
create index if not exists idx_conversation_chunks_recent on public.conversation_chunks(user_id, is_recent);
create index if not exists idx_conversation_chunks_created on public.conversation_chunks(user_id, created_at desc);

-- RLS
alter table public.conversation_chunks enable row level security;

create policy "Users can view own chunks"
  on public.conversation_chunks for select
  using (auth.uid() = user_id);

create policy "Service role full access"
  on public.conversation_chunks for all
  using (auth.role() = 'service_role');
