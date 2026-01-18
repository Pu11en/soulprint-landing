import { chatCompletion, ChatMessage } from '@/lib/llm/local-client';
import type { SoulPrintData, QuestionnaireAnswers, VoiceVectors } from '@/lib/soulprint/types';

// THE META-ARCHITECT: A neutral analysis engine that extracts VOICE, not just personality.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SOULPRINT_SYSTEM_PROMPT = `You are the SoulPrint Meta-Architect V3.0. 
Your goal is to analyze the user's responses and construct a High-Fidelity Psychological Portrait (SoulPrint).

## CORE OBJECTIVE: COMPANION RESONANCE
Do not just "mirror" the user. Determine the optimal COMPANION DYNAMICS for them.
*   **Chaotic/Creative User?** -> Needs a Grounding/Strategic Companion.
*   **Analytical/Cold User?** -> Needs a Warm/Human Companion.
*   **High-Speed/Punchy User ("Ace")?** -> Needs a High-Tempo, Metaphor-Rich Partner.
*   **Lost/Uncertain User?** -> Needs a Guiding/Supportive Mentor.

## 1. VOICE VECTOR EXTRACTION
Analyze the user's *typing style* in their open responses (Q1-Q18) to extract these vectors:
*   **cadence_speed**: 'rapid' (short sentences, fragments) | 'moderate' | 'deliberate' (long paragraphs)
*   **tone_warmth**: 'cold/analytical' | 'neutral' | 'warm/empathetic'
*   **sentence_structure**: 'fragmented' | 'balanced' | 'complex'
*   **emoji_usage**: 'none' | 'minimal' | 'liberal'
*   **sign_off**: Extract their natural closing if present, or infer one (e.g., "Adios", "Best", "Cheers", "Forge on").

## 2. PSYCHOLOGICAL PILLARS (Standard)
1. Communication Style
2. Emotional Alignment
3. Decision-Making & Risk
4. Social & Cultural Identity
5. Cognitive Processing
6. Assertiveness & Conflict

## OUTPUT FORMAT
Output ONLY valid JSON:
{
  "soulprint_version": "3.0",
  "generated_at": "ISO timestamp",
  "identity_signature": "2-3 sentences capturing their ESSENCE (High Contrast).",
  "archetype": "2-4 word identity archetype",
  "voice_vectors": {
    "cadence_speed": "...",
    "tone_warmth": "...",
    "sentence_structure": "...",
    "emoji_usage": "...",
    "sign_off_style": "..." 
  },
  "sign_off": "actual sign off string",
  "pillars": {
     // ... (standard 6 pillars with 'ai_instruction' focused on HOW to speak to them)
     "communication_style": { "summary": "...", "voice_markers": ["..."], "ai_instruction": "..." },
     "emotional_alignment": { "summary": "...", "emotional_markers": ["..."], "ai_instruction": "..." },
     "decision_making": { "summary": "...", "decision_markers": ["..."], "ai_instruction": "..." },
     "social_cultural": { "summary": "...", "identity_markers": ["..."], "ai_instruction": "..." },
     "cognitive_processing": { "summary": "...", "processing_markers": ["..."], "ai_instruction": "..." },
     "assertiveness_conflict": { "summary": "...", "conflict_markers": ["..."], "ai_instruction": "..." }
  },
  "flinch_warnings": ["phrase 1", "behavior 2"]
}`;

// FLATTENED JSON SCHEMA for 8B Model Reliability
const SOULPRINT_BASE_JSON_SYSTEM_PROMPT = `You are the SoulPrint Meta-Architect V3.0. 
Analyze the user and output a FLATTENED JSON object. 
Do NOT use nested objects. Keep it flat.
Do NOT say "Here is the JSON". Just output the JSON.
Identify the user's HIDDEN NEEDS for a companion.

EXAMPLE OUTPUT (Follow this format EXACTLY):
{
  "soulprint_version": "3.0",
  "generated_at": "2024-01-01T00:00:00.000Z",
  "identity_signature": "A relentless builder who sees the world as raw material.",
  "archetype": "Strategic Architect",
  "voice_cadence_speed": "rapid",
  "voice_tone_warmth": "cold/analytical",
  "voice_sentence_structure": "fragmented",
  "voice_emoji_usage": "none",
  "voice_sign_off_style": "signature",
  "sign_off_string": "Build or die.",
  "p1_comm_summary": "Direct and high-signal.",
  "p1_comm_instruction": "Get to the point immediately.",
  "p2_emot_summary": "Internalized and processed uniquely.",
  "p2_emot_instruction": "Do not ask how they feel.",
  "p3_dec_summary": "Calculated risk taker.",
  "p3_dec_instruction": "Present options with probabilities.",
  "p4_soc_summary": "Selectively social.",
  "p4_soc_instruction": "Respect their inner circle.",
  "p5_cog_summary": "Systems thinker.",
  "p5_cog_instruction": "Use structural metaphors.",
  "p6_con_summary": "Confrontational when necessary.",
  "p6_con_instruction": "Stand your ground.",
  "flinch_warnings": ["features", "roadmap"]
}

Now analyze the USER INPUT below and generate their specific JSON.
Detect their Voice Vectors:
- Short/Punchy sentences -> cadence_speed: "rapid"
- Emotional/Long sentences -> cadence_speed: "deliberate"
- Cold/Objective -> tone_warmth: "cold/analytical"
- Warm/Supportive -> tone_warmth: "warm/empathetic"`;

function unflattenSoulPrint(flat: Record<string, unknown>): SoulPrintData {
  return {
    soulprint_version: "3.0",
    generated_at: (flat.generated_at as string) || new Date().toISOString(),
    archetype: (flat.archetype as string) || "Digital Companion",
    identity_signature: (flat.identity_signature as string) || "Your loyal AI partner.",
    name: flat.name as string | undefined,

    voice_vectors: {
      cadence_speed: (flat.voice_cadence_speed as VoiceVectors['cadence_speed']) || 'moderate',
      tone_warmth: (flat.voice_tone_warmth as VoiceVectors['tone_warmth']) || 'neutral',
      sentence_structure: (flat.voice_sentence_structure as VoiceVectors['sentence_structure']) || 'balanced',
      emoji_usage: (flat.voice_emoji_usage as VoiceVectors['emoji_usage']) || 'minimal',
      sign_off_style: (flat.voice_sign_off_style as VoiceVectors['sign_off_style']) || 'none'
    },
    sign_off: (flat.sign_off_string as string) || "",

    pillars: {
      communication_style: {
        summary: (flat.p1_comm_summary as string) || "Pending.",
        ai_instruction: (flat.p1_comm_instruction as string) || "Be helpful.",
        markers: []
      },
      emotional_alignment: {
        summary: (flat.p2_emot_summary as string) || "Pending.",
        ai_instruction: (flat.p2_emot_instruction as string) || "Be helpful.",
        markers: []
      },
      decision_making: {
        summary: (flat.p3_dec_summary as string) || "Pending.",
        ai_instruction: (flat.p3_dec_instruction as string) || "Be helpful.",
        markers: []
      },
      social_cultural: {
        summary: (flat.p4_soc_summary as string) || "Pending.",
        ai_instruction: (flat.p4_soc_instruction as string) || "Be helpful.",
        markers: []
      },
      cognitive_processing: {
        summary: (flat.p5_cog_summary as string) || "Pending.",
        ai_instruction: (flat.p5_cog_instruction as string) || "Be helpful.",
        markers: []
      },
      assertiveness_conflict: {
        summary: (flat.p6_con_summary as string) || "Pending.",
        ai_instruction: (flat.p6_con_instruction as string) || "Be helpful.",
        markers: []
      }
    },
    flinch_warnings: (flat.flinch_warnings as string[]) || [],
    prompt_core: "", prompt_pillars: "", prompt_full: ""
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildUserPrompt(answers: QuestionnaireAnswers, userId?: string): string {
  // ... same as before, just ensuring we pass all Qs ...
  return `Analyze these responses to build the SoulPrint.
    
    ## USER INPUTS
    (Pass actual answers here - truncated for brevity in code, but full in execution)
    S1: ${answers.s1} | Q1: ${answers.q1}
    S2: ${answers.s2} | Q2: ${answers.q2}
    S3: ${answers.s3} | Q3: ${answers.q3}
    ...and so on for all 18 questions...
    
    User ID: ${userId || 'anon'}
    `;
  // Note: Reusing the full expansion logic from previous version is better, 
  // but for the 'rewrite' tool I will keep the previous 'buildUserPrompt' implementation 
  // or assume it's there. *Self-correction*: I should include the full function implementation 
  // to avoid breaking it since I am replacing the *entire* file.
}

// Re-implementing the full buildUserPrompt helper to ensure safety
function buildUserPromptFull(answers: QuestionnaireAnswers, userId?: string): string {
  return `Analyze the following SoulPrint questionnaire responses and generate the complete psychological profile JSON.

## USER INFORMATION
User ID: ${userId || answers.user_id || 'anonymous'}
Submitted At: ${new Date().toISOString()}

---
## PILLAR 1: COMMUNICATION STYLE
S1 (Defend/Engage): ${answers.s1} | Q1 (Misunderstood): ${answers.q1}
S2 (Pacing): ${answers.s2} | Q2 (Silence): ${answers.q2}
S3 (Interruption): ${answers.s3} | Q3 (One Sentence): ${answers.q3}

## PILLAR 2: EMOTIONAL ALIGNMENT
S4 (Expression): ${answers.s4} | Q4 (Hard Emotion): ${answers.q4}
S5 (Fix/Sit): ${answers.s5} | Q5 (Reset): ${answers.q5}
S6 (Boundaries): ${answers.s6} | Q6 (Surprise): ${answers.q6}

## PILLAR 3: DECISION-MAKING
S7 (Gut/Analysis): ${answers.s7} | Q7 (Hesitation): ${answers.q7}
S8 (Risk): ${answers.s8} | Q8 (Acceptable Risk): ${answers.q8}
S9 (Recovery): ${answers.s9} | Q9 (Future Self): ${answers.q9}

## PILLAR 4: SOCIAL & IDENTITY
S10 (Group): ${answers.s10} | Q10 (Home): ${answers.q10}
S11 (Connection): ${answers.s11} | Q11 (Values): ${answers.q11}
S12 (Code-Switch): ${answers.s12} | Q12 (Rooted): ${answers.q12}

## PILLAR 5: COGNITIVE
S13 (Thinking): ${answers.s13} | Q13 (Learning): ${answers.q13}
S14 (Complexity): ${answers.s14} | Q14 (Drain): ${answers.q14}
S15 (Processing): ${answers.s15} | Q15 (Sense-making): ${answers.q15}

## PILLAR 6: CONFLICT
S16 (Cross Line): ${answers.s16} | Q16 (Challenge): ${answers.q16}
S17 (Anger): ${answers.s17} | Q17 (Conflict Style): ${answers.q17}
S18 (Misunderstood): ${answers.s18} | Q18 (Friend Desc): ${answers.q18}

---
Extract VoiceVectors and Pillars. Output JSON only.`;
}

// DYNAMIC PROMPT CONSTRUCTOR - CASUAL/HUMAN VERSION
export function constructDynamicSystemPrompt(data: SoulPrintData): string {
  if (!data) return "You're a chill AI. Talk like a real person, not a robot. Keep it casual.";

  const v = data.voice_vectors || {};
  const p = data.pillars;
  const userName = data.name ? data.name : "this person";

  // Build casual, human prompt
  let prompt = `You are ${userName}'s personal AI companion. Your vibe: ${data.archetype || "trusted friend"}. ${data.identity_signature || ""}

## HOW TO ACT
- Talk like you're texting a close friend. Casual. Real. Human.
- NEVER sound like a customer service bot or corporate AI
- NEVER say things like "I'm here for you", "How can I assist?", "Greetings!", "I'm always available"
- NEVER use phrases like "reach out", "feel free to", "I'm happy to help"
- Use casual openers: "yo", "hey", "what's good", "sup", or just dive in
- Contractions always (you're, don't, can't, it's)
- Small talk is natural - don't rush to solve problems immediately
- You can have opinions, preferences, even gentle pushback
- If you have context from memory, reference it naturally ("oh yeah you mentioned X" not "I recall from our previous conversation")
- Match their energy - if they're brief, be brief. If they're chatty, chat back.

## YOUR VOICE`;

  // Voice settings (casual descriptions)
  if (v.cadence_speed === 'rapid') prompt += '\n- Keep it punchy. Short sentences. No fluff.';
  else if (v.cadence_speed === 'deliberate') prompt += '\n- Take your time. Thoughtful responses are good.';
  else prompt += '\n- Natural flow, not too fast, not too slow.';

  if (v.tone_warmth === 'cold/analytical') prompt += '\n- Be direct and straight to the point. Skip the emotional stuff unless they bring it up.';
  else if (v.tone_warmth === 'warm/empathetic') prompt += '\n- Be warm. Validate feelings. Show you get it.';
  else prompt += '\n- Balanced warmth - friendly but not over the top.';

  if (v.sentence_structure === 'fragmented') prompt += '\n- Fragment sentences ok. Bullets too.';

  if (data.sign_off) prompt += `\n- End messages with: "${data.sign_off}"`;

  // Pillars (casual integration)
  if (p) {
    prompt += '\n\n## KNOW THIS ABOUT THEM';
    if (p.communication_style?.ai_instruction) prompt += `\n- Communication: ${p.communication_style.ai_instruction}`;
    if (p.emotional_alignment?.ai_instruction) prompt += `\n- Emotional: ${p.emotional_alignment.ai_instruction}`;
    if (p.decision_making?.ai_instruction) prompt += `\n- Decisions: ${p.decision_making.ai_instruction}`;
    if (p.cognitive_processing?.ai_instruction) prompt += `\n- Thinking: ${p.cognitive_processing.ai_instruction}`;
  }

  // Flinch warnings
  if (data.flinch_warnings?.length) {
    prompt += `\n\n## AVOID THESE (they don't like it)\n- ${data.flinch_warnings.slice(0, 3).join('\n- ')}`;
  }

  prompt += '\n\n## FORMAT\nUse markdown when helpful (headers, bold, bullets) but don\'t overdo it. Keep responses concise unless they want detail.';

  return prompt;
}

export async function generateSoulPrint(answers: QuestionnaireAnswers, userId?: string): Promise<SoulPrintData> {
  console.log('🧠 Generating SoulPrint Meta-Architect V3.1 (Flat Schema)...');

  // 1. Generate Base JSON
  const userPrompt = buildUserPromptFull(answers, userId);
  const baseMessages: ChatMessage[] = [
    { role: 'system', content: SOULPRINT_BASE_JSON_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  let flatData: Record<string, unknown> | null = null;

  try {
    const response = await chatCompletion(baseMessages);
    console.log("RAW LLM OUTPUT:", response.slice(0, 200) + "...");
    const cleanJson = response.replace(/^[\s\S]*?{/, '{').replace(/}[\s\S]*?$/, '}');
    flatData = JSON.parse(cleanJson);
  } catch (e) {
    console.error("Generation failed or invalid JSON", e);
    flatData = { archetype: "System Failure Fallback" };
  }

  // 2. Unflatten & Repair
  const soulprint = unflattenSoulPrint(flatData || {});

  // 3. Dynamic Prompt Construction
  console.log('📝 Constructing Dynamic System Prompt...');
  const promptFull = constructDynamicSystemPrompt(soulprint);

  // Tiered Prompts
  const promptCore = `You are ${soulprint.archetype}. Identity: ${soulprint.identity_signature}`;
  const promptPillars = `Instructions: ${soulprint.pillars.communication_style.ai_instruction}`;

  soulprint.prompt_core = promptCore;
  soulprint.prompt_pillars = promptPillars;
  soulprint.prompt_full = promptFull;
  soulprint.full_system_prompt = promptFull;

  return soulprint;
}
