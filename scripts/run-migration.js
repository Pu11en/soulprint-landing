/**
 * RUN MIGRATION
 * Executes SQL migration against Supabase using the REST API
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runMigration() {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260121_add_memory_evolution.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolon and run each statement separately
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📦 Running migration with ${statements.length} statements...`);

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
        
        try {
            // Use the Supabase postgrest for simple queries won't work for DDL
            // Instead we'll use the management API or just log what needs to be run
            console.log(`\n[${i + 1}/${statements.length}] ${preview}...`);
        } catch (err) {
            console.error(`❌ Statement ${i + 1} failed:`, err.message);
        }
    }

    console.log('\n⚠️  DDL statements cannot be run via REST API.');
    console.log('📋 Please run the SQL file manually in the Supabase SQL Editor:');
    console.log('   1. Go to https://supabase.com/dashboard/project/swvljsixpvvcirjmflze/sql');
    console.log('   2. Copy the contents of: supabase/migrations/20260121_add_memory_evolution.sql');
    console.log('   3. Paste and run in the SQL Editor');
    console.log('\n🔗 Direct link: https://supabase.com/dashboard/project/swvljsixpvvcirjmflze/sql/new');
}

runMigration().catch(console.error);
