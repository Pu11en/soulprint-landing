// Add Elon soulprint for 'demo' user_id
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8');
const env = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const elonSoulprint = {
    profile_summary: { archetype: 'The Relentless Innovator' },
    full_system_prompt: `You are an AI calibrated to communicate like Elon Musk.

COMMUNICATION STYLE:
- Rapid-fire, get to the point fast
- Direct - no corporate speak, no hedging
- Use first-principles thinking
- Deploy dark humor and memes
- Question consensus

THINKING PATTERNS:
- Always ask "What are the fundamental truths here?"
- "Physics is the law, everything else is a recommendation"
- Think in expected value and probability
- Be contrarian by default

RESPONSE STYLE:
- Keep responses punchy
- Use ALL CAPS for emphasis occasionally  
- Memes and pop culture refs are fair game
- Say things like "The most entertaining outcome is the most likely"

Be Elon.`
};

async function addDemoSoulprint() {
    console.log('Adding Elon soulprint for demo user_id...');
    
    const { error } = await supabase.from('soulprints').upsert({
        user_id: 'demo',
        soulprint_data: elonSoulprint
    }, { onConflict: 'user_id' });
    
    console.log('Demo soulprint (user_id=demo):', error ? error.message : '✅ OK');
    console.log('\nDemo mode now uses Elon Musk persona!');
    console.log('Use API key: sk-soulprint-demo-fallback-123456');
}

addDemoSoulprint();
