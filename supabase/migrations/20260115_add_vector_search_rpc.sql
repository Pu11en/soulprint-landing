-- Add vector search capabilities for SoulPrint Memory Retrieval

create or replace function match_chat_logs (
  query_embedding vector(1536),
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
