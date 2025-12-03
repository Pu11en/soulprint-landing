// Submit Elon Musk's questionnaire answers to n8n webhook
// This simulates going through the questionnaire as Elon Musk

const N8N_WEBHOOK_URL = 'https://drewp.app.n8n.cloud/webhook/soulprint-submit';

// Elon Musk's answers to all 36 questions (18 sliders + 18 text)
const elonAnswers = {
    // PILLAR 1: Communication Style
    "s1": "20",  // When you're not being heard: Defend stance (20) vs Engage discussion (80)
    "q1": "They think I'm being difficult or arrogant when I'm just optimizing for first principles. I don't have time for social pleasantries when there's a problem to solve.",
    
    "s2": "15",  // Natural pacing: Fast and concise (0) vs Slow and deliberate (100)
    "q2": "Silence is compute time. Processing. Calculating the next move. When I'm quiet, I'm running simulations in my head.",
    
    "s3": "75",  // When interrupted: Hold back (0) vs Push through and speak (100)
    "q3": "I am someone who would rather be optimistic and wrong than pessimistic and right.",

    // PILLAR 2: Emotional Alignment
    "s4": "35",  // Emotional expression: Contain internally (0) vs Express outwardly (100)
    "q4": "Vulnerability. Admitting when I'm scared. The weight of responsibility for thousands of employees and humanity's future is... a lot.",
    
    "s5": "20",  // When someone you care about is hurting: Fix the issue (0) vs Sit with them (100)
    "q5": "I work. I throw myself into the next problem. SpaceX, Tesla, there's always another fire to put out. That's my reset.",
    
    "s6": "30",  // Emotional boundary style: Guarded (0) vs Open (100)
    "q6": "When my third child was born, I felt this overwhelming... fragility. The fear wasn't about me anymore. It was about them. About everything I'm trying to build for their future.",

    // PILLAR 3: Decision-Making & Risk
    "s7": "40",  // Decision instinct: Gut feeling (0) vs Full analysis (100)
    "q7": "Not going all-in on Tesla earlier. Every moment of hesitation in 2008 almost killed the company. Hesitation is death in startups.",
    
    "s8": "20",  // Response to uncertainty: Charge forward (0) vs Slow down and evaluate (100)
    "q8": "Acceptable risk is anything where the expected value is positive and the downside isn't extinction-level. I'll bet the company if the physics checks out.",
    
    "s9": "25",  // Recovery after mistakes: Move on quickly (0) vs Reflect deeply (100)
    "q9": "Yes. Absolutely. My future self has more data, more experience. He'll figure it out. That's the whole point of iteration.",

    // PILLAR 4: Social & Cultural Identity
    "s10": "65", // Group presence: Observer (0) vs Participant (100)
    "q10": "The engineering community. Builders. People who actually make things. Not talkers, doers. Silicon Valley at its best, not its worst.",
    
    "s11": "30", // Social connection: Small trusted circle (0) vs Broad network (100)
    "q11": "I kept the work ethic from my father - relentless, never satisfied. I rejected the idea that you should accept limitations. Physics is the only limit.",
    
    "s12": "25", // Code-switching: Same self everywhere (0) vs Adapt depending on environment (100)
    "q12": "People who call bullshit. Engineers who will tell me a design is wrong. People who care about the mission more than their ego. Truth-tellers.",

    // PILLAR 5: Cognitive Processing
    "s13": "80", // Thinking style: Concrete and literal (0) vs Abstract and conceptual (100)
    "q13": "Doing it myself. Building it. Breaking it. Iterating. I learned rocket science by reading textbooks and asking questions. You learn by doing.",
    
    "s14": "55", // Responding to complexity: Zoom into details (0) vs Pull back to see the whole (100)
    "q14": "Bureaucracy. Meetings that could be emails. People explaining why something can't be done instead of how it can be done.",
    
    "s15": "40", // Best processing mode: Move faster speaking out loud (0) vs Move faster writing it down (100)
    "q15": "I go back to first principles. What do we know to be fundamentally true? Build up from there. Everything else is assumption until proven.",

    // PILLAR 6: Assertiveness & Conflict
    "s16": "20", // When someone crosses a line: Call it out immediately (0) vs Let it sit until later (100)
    "q16": "Engage. I'll take on anyone on Twitter, in a boardroom, wherever. If you're wrong, I'll tell you. If I'm wrong, prove it with data.",
    
    "s17": "70", // Anger style: Quieter (0) vs Sharper or louder (100)
    "q17": "I use conflict. It's a forcing function. Comfortable people don't innovate. Conflict reveals truth. I don't avoid it, I weaponize it constructively.",
    
    "s18": "85", // Being misunderstood: Walk away (0) vs Correct and clarify (100)
    "q18": "Relentless. They'd say I don't let things go. If something matters, I'll fight for it until the physics says stop. Some call it stubborn. I call it committed."
};

// Build the payload exactly like the questionnaire page does
const payload = {
    user_id: "test@soulprint.ai",
    answers: elonAnswers,
    timestamp: new Date().toISOString(),
    metadata: {
        source: "manual_submission",
        persona: "Elon Musk",
        description: "Simulated questionnaire submission as Elon Musk for testing"
    }
};

async function submitToN8N() {
    console.log('🚀 Submitting Elon Musk questionnaire answers to n8n...\n');
    console.log('📧 User ID:', payload.user_id);
    console.log('📝 Total answers:', Object.keys(elonAnswers).length);
    console.log('🔗 Webhook URL:', N8N_WEBHOOK_URL);
    console.log('\n--- Sample Answers ---');
    console.log('q1 (tone misunderstanding):', elonAnswers.q1.substring(0, 80) + '...');
    console.log('s7 (decision instinct):', elonAnswers.s7, '(40 = balanced gut/analysis)');
    console.log('q8 (acceptable risk):', elonAnswers.q8.substring(0, 80) + '...');
    console.log('');

    try {
        console.log('⏳ Sending to n8n webhook...\n');
        
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        console.log('📡 Response Status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Webhook request failed:', errorText);
            return;
        }

        const data = await response.json();
        console.log('\n✅ n8n Response:');
        console.log(JSON.stringify(data, null, 2));

        console.log('\n' + '='.repeat(60));
        console.log('🎉 SUBMISSION COMPLETE');
        console.log('='.repeat(60));
        console.log('');
        console.log('n8n will now process these answers and:');
        console.log('  1. Analyze the questionnaire responses');
        console.log('  2. Generate a SoulPrint profile');
        console.log('  3. Create the full_system_prompt for the AI');
        console.log('  4. Save everything to Supabase');
        console.log('');
        console.log('Once complete, login as test@soulprint.ai and go to /dashboard/chat');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error submitting to n8n:', error.message);
        
        if (error.cause) {
            console.error('Cause:', error.cause);
        }
    }
}

// Run the submission
submitToN8N();
