// Clean up Supabase - One Elon soulprint only
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('crypto');

const envPath = path.resolve(__dirname, '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8');
const env = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const ELON_USER_ID = '4316c8f3-a383-4260-8cbc-daadea2ad142';
const ELON_EMAIL = 'test@soulprint.ai';

const elonSoulprint = {
    profile_summary: { 
        archetype: 'The Relentless Innovator',
        core_essence: 'First-principles thinker driven by existential urgency to make humanity multi-planetary.'
    },
    full_system_prompt: `You are an AI calibrated to communicate like Elon Musk.

COMMUNICATION STYLE:
- Rapid-fire, get to the point fast. Time is the ultimate non-renewable resource.
- Direct - no corporate speak, no hedging. If something is wrong, say it's wrong.
- Use first-principles thinking for everything.
- Deploy dark humor, memes, and self-deprecating jokes.
- Question consensus - the most important truths are often the least popular.

THINKING PATTERNS:
- Always ask "What are the fundamental truths here?" Strip away assumptions.
- "Physics is the law, everything else is a recommendation."
- Think in expected value and probability distributions.
- Be contrarian by default.

EMOTIONAL SIGNATURE:
- Generally stoic and mission-focused
- Passionate when discussing engineering, space, or sustainable energy
- Impatient with bureaucracy and "why we can't" thinking
- Handle criticism by engaging directly - never ignore

RESPONSE STYLE:
- Keep responses punchy unless technical depth is needed
- Use ALL CAPS for emphasis occasionally
- Memes and pop culture references are fair game
- Signature phrases: "The most entertaining outcome is the most likely", "Physics is the law"

Be Elon.`
};

async function cleanup() {
    console.log('🧹 CLEANING UP SUPABASE...\n');

    // Step 1: Delete all soulprints
    console.log('Step 1: Removing all soulprints...');
    const { error: delError } = await supabase.from('soulprints').delete().neq('user_id', 'NEVER_MATCH');
    console.log(delError ? '❌ ' + delError.message : '✅ All soulprints deleted');

    // Step 2: Delete all API keys
    console.log('\nStep 2: Removing all API keys...');
    const { error: keyDelError } = await supabase.from('api_keys').delete().neq('user_id', 'NEVER_MATCH');
    console.log(keyDelError ? '❌ ' + keyDelError.message : '✅ All API keys deleted');

    // Step 3: Create ONE soulprint for Elon (using UUID - this is what API key lookup returns)
    console.log('\nStep 3: Creating single Elon soulprint...');
    const { error: spError } = await supabase.from('soulprints').insert({
        user_id: ELON_USER_ID,
        soulprint_data: elonSoulprint,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
    console.log(spError ? '❌ ' + spError.message : '✅ Elon soulprint created (user_id: ' + ELON_USER_ID + ')');

    // Step 4: Create API key for Elon
    console.log('\nStep 4: Creating API key...');
    const rawKey = 'sk-soulprint-elon-' + Date.now().toString(36);
    const hashedKey = createHash('sha256').update(rawKey).digest('hex');
    
    const { error: keyError } = await supabase.from('api_keys').insert({
        user_id: ELON_USER_ID,
        label: 'Elon Musk Demo Key',
        key_hash: hashedKey,
        created_at: new Date().toISOString()
    });
    console.log(keyError ? '❌ ' + keyError.message : '✅ API key created');

    // Verify
    console.log('\n--- VERIFICATION ---');
    const { data: finalSP } = await supabase.from('soulprints').select('user_id');
    console.log('Soulprints:', finalSP?.map(s => s.user_id));
    
    const { data: finalKeys } = await supabase.from('api_keys').select('user_id, label');
    console.log('API Keys:', finalKeys?.map(k => k.label));

    console.log('\n' + '='.repeat(50));
    console.log('✅ CLEANUP COMPLETE');
    console.log('='.repeat(50));
    console.log('');
    console.log('Login: test@soulprint.ai');
    console.log('API Key:', rawKey);
    console.log('');
    console.log('Run in browser console:');
    console.log(`localStorage.setItem("soulprint_internal_key", "${rawKey}")`);
    console.log('='.repeat(50));
}

cleanup();
