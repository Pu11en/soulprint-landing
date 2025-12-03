// Check what soulprint data exists in Supabase for test@soulprint.ai
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env vars
const envPath = path.resolve(__dirname, '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8');
const env = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSoulprint() {
    console.log('🔍 Checking Supabase for soulprint data...\n');

    // Check by email
    const { data: emailData, error: emailError } = await supabase
        .from('soulprints')
        .select('*')
        .eq('user_id', 'test@soulprint.ai')
        .maybeSingle();

    if (emailError) {
        console.log('Error querying by email:', emailError.message);
    } else if (emailData) {
        console.log('✅ Found soulprint for test@soulprint.ai:');
        console.log('   Created:', emailData.created_at);
        console.log('   Updated:', emailData.updated_at);
        
        const sp = emailData.soulprint_data;
        if (typeof sp === 'string') {
            const parsed = JSON.parse(sp);
            console.log('\n📋 SoulPrint Data Keys:', Object.keys(parsed));
            if (parsed.full_system_prompt) {
                console.log('\n🤖 Has full_system_prompt: YES');
                console.log('   Preview:', parsed.full_system_prompt.substring(0, 200) + '...');
            }
            if (parsed.profile_summary) {
                console.log('\n👤 Profile Summary:');
                console.log(JSON.stringify(parsed.profile_summary, null, 2));
            }
        } else {
            console.log('\n📋 SoulPrint Data Keys:', Object.keys(sp || {}));
            if (sp?.full_system_prompt) {
                console.log('\n🤖 Has full_system_prompt: YES');
                console.log('   Preview:', sp.full_system_prompt.substring(0, 200) + '...');
            }
            if (sp?.profile_summary) {
                console.log('\n👤 Profile Summary:');
                console.log(JSON.stringify(sp.profile_summary, null, 2));
            }
        }
    } else {
        console.log('❌ No soulprint found for test@soulprint.ai');
    }

    // Also check all soulprints
    console.log('\n' + '='.repeat(50));
    console.log('📊 All soulprints in database:');
    
    const { data: allData, error: allError } = await supabase
        .from('soulprints')
        .select('user_id, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);

    if (allError) {
        console.log('Error:', allError.message);
    } else {
        allData.forEach(row => {
            console.log(`  - ${row.user_id} (updated: ${row.updated_at})`);
        });
    }
}

checkSoulprint();
