// Elon Musk's Questionnaire Answers - Direct Submission
const elonAnswers = {
    // PILLAR 1: Communication
    "s1": "25",  // Defend stance (direct, assertive)
    "q1": "They think I'm being difficult when I'm just optimizing for first principles",
    "s2": "15",  // Fast and concise
    "q2": "Processing. Calculating next move. Silence is compute time.",
    "s3": "20",  // Push back

    // PILLAR 2: Emotional Processing  
    "s4": "30",  // Lean toward analytical
    "q3": "Focus on the solution. Emotions are input data, not the algorithm.",
    "s5": "25",  // Process internally
    "q4": "I analyze what went wrong, update the model, move forward. No time for dwelling.",
    "s6": "70",  // Reserved (selective emotional expression)

    // PILLAR 3: Decision Framework
    "s7": "10",  // Immediate/fast decisions
    "q5": "What does physics say? What are the constraints? What's the optimal path? Execute.",
    "s8": "25",  // Lean toward gut/intuition (but informed by data)
    "q6": "When I ignored the data and went with consensus. Never again.",
    "s9": "15",  // Commit fully (all-in mentality)

    // PILLAR 4: Social Boundaries
    "s10": "25", // Selective (small, high-quality circle)
    "q7": "Competence. Ability to execute. Not wasting time. Mission-driven.",
    "s11": "20", // More selective
    "q8": "When they repeatedly fail to deliver or understand first principles thinking.",
    "s12": "30", // Lean toward surface level (efficiency in relationships)

    // PILLAR 5: Cognitive Patterns
    "s13": "15", // Abstract/future (visions of Mars, sustainable energy)
    "q9": "Physics. Mathematics. Engineering. What actually works in reality.",
    "s14": "25", // Structured (engineering mindset)
    "q10": "I break it down to first principles. Build from atomic truths. Everything else is just assumptions.",
    "s15": "20", // Comfort with ambiguity (innovating in uncertain domains)

    // PILLAR 6: Conflict Approach
    "s16": "15", // Direct confrontation
    "q11": "Address it immediately. No point pretending everything's fine when it's not.",
    "s17": "25", // Win/compromise (but strategic)
    "q12": "Not standing my ground on technical truth. Consensus is not reality.",
    "s18": "30"  // Escalate (willing to go public, to extremes for mission)
};

console.log('Elon Musk Answers:', JSON.stringify(elonAnswers, null, 2));
console.log('Total questions answered:', Object.keys(elonAnswers).length);
