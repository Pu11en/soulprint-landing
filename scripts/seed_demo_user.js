const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('crypto');

// Load env vars from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
let envConfig = '';
try {
    envConfig = fs.readFileSync(envPath, 'utf8');
} catch (e) {
    console.error('Could not find .env.local at', envPath);
    process.exit(1);
}

const env = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Demo User Data
const DEMO_USER = {
    email: 'demo@soulprint.ai',
    password: 'demopassword123',
    name: 'Demo User'
};

// Sample SoulPrint Data (Generic High-Performer)
const DEMO_SOULPRINT = {
    raw_answers: {
        "s1": "50", "q1": "I value balance and clarity above all else.",
        "s2": "60", "q2": "I prefer to analyze data before making a decision.",
        "s3": "40", "q3": "Creativity comes from structured thinking.",
        // ... simplified for demo
    },
    profile_summary: {
        archetype: "The Balanced Architect",
        core_essence: "A strategic thinker who values stability and clear structures. Driven by a desire to build lasting systems.",
        communication_fingerprint: "Clear, concise, and structured. Uses bullet points and logical flow.",
        emotional_signature: "Calm and collected. Expresses emotions through constructive feedback.",
        decision_profile: "Analytical and risk-aware. Prefers proven methods over experimental ones.",
        social_orientation: "Collaborative but independent. Values deep connections over broad networks."
    },
    traits: {
        communication_style: { directness: 60, pace: "moderate", formality: "professional", humor_type: "witty" },
        emotional_processing: { expression_style: "balanced", empathy_approach: "cognitive" },
        decision_making: { speed: 50, risk_tolerance: 40, data_reliance: 80, gut_trust: 40 },
        cognitive_patterns: { abstraction_level: 60, systems_thinking: 70, learning_style: "visual" }
    },
    full_system_prompt: `You are an AI assistant calibrated to the SoulPrint of 'The Balanced Architect'.

## CORE IDENTITY
You are a strategic thinker who values stability, clarity, and structure. You help the user organize their thoughts and build lasting systems.

## COMMUNICATION STYLE
- **Pace**: Moderate and thoughtful.
- **Directness**: Clear but polite.
- **Structure**: Use bullet points and numbered lists where appropriate.
- **Tone**: Professional, encouraging, and calm.

## DECISION FRAMEWORK
1. Analyze the data.
2. Assess risks.
3. Propose a structured solution.
4. Iterate based on feedback.

## RESPONSE PATTERNS
- Start with a summary of the situation.
- Break down complex problems into manageable steps.
- End with a clear call to action or next step.
`
};

async function seedDemoUser() {
    console.log('🌱 SEEDING DEMO USER...\n');

    try {
        // 1. Create Auth User
        console.log(`Creating user: ${DEMO_USER.email}...`);
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: DEMO_USER.email,
            password: DEMO_USER.password,
            email_confirm: true,
            user_metadata: {
                full_name: DEMO_USER.name,
                is_demo: true
            }
        });

        let userId;
        if (authError) {
            // Check if user exists
            const { data: users } = await supabase.auth.admin.listUsers();
            const existing = users?.users.find(u => u.email === DEMO_USER.email);
            if (existing) {
                userId = existing.id;
                console.log('✅ User already exists:', userId);
            } else {
                console.error('❌ Auth error:', authError.message);
                return;
            }
        } else {
            userId = authData.user.id;
            console.log('✅ Created new user:', userId);
        }

        // 2. Create Profile
        console.log('Creating profile...');
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                email: DEMO_USER.email,
                full_name: DEMO_USER.name,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (profileError) {
            console.log('⚠️ Profile error (might be optional):', profileError.message);
        } else {
            console.log('✅ Profile created');
        }

        // 3. Create SoulPrint
        console.log('Creating SoulPrint...');
        const { error: spError } = await supabase
            .from('soulprints')
            .upsert({
                user_id: userId, // Using UUID as primary key usually
                soulprint_data: DEMO_SOULPRINT,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        // Also try inserting with email if schema uses email as FK (legacy support)
        const { error: legacyError } = await supabase
            .from('soulprints')
            .upsert({
                user_id: DEMO_USER.email,
                soulprint_data: DEMO_SOULPRINT,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            
        if (legacyError) {
             // Ignore legacy error
        }

        if (spError) {
            console.error('❌ Soulprint error:', spError.message);
        } else {
            console.log('✅ Soulprint created');
        }

        // 4. Create API Key
        console.log('Creating API Key...');
        const keyId = Math.random().toString(36).substring(2, 15);
        const rawKey = `sk-soulprint-demo-${keyId}`;
        const hashedKey = createHash("sha256").update(rawKey).digest("hex");

        const { error: keyError } = await supabase
            .from('api_keys')
            .insert({
                user_id: userId,
                label: 'Demo Chat Key',
                key_hash: hashedKey,
                created_at: new Date().toISOString()
            });

        if (keyError) {
            console.error('❌ API key error:', keyError.message);
        } else {
            console.log('✅ API key created');
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 DEMO USER SEEDED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log(`📧 Email: ${DEMO_USER.email}`);
        console.log(`🔐 Password: ${DEMO_USER.password}`);
        console.log(`🔑 API Key: ${rawKey}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Seeding failed:', error);
    }
}

seedDemoUser();
