-- User profiles table - stores quick soulprint for instant chat
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  
  -- Quick soulprint data (JSON)
  soulprint jsonb default null,
  soulprint_text text default null, -- Pre-rendered context for chat
  
  -- Import progress tracking
  import_status text default 'none' check (import_status in ('none', 'quick_ready', 'processing', 'complete')),
  total_conversations integer default 0,
  total_messages integer default 0,
  processed_chunks integer default 0,
  total_chunks integer default 0,
  
  -- Timestamps
  soulprint_generated_at timestamptz,
  embeddings_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast lookup
create index if not exists user_profiles_user_id_idx on public.user_profiles(user_id);

-- RLS
alter table public.user_profiles enable row level security;

create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);

-- Auto-create profile on signup (trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
