const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('soulprints')
    .select('id, user_id, created_at, soulprint_data, profiles!soulprints_user_id_fkey(email, full_name)');

  if (error) {
    console.error(error);
    return;
  }

  let output = 'SOULPRINT EXPORT - ' + new Date().toISOString() + '\n';
  output += '='.repeat(80) + '\n\n';

  data.forEach((row, i) => {
    output += '='.repeat(80) + '\n';
    output += 'SOULPRINT #' + (i + 1) + '\n';
    output += '='.repeat(80) + '\n';
    output += 'Email: ' + (row.profiles?.email || 'Unknown') + '\n';
    output += 'Name: ' + (row.profiles?.full_name || 'Unknown') + '\n';
    output += 'Created: ' + row.created_at + '\n';
    output += '-'.repeat(80) + '\n';
    output += 'FULL SOULPRINT DATA:\n';
    output += '-'.repeat(80) + '\n';
    output += JSON.stringify(row.soulprint_data, null, 2) + '\n\n';
  });

  fs.writeFileSync('all_soulprints.txt', output);
  console.log('Saved to all_soulprints.txt (' + data.length + ' soulprints)');
}

run();
