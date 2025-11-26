// Simple script to create soulprint data for demo user using client-side approach
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wcgbwzznadrrllfoojap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2J3enpuYWRycmxsZm9vamFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTYzNzAsImV4cCI6MjA3OTY5MjM3MH0.WFl5YKVQhJhbL6fjhu8X7U6RkhOM3A8oTIb_lw4cDuw';

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function createDemoSoulprint() {
    console.log('Creating demo soulprint data...');

    try {
        // Create soulprint for user_id 'test' (demo mode compatibility)
        const { error: testError } = await supabase
            .from('soulprints')
            .upsert({
                user_id: 'test',
                soulprint_data: demoSoulprintData
            }, { onConflict: 'user_id' });

        if (testError) {
            console.error('Error creating test soulprint:', testError);
        } else {
            console.log('✅ Created soulprint for user_id: test');
        }

        // Also try to create for authenticated demo user if possible
        console.log('Note: When you sign in as test@soulprint.ai, the chat page will automatically create soulprint data for your account.');

    } catch (error) {
        console.error('Setup error:', error.message);
    }

    console.log('\nDemo soulprint setup completed!');
    console.log('The chat system should now work properly with demo personality data.');
}

createDemoSoulprint();