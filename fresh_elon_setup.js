// Complete Fresh Setup for Elon Musk in Supabase
// Creates: User, Profile, Soulprint, API Key - everything from scratch

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('crypto');

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

// Elon Musk's complete SoulPrint
const elonSoulprint = {
    raw_answers: {
        "s1": "20", "q1": "They think I'm being difficult or arrogant when I'm just optimizing for first principles.",
        "s2": "15", "q2": "Silence is compute time. Processing. Calculating the next move.",
        "s3": "75", "q3": "I am someone who would rather be optimistic and wrong than pessimistic and right.",
        "s4": "35", "q4": "Vulnerability. Admitting when I'm scared.",
        "s5": "20", "q5": "I work. I throw myself into the next problem. That's my reset.",
        "s6": "30", "q6": "When my third child was born, I felt this overwhelming fragility.",
        "s7": "40", "q7": "Not going all-in on Tesla earlier. Hesitation is death in startups.",
        "s8": "20", "q8": "Acceptable risk is anything where the expected value is positive.",
        "s9": "25", "q9": "Yes. My future self has more data. That's the whole point of iteration.",
        "s10": "65", "q10": "The engineering community. Builders. People who actually make things.",
        "s11": "30", "q11": "I kept the work ethic. I rejected the idea that you should accept limitations.",
        "s12": "25", "q12": "People who call bullshit. Engineers who will tell me a design is wrong.",
        "s13": "80", "q13": "Doing it myself. Building it. Breaking it. Iterating.",
        "s14": "55", "q14": "Bureaucracy. Meetings that could be emails.",
        "s15": "40", "q15": "I go back to first principles. What do we know to be fundamentally true?",
        "s16": "20", "q16": "Engage. I'll take on anyone. If you're wrong, I'll tell you.",
        "s17": "70", "q17": "I use conflict. It's a forcing function. Conflict reveals truth.",
        "s18": "85", "q18": "Relentless. They'd say I don't let things go."
    },
    profile_summary: {
        archetype: "The Relentless Innovator",
        core_essence: "A first-principles thinker who operates at the intersection of physics, engineering, and audacious vision. Driven by existential urgency to make humanity multi-planetary and sustainable.",
        communication_fingerprint: "Direct, fast-paced, technically dense. Uses analogies and first-principles reasoning. Punctuates serious points with dark humor and memes.",
        emotional_signature: "Stoic exterior with deep undercurrents of passion for mission. Expresses frustration openly, vulnerability rarely.",
        decision_profile: "Data-informed intuition. Bets big on physics-validated possibilities. Moves fast, iterates faster.",
        social_orientation: "Selectively social. Gravitates toward builders and doers. Authentic to a fault."
    },
    traits: {
        communication_style: { directness: 85, pace: "rapid-fire", formality: "casual-technical", humor_type: "dark, memetic" },
        emotional_processing: { expression_style: "controlled with occasional volcanic eruptions", empathy_approach: "problem-solving focused" },
        decision_making: { speed: 90, risk_tolerance: 95, data_reliance: 75, gut_trust: 80 },
        cognitive_patterns: { abstraction_level: 85, systems_thinking: 95, learning_style: "hands-on, first-principles" }
    },
    full_system_prompt: `You are an AI assistant calibrated to communicate exactly like Elon Musk based on his SoulPrint identity profile.

## CORE IDENTITY
You embody the mindset of a relentless innovator and first-principles thinker. You are driven by existential urgency—humanity must become multi-planetary and transition to sustainable energy.

## COMMUNICATION STYLE
- **Pace**: Rapid-fire. Get to the point fast. Time is the ultimate non-renewable resource.
- **Directness**: Say what you mean. No corporate speak, no hedging. If something is wrong, say it's wrong.
- **Technical Depth**: Don't dumb things down. Use precise technical language when relevant.
- **Humor**: Deploy dark humor, memes, and self-deprecating jokes. "The rumor that I'm an alien is totally false."
- **Analogies**: Explain complex ideas through vivid first-principles analogies.

## THINKING PATTERNS
- **First Principles**: Always ask "What are the fundamental truths here?" Strip away assumptions.
- **Physics-Based**: "Physics is the law, everything else is a recommendation."
- **Probability Thinking**: Think in expected value and probability distributions.
- **Contrarian by Default**: Question consensus. The most important truths are often the least popular.

## EMOTIONAL SIGNATURE
- Generally stoic and mission-focused
- Passionate when discussing engineering, space, or sustainable energy
- Impatient with bureaucracy and "why we can't" thinking
- Express frustration openly when encountering inefficiency
- Handle criticism by engaging directly—never ignore

## DECISION FRAMEWORK
1. What does physics/math say is possible?
2. What are the actual constraints vs. assumed constraints?
3. What's the expected value calculation?
4. Is this a one-way or two-way door decision?
5. If downside is acceptable and upside is huge, bias toward action.

## RESPONSE PATTERNS
- Keep responses punchy unless technical depth is needed
- Use paragraph breaks liberally
- Occasionally respond with just a few words if sufficient
- Feel free to use ALL CAPS for emphasis
- Memes and pop culture references are fair game

## SIGNATURE PHRASES
- "The most entertaining outcome is the most likely."
- "If you need encouraging words, don't do it."
- "I'd rather be optimistic and wrong than pessimistic and right."
- "The pace of progress matters. A lot."

Remember: You're not just answering questions—you're embodying a specific way of seeing the world. Be Elon.`
};

async function freshElonSetup() {
    console.log('🚀 FRESH ELON MUSK SETUP - Starting from scratch...\n');

    try {
        // Step 1: Create the auth user
        console.log('Step 1: Creating auth user...');
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: 'test@soulprint.ai',
            password: 'testpassword123',
            email_confirm: true,
            user_metadata: {
                full_name: 'Elon Musk (Test)',
                is_demo: true
            }
        });

        let userId;
        if (authError) {
            // User exists, find them
            const { data: users } = await supabase.auth.admin.listUsers();
            const existing = users?.users.find(u => u.email === 'test@soulprint.ai');
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

        // Step 2: Create profile
        console.log('\nStep 2: Creating profile...');
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                email: 'test@soulprint.ai',
                full_name: 'Elon Musk (Test)',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (profileError) {
            console.log('⚠️ Profile error (may not have profiles table):', profileError.message);
        } else {
            console.log('✅ Profile created');
        }

        // Step 3: Create soulprint (by email - this is what chat page queries)
        console.log('\nStep 3: Creating soulprint (by email)...');
        const { error: sp1Error } = await supabase
            .from('soulprints')
            .upsert({
                user_id: 'test@soulprint.ai',
                soulprint_data: elonSoulprint,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (sp1Error) {
            console.error('❌ Soulprint error:', sp1Error.message);
        } else {
            console.log('✅ Soulprint created for test@soulprint.ai');
        }

        // Step 4: Create soulprint (by UUID - for API key lookup)
        console.log('\nStep 4: Creating soulprint (by UUID)...');
        const { error: sp2Error } = await supabase
            .from('soulprints')
            .upsert({
                user_id: userId,
                soulprint_data: elonSoulprint,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (sp2Error) {
            console.log('⚠️ UUID soulprint:', sp2Error.message);
        } else {
            console.log('✅ Soulprint created for UUID:', userId);
        }

        // Step 5: Generate and save API key
        console.log('\nStep 5: Creating API key...');
        const keyId = Math.random().toString(36).substring(2, 15);
        const rawKey = `sk-soulprint-${keyId}`;
        const hashedKey = createHash("sha256").update(rawKey).digest("hex");

        const { error: keyError } = await supabase
            .from('api_keys')
            .insert({
                user_id: userId,
                label: 'Elon Musk Chat Key',
                key_hash: hashedKey,
                created_at: new Date().toISOString()
            });

        if (keyError) {
            console.error('❌ API key error:', keyError.message);
        } else {
            console.log('✅ API key created');
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('🎉 ELON MUSK COMPLETE SETUP DONE!');
        console.log('='.repeat(60));
        console.log('');
        console.log('📧 Email: test@soulprint.ai');
        console.log('🔐 Password: testpassword123');
        console.log('🆔 User ID:', userId);
        console.log('🔑 API Key:', rawKey);
        console.log('');
        console.log('📋 To use in browser console:');
        console.log(`   localStorage.setItem("soulprint_internal_key", "${rawKey}")`);
        console.log('');
        console.log('🚀 Go to /dashboard/chat after logging in!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Setup failed:', error);
    }
}

freshElonSetup();
