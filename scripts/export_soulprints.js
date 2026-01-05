const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function exportSoulprints() {
  console.log('Fetching soulprints and profiles...');

  const { data, error } = await supabase
    .from('soulprints')
    .select(`
      id,
      user_id,
      created_at,
      soulprint_data,
      profiles!soulprints_user_id_fkey (
        id,
        email,
        full_name
      )
    `);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No soulprints found.');
    return;
  }

  console.log(`Found ${data.length} soulprints.`);

  const csvHeader = 'Soulprint ID,User ID,Email,Full Name,Created At,Soulprint Data Summary\n';
  const csvRows = data.map(row => {
    const profile = row.profiles || {};
    const summary = JSON.stringify(row.soulprint_data).replace(/"/g, '""'); // Escape quotes for CSV
    return `${row.id},${profile.id || 'Unknown'},${profile.email || 'Unknown'},"${profile.full_name || ''}",${row.created_at},"${summary.substring(0, 100)}..."`;
  });

  const csvContent = csvHeader + csvRows.join('\n');
  const outputPath = path.join(__dirname, '..', 'soulprints_export.csv');

  fs.writeFileSync(outputPath, csvContent);
  console.log(`Export saved to ${outputPath}`);
}

exportSoulprints();
