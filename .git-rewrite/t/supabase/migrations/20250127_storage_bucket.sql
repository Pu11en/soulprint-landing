-- Create imports storage bucket for user uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imports',
  'imports',
  false,
  10737418240, -- 10GB limit
  array['application/zip', 'application/x-zip-compressed']
)
on conflict (id) do nothing;

-- RLS policies for imports bucket
create policy "Users can upload to own folder"
on storage.objects for insert
with check (
  bucket_id = 'imports' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can read own uploads"
on storage.objects for select
using (
  bucket_id = 'imports' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete own uploads"
on storage.objects for delete
using (
  bucket_id = 'imports' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Service role can do everything
create policy "Service role full access to imports"
on storage.objects for all
using (auth.role() = 'service_role');
