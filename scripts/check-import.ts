import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('=== USER_PROFILES ===');
  const { data: profiles, error: profilesError } = await supabase.from('user_profiles').select('*');

  if (profilesError) {
    console.log('Error:', profilesError.message);
  } else if (profiles?.length) {
    profiles.forEach(p => {
      console.log('---');
      console.log('user_id:', p.user_id);
      console.log('import_status:', p.import_status);
      console.log('import_error:', p.import_error || 'none');
      console.log('embedding_status:', p.embedding_status);
      console.log('total_messages:', p.total_messages);
      console.log('total_conversations:', p.total_conversations);
      console.log('total_chunks:', p.total_chunks);
      console.log('archetype:', p.archetype);
      console.log('soulprint:', p.soulprint ? JSON.stringify(p.soulprint).substring(0, 200) + '...' : 'null');
      console.log('raw_export_path:', p.raw_export_path);
    });
  } else {
    console.log('No user profiles found');
  }

  console.log('\n=== CONVERSATION_CHUNKS ===');
  const { count, error: chunksError } = await supabase
    .from('conversation_chunks')
    .select('*', { count: 'exact', head: true });

  if (chunksError) {
    console.log('Error:', chunksError.message);
  } else {
    console.log('Total chunks:', count);
  }

  // Check embeddings
  const { count: withEmbed } = await supabase
    .from('conversation_chunks')
    .select('*', { count: 'exact', head: true })
    .not('embedding', 'is', null);

  const { count: noEmbed } = await supabase
    .from('conversation_chunks')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null);

  console.log('With embeddings:', withEmbed);
  console.log('Without embeddings:', noEmbed);
}

check();
