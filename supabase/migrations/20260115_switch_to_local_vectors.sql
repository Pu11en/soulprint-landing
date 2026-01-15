-- Switch to Local Embeddings (Ollama nomic-embed-text)
-- This creates/alters columns to support 768 dimensions instead of 1536.

-- 1. Alter the column type for chat_logs
ALTER TABLE chat_logs ALTER COLUMN embedding TYPE vector(768);

-- 2. Update the search function to accept vector(768)
create or replace function match_chat_logs (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  match_user_id uuid
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    chat_logs.id,
    chat_logs.content,
    1 - (chat_logs.embedding <=> query_embedding) as similarity
  from chat_logs
  where 1 - (chat_logs.embedding <=> query_embedding) > match_threshold
  and chat_logs.user_id = match_user_id
  order by chat_logs.embedding <=> query_embedding
  limit match_count;
end;
$$;
