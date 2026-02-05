/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let lastStatus = '';

async function check() {
  try {
    // Check user profiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, import_status, embedding_status, total_chunks, total_messages, archetype')
      .order('updated_at', { ascending: false })
      .limit(1);

    // Check chunks
    const { count: chunkCount } = await supabase
      .from('conversation_chunks')
      .select('*', { count: 'exact', head: true });

    // Check chunks with embeddings
    const { count: embeddedCount } = await supabase
      .from('conversation_chunks')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    // Check chunk tiers
    const { data: tierCounts } = await supabase
      .from('conversation_chunks')
      .select('chunk_tier');

    const tiers = { micro: 0, medium: 0, macro: 0 };
    if (tierCounts) {
      tierCounts.forEach(c => {
        if (c.chunk_tier) tiers[c.chunk_tier]++;
      });
    }

    const now = new Date().toLocaleTimeString();
    const profile = profiles && profiles[0];

    const status = JSON.stringify({
      import: profile ? profile.import_status : null,
      embed: profile ? profile.embedding_status : null,
      chunks: chunkCount,
      embedded: embeddedCount,
      tiers
    });

    if (status !== lastStatus) {
      console.log('\n[' + now + '] ═══════════════════════════════════════');
      if (profile) {
        console.log('  Import:', profile.import_status);
        console.log('  Embedding:', profile.embedding_status);
        console.log('  Messages:', profile.total_messages);
        console.log('  Archetype:', profile.archetype ? profile.archetype.substring(0, 50) : 'pending');
      } else {
        console.log('  Waiting for upload...');
      }
      console.log('  Chunks:', chunkCount, '(embedded:', embeddedCount + ')');
      console.log('  Tiers: micro=' + tiers.micro + ' medium=' + tiers.medium + ' macro=' + tiers.macro);
      lastStatus = status;
    } else {
      process.stdout.write('.');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

console.log('Watching for import... (upload your ZIP now)');
console.log('Press Ctrl+C to stop\n');

setInterval(check, 3000);
check();
