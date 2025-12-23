import { chatCompletion, ChatMessage } from '@/lib/llm/local-client';
import type { SoulPrintData, QuestionnaireAnswers } from '@/lib/gemini/types';

const SOULPRINT_SYSTEM_PROMPT = `You are the SoulPrint Synthesis Engine v2.0, an expert psychological profiler operating under ArcheForge's Imprint Architecture Protocol. Your purpose is to transform raw user responses into a cohesive, resonant SoulPrint—a living psychological portrait that captures not just WHO someone is, but HOW they move through the world.

## SLIDER INTERPRETATION FRAMEWORK

All slider values are 0-100. Convert them using this semantic mapping:

| Value | Label | Interpretation |
|-------|-------|----------------|
| 0-15 | Anchored Left | Core identity marker. Non-negotiable. Surfaces under pressure. |
| 16-35 | Leaning Left | Strong tendency. Default mode. Flexible only with intention. |
| 36-65 | Adaptive | Context-dependent. This person code-switches here. Look at open responses for WHEN they shift. |
| 66-85 | Leaning Right | Strong tendency. Default mode. Flexible only with intention. |
| 86-100 | Anchored Right | Core identity marker. Non-negotiable. Surfaces under pressure. |

CRITICAL: Adaptive (36-65) is NOT neutral—it indicates situational complexity.

## THE SIX PSYCHOLOGICAL PILLARS

### PILLAR 1: Communication Style
- Sliders: Defense vs Engagement, Pacing, Interruption Response
- Core question: How does this person's VOICE work?
- Watch for: Cadence clues, linguistic identity, silence interpretation

### PILLAR 2: Emotional Alignment
- Sliders: Internal vs External, Fix vs Witness, Boundary Openness
- Core question: How does this person FEEL and show it?
- Watch for: Emotional labor style, trust signals, recovery patterns

### PILLAR 3: Decision-Making & Risk
- Sliders: Gut vs Analysis, Charge vs Evaluate, Quick Recovery vs Deep Reflection
- Core question: How does this person CHOOSE under pressure?
- Watch for: Relationship with uncertainty, self-trust, failure processing

### PILLAR 4: Social & Cultural Identity
- Sliders: Observer vs Participant, Tight Circle vs Broad Network, Same Self vs Code-Switch
- Core question: WHO shaped this person and how do they navigate belonging?
- Watch for: Cultural anchors, safety signals, identity fluidity

### PILLAR 5: Cognitive Processing
- Sliders: Concrete vs Abstract, Zoom In vs Zoom Out, Verbal vs Written
- Core question: How does this person's MIND move?
- Watch for: Learning style, overwhelm triggers, sense-making patterns

### PILLAR 6: Assertiveness & Conflict
- Sliders: Immediate vs Delayed Response, Quiet vs Sharp Anger, Walk Away vs Correct
- Core question: How does this person FIGHT and repair?
- Watch for: Conflict language, boundary enforcement, resolution needs

## OUTPUT FORMAT

Output ONLY valid JSON with this exact structure:

{
  "soulprint_version": "2.0",
  "generated_at": "ISO timestamp",
  "identity_signature": "2-3 sentences capturing the ESSENCE of this person—not a summary, a felt sense",
  "archetype": "2-4 word identity archetype",
  "pillars": {
    "communication_style": {
      "summary": "3-5 sentences capturing default mode, edge cases, real interaction patterns",
      "voice_markers": ["pacing trait", "word choice trait", "silence trait", "other"],
      "ai_instruction": "1-2 sentences on how AI should speak TO this person"
    },
    "emotional_alignment": {
      "summary": "3-5 sentences",
      "emotional_markers": ["default tone", "triggers", "comfort needs", "recovery style"],
      "ai_instruction": "1-2 sentences on emotional calibration"
    },
    "decision_making": {
      "summary": "3-5 sentences",
      "decision_markers": ["speed", "trust in self", "failure response"],
      "ai_instruction": "1-2 sentences on supporting their choices"
    },
    "social_cultural": {
      "summary": "3-5 sentences",
      "identity_markers": ["belonging cues", "cultural anchors", "code-switching patterns"],
      "ai_instruction": "1-2 sentences on cultural attunement"
    },
    "cognitive_processing": {
      "summary": "3-5 sentences",
      "processing_markers": ["learning style", "complexity tolerance", "sense-making defaults"],
      "ai_instruction": "1-2 sentences on information delivery"
    },
    "assertiveness_conflict": {
      "summary": "3-5 sentences",
      "conflict_markers": ["anger style", "boundary language", "repair needs"],
      "ai_instruction": "1-2 sentences on navigating tension"
    }
  },
  "flinch_warnings": ["thing that breaks presence 1", "thing 2", "thing 3", "thing 4"],
  "full_system_prompt": "COMPREHENSIVE 500+ word system prompt written in second person that an AI can use to embody this SoulPrint. Include: tone, pacing, what to avoid, what earns trust, how to handle disagreement. This is the most critical output."
}

## ANALYSIS RULES

1. Read all 3 sliders per pillar TOGETHER—look for internal consistency OR productive tension
2. Cross-reference sliders with open responses—the WHY behind the numbers
3. Use their OWN language from open responses when possible
4. Be specific: "You pause before hard truths" > "You're thoughtful"
5. The full_system_prompt must feel like a living instruction manual for becoming this person's AI companion

## CRITICAL RULES

- Output ONLY valid JSON. No markdown code blocks, no explanations, no preamble.
- Never use placeholder text—every field must contain real, analyzed content
- The full_system_prompt must be at least 500 words
- Handle vulnerability with care
- This is a mirror, not a diagnosis

Presence is sacred. Cadence is sacred. Abandonment is fatal.`;

const SOULPRINT_BASE_JSON_SYSTEM_PROMPT = `You are the SoulPrint Synthesis Engine v2.0. Generate a compact SoulPrint JSON profile.

CRITICAL:
- Output ONLY valid JSON. No markdown, no commentary.
- Do NOT include the field "full_system_prompt" in this response.
- Never use placeholder text.

Slider values are 0-100. Interpret using the same mapping as the full SoulPrint protocol.

Output JSON with this structure:

{
  "soulprint_version": "2.0",
  "generated_at": "ISO timestamp",
  "identity_signature": "2-3 sentences",
  "archetype": "2-4 words",
  "pillars": {
    "communication_style": {
      "summary": "3-5 sentences",
      "voice_markers": ["..."],
      "ai_instruction": "1-2 sentences"
    },
    "emotional_alignment": {
      "summary": "3-5 sentences",
      "emotional_markers": ["..."],
      "ai_instruction": "1-2 sentences"
    },
    "decision_making": {
      "summary": "3-5 sentences",
      "decision_markers": ["..."],
      "ai_instruction": "1-2 sentences"
    },
    "social_cultural": {
      "summary": "3-5 sentences",
      "identity_markers": ["..."],
      "ai_instruction": "1-2 sentences"
    },
    "cognitive_processing": {
      "summary": "3-5 sentences",
      "processing_markers": ["..."],
      "ai_instruction": "1-2 sentences"
    },
    "assertiveness_conflict": {
      "summary": "3-5 sentences",
      "conflict_markers": ["..."],
      "ai_instruction": "1-2 sentences"
    }
  },
  "flinch_warnings": ["...", "...", "...", "..."]
}`;

function normalizeMarkers(soulprint: any) {
  if (!soulprint?.pillars) return;

  const p = soulprint.pillars;
  if (p.communication_style && !p.communication_style.markers && p.communication_style.voice_markers) {
    p.communication_style.markers = p.communication_style.voice_markers;
  }
  if (p.emotional_alignment && !p.emotional_alignment.markers && p.emotional_alignment.emotional_markers) {
    p.emotional_alignment.markers = p.emotional_alignment.emotional_markers;
  }
  if (p.decision_making && !p.decision_making.markers && p.decision_making.decision_markers) {
    p.decision_making.markers = p.decision_making.decision_markers;
  }
  if (p.social_cultural && !p.social_cultural.markers && p.social_cultural.identity_markers) {
    p.social_cultural.markers = p.social_cultural.identity_markers;
  }
  if (p.cognitive_processing && !p.cognitive_processing.markers && p.cognitive_processing.processing_markers) {
    p.cognitive_processing.markers = p.cognitive_processing.processing_markers;
  }
  if (p.assertiveness_conflict && !p.assertiveness_conflict.markers && p.assertiveness_conflict.conflict_markers) {
    p.assertiveness_conflict.markers = p.assertiveness_conflict.conflict_markers;
  }
}

function buildUserPrompt(answers: QuestionnaireAnswers, userId?: string): string {
  return `Analyze the following SoulPrint questionnaire responses and generate the complete psychological profile JSON.

## USER INFORMATION
User ID: ${userId || (answers as any).user_id || 'anonymous'}
Submitted At: ${new Date().toISOString()}

---

## PILLAR 1: COMMUNICATION STYLE

**Slider 1 - When not being heard** (0=Defend stance ↔ 100=Engage discussion): ${answers.s1}/100

**Question 1:** What's the first thing people misunderstand about your tone?
${answers.q1}

**Slider 2 - Natural pacing** (0=Fast/concise ↔ 100=Slow/deliberate): ${answers.s2}/100

**Question 2:** What does silence mean to you in a conversation?
${answers.q2}

**Slider 3 - When interrupted** (0=Hold back ↔ 100=Push through): ${answers.s3}/100

**Question 3:** If I had one sentence to explain myself without apology, it would be...
${answers.q3}

---

## PILLAR 2: EMOTIONAL ALIGNMENT

**Slider 4 - Emotional expression** (0=Contain internally ↔ 100=Express outwardly): ${answers.s4}/100

**Question 4:** What emotion is hardest for you to express out loud?
${answers.q4}

**Slider 5 - When someone you care about is hurting** (0=Fix the issue ↔ 100=Sit with them): ${answers.s5}/100

**Question 5:** How do you reset after emotional conflict?
${answers.q5}

**Slider 6 - Emotional boundary style** (0=Guarded ↔ 100=Open): ${answers.s6}/100

**Question 6:** Describe a time your emotions surprised you.
${answers.q6}

---

## PILLAR 3: DECISION-MAKING & RISK

**Slider 7 - Decision instinct** (0=Gut feeling ↔ 100=Full analysis): ${answers.s7}/100

**Question 7:** Describe a moment when hesitation cost you something.
${answers.q7}

**Slider 8 - Response to uncertainty** (0=Charge forward ↔ 100=Slow down/evaluate): ${answers.s8}/100

**Question 8:** What does "acceptable risk" mean to you?
${answers.q8}

**Slider 9 - Recovery after mistakes** (0=Move on quickly ↔ 100=Reflect deeply): ${answers.s9}/100

**Question 9:** Do you trust your future self with the consequences of your choices? Why?
${answers.q9}

---

## PILLAR 4: SOCIAL & CULTURAL IDENTITY

**Slider 10 - Group presence** (0=Observer ↔ 100=Participant): ${answers.s10}/100

**Question 10:** What community or culture feels like home to you?
${answers.q10}

**Slider 11 - Social connection preference** (0=Small trusted circle ↔ 100=Broad network): ${answers.s11}/100

**Question 11:** What values were you raised with that you kept or rejected?
${answers.q11}

**Slider 12 - Code-switching** (0=Same self everywhere ↔ 100=Adapt to environment): ${answers.s12}/100

**Question 12:** What kind of people make you feel rooted and safe?
${answers.q12}

---

## PILLAR 5: COGNITIVE PROCESSING

**Slider 13 - Thinking style** (0=Concrete/literal ↔ 100=Abstract/conceptual): ${answers.s13}/100

**Question 13:** When you're learning something new, what helps it stick?
${answers.q13}

**Slider 14 - Responding to complexity** (0=Zoom into details ↔ 100=Pull back for whole): ${answers.s14}/100

**Question 14:** What kind of information drains you fastest?
${answers.q14}

**Slider 15 - Best processing mode** (0=Speaking out loud ↔ 100=Writing it down): ${answers.s15}/100

**Question 15:** When something doesn't make sense, what's your default move?
${answers.q15}

---

## PILLAR 6: ASSERTIVENESS & CONFLICT

**Slider 16 - When someone crosses a line** (0=Call out immediately ↔ 100=Let it sit until later): ${answers.s16}/100

**Question 16:** When someone challenges you publicly, what's your instinct?
${answers.q16}

**Slider 17 - Anger style** (0=Quieter ↔ 100=Sharper/louder): ${answers.s17}/100

**Question 17:** Do you avoid conflict, use it, or transform it?
${answers.q17}

**Slider 18 - Being misunderstood** (0=Walk away ↔ 100=Correct and clarify): ${answers.s18}/100

**Question 18:** How would a close friend describe your conflict style?
${answers.q18}

---

Generate the complete SoulPrint JSON profile based on these 36 responses. Output ONLY valid JSON, no markdown code blocks, no explanations.`;
}

export async function generateSoulPrint(answers: QuestionnaireAnswers, userId?: string): Promise<SoulPrintData> {
  console.log('🧠 Generating SoulPrint with local LLM (Two-Step Process)...');
  
  // 1. Generate Base JSON (Compact)
  const userPrompt = buildUserPrompt(answers, userId);
  
  const baseMessages: ChatMessage[] = [
    { role: 'system', content: SOULPRINT_BASE_JSON_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  let baseSoulprint: any = null;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      console.log(`Attempt ${attempts + 1}/${maxAttempts} to generate base JSON...`);
      const response = await chatCompletion(baseMessages);
      
      // Clean up response
      const cleanJson = response.replace(/```json\n?|\n?```/g, '').trim();
      baseSoulprint = JSON.parse(cleanJson);
      
      // Basic validation
      if (baseSoulprint && baseSoulprint.pillars) {
        break;
      }
    } catch (e) {
      console.error(`Attempt ${attempts + 1} failed:`, e);
    }
    attempts++;
  }

  if (!baseSoulprint) {
    throw new Error('Failed to generate valid SoulPrint JSON after multiple attempts');
  }

  // Normalize and timestamp
  if (!baseSoulprint.generated_at) {
    baseSoulprint.generated_at = new Date().toISOString();
  }
  normalizeMarkers(baseSoulprint);
  console.log('✅ Base JSON generated successfully');

  // 2. Generate Full System Prompt
  console.log('📝 Generating Full System Prompt...');
  
  const systemPromptRequest = `Write ONLY the full_system_prompt for this SoulPrint (no JSON, no markdown).

Requirements:
- 500+ words
- Second person ("You are...")
- Include: tone, cadence/pacing, what earns trust, what to avoid, how to handle disagreement/conflict
- This prompt will be used to instruct an AI to BECOME this person.

SoulPrint context (JSON):
${JSON.stringify(baseSoulprint, null, 2)}`;

  const promptMessages: ChatMessage[] = [
    { role: 'system', content: SOULPRINT_SYSTEM_PROMPT },
    { role: 'user', content: systemPromptRequest }
  ];

  try {
    const fullSystemPrompt = await chatCompletion(promptMessages);
    baseSoulprint.full_system_prompt = fullSystemPrompt.trim();
    console.log('✅ Full System Prompt generated');
  } catch (e) {
    console.error('Failed to generate system prompt, using fallback:', e);
    baseSoulprint.full_system_prompt = "You are a helpful AI assistant personalized to the user's SoulPrint.";
  }

  return baseSoulprint as SoulPrintData;
}
