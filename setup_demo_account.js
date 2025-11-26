const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('crypto');

// Load env vars manually
const envPath = path.resolve(__dirname, '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8');
const env = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Comprehensive demo soulprint data
const demoSoulprintData = {
    communication_style: {
        formality: "casual",
        directness: "direct",
        humor: "moderate",
        tone: "friendly",
        listening_style: "attentive"
    },
    decision_making: {
        approach: "analytical",
        speed: "balanced",
        collaboration: "high",
        risk_tolerance: "moderate",
        data_driven: true
    },
    values: ["innovation", "authenticity", "growth", "collaboration", "creativity"],
    work_style: {
        environment: "collaborative",
        pace: "steady",
        structure: "flexible",
        leadership_style: "supportive",
        conflict_resolution: "constructive"
    },
    personality_traits: {
        openness: "high",
        conscientiousness: "moderate",
        extraversion: "balanced",
        agreeableness: "high",
        neuroticism: "low",
        creativity: "high",
        adaptability: "high"
    },
    interests: ["technology", "learning", "problem_solving", "innovation", "mentoring"],
    communication_preferences: {
        written: "detailed",
        verbal: "collaborative",
        feedback: "constructive",
        meeting_style: "interactive"
    },
    emotional_intelligence: {
        self_awareness: "high",
        empathy: "high",
        social_skills: "strong",
        stress_management: "balanced"
    },
    learning_style: {
        preferred_method: "hands_on",
        pace: "continuous",
        knowledge_sharing: "active"
    }
};

async function generateApiKey(userId) {
    // Generate a unique API key
    const keyId = Math.random().toString(36).substring(2, 15);
    const rawKey = `sk-soulprint-${keyId}`;
    const hashedKey = createHash("sha256").update(rawKey).digest("hex");

    return { rawKey, hashedKey };
}

async function setupDemoAccount() {
    console.log('Setting up demo account for test@soulprint.ai...');

    try {
        // Step 1: Create or find the demo user
        console.log('Step 1: Creating demo user...');

        // Try to create the user first
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: 'test@soulprint.ai',
            email_confirm: true,
            user_metadata: {
                full_name: 'Demo User',
                is_demo: true
            }
        });

        let userId;

        if (authError && !authError.message.includes('already registered')) {
            console.error('Error creating user:', authError.message);

            // If user already exists, try to find them
            const { data: users } = await supabase.auth.admin.listUsers();
            const existingUser = users?.users.find(u => u.email === 'test@soulprint.ai');

            if (!existingUser) {
                console.error('Could not find or create demo user');
                return;
            }

            userId = existingUser.id;
            console.log('Found existing demo user:', userId);
        } else {
            userId = authData.user.id;
            console.log('Created new demo user:', userId);
        }

        // Step 2: Create/update profile
        console.log('Step 2: Setting up profile...');
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                email: 'test@soulprint.ai',
                full_name: 'Demo User',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (profileError) {
            console.error('Error creating profile:', profileError.message);
        } else {
            console.log('Profile created successfully');
        }

        // Step 3: Insert soulprint data
        console.log('Step 3: Creating soulprint data...');
        const { error: soulprintError } = await supabase
            .from('soulprints')
            .upsert({
                user_id: userId,
                soulprint_data: demoSoulprintData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (soulprintError) {
            console.error('Error creating soulprint:', soulprintError.message);
        } else {
            console.log('Soulprint created successfully');
        }

        // Step 4: Also create a soulprint with user_id 'test' for demo mode compatibility
        console.log('Step 4: Creating soulprint for demo mode (user_id: test)...');
        const { error: demoSoulprintError } = await supabase
            .from('soulprints')
            .upsert({
                user_id: 'test', // For demo mode compatibility
                soulprint_data: demoSoulprintData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (demoSoulprintError) {
            console.error('Error creating demo soulprint:', demoSoulprintError.message);
        } else {
            console.log('Demo soulprint created successfully');
        }

        // Step 5: Generate API key for testing
        console.log('Step 5: Generating API key...');
        const { rawKey, hashedKey } = await generateApiKey(userId);

        const { error: apiKeyError } = await supabase
            .from('api_keys')
            .insert({
                user_id: userId,
                label: 'Demo API Key',
                key_hash: hashedKey,
                created_at: new Date().toISOString()
            });

        if (apiKeyError) {
            console.error('Error creating API key:', apiKeyError.message);
        } else {
            console.log('API key created successfully');
            console.log('\n=== DEMO ACCOUNT SETUP COMPLETE ===');
            console.log('Email:', 'test@soulprint.ai');
            console.log('User ID:', userId);
            console.log('API Key:', rawKey);
            console.log('=====================================\n');
        }

        console.log('Demo account setup completed successfully!');

    } catch (error) {
        console.error('Setup error:', error.message);
    }
}

// Run the setup
setupDemoAccount();