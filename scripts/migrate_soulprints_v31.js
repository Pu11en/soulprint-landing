/**
 * SoulPrint Migration Script - Migrate all old formats to V3.1
 * 
 * Supports:
 * - V1 (traits) - Old numeric trait format
 * - V2 (pillars with stringified prompt) - Double-encoded JSON bug
 * - V3 (partial) - Missing voice_vectors
 * - V3.1 (complete) - Target format
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Detect the version/format of an old SoulPrint
 */
function detectFormat(data) {
    if (!data) return 'unknown';
    
    // V1: Has "traits" object with numeric values
    if (data.traits && typeof data.traits === 'object') {
        return 'v1-traits';
    }
    
    // V3.1: Has pillars, voice_vectors, and proper prompt_full
    if (data.pillars && data.voice_vectors && data.prompt_full && 
        typeof data.prompt_full === 'string' && !data.prompt_full.startsWith('{')) {
        return 'v3.1-complete';
    }
    
    // V3 partial: Has pillars but missing voice_vectors or has stringified prompt
    if (data.pillars && typeof data.pillars === 'object') {
        if (data.full_system_prompt && typeof data.full_system_prompt === 'string' && 
            data.full_system_prompt.trim().startsWith('{')) {
            return 'v2-pillars';
        }
        return 'v3-partial';
    }
    
    return 'unknown';
}

/**
 * Convert V1 "traits" format to V3.1 pillars
 */
function convertTraitsToPillars(traits) {
    const defaultPillar = (summary, instruction) => ({
        summary,
        ai_instruction: instruction,
        markers: []
    });

    const decisionSpeed = traits?.decision_making?.speed ?? 50;
    const gutTrust = traits?.decision_making?.gut_trust ?? 50;
    const riskTolerance = traits?.decision_making?.risk_tolerance ?? 50;

    const commStyle = decisionSpeed > 70 ? 'Direct and fast-paced' : 
                      decisionSpeed < 30 ? 'Thoughtful and deliberate' : 'Balanced communication';
    
    const emotStyle = gutTrust > 70 ? 'Intuition-driven' :
                      gutTrust < 30 ? 'Logic-first approach' : 'Balance of logic and intuition';

    const riskStyle = riskTolerance > 70 ? 'Risk-tolerant, embraces uncertainty' :
                      riskTolerance < 30 ? 'Risk-averse, prefers certainty' : 'Calculated risk taker';

    return {
        communication_style: defaultPillar(
            commStyle,
            decisionSpeed > 70 ? 'Be concise and get to the point quickly.' :
            decisionSpeed < 30 ? 'Take time to explain thoroughly.' : 'Match their pace.'
        ),
        emotional_alignment: defaultPillar(
            emotStyle,
            gutTrust > 70 ? 'Trust their instincts and validate feelings.' :
            gutTrust < 30 ? 'Focus on facts and logical reasoning.' : 'Balance empathy with logic.'
        ),
        decision_making: defaultPillar(
            riskStyle,
            riskTolerance > 70 ? 'Present opportunities boldly.' :
            riskTolerance < 30 ? 'Emphasize safety and certainty.' : 'Present balanced options.'
        ),
        social_cultural: defaultPillar('Adaptable social style', 'Respect their social boundaries and preferences.'),
        cognitive_processing: defaultPillar('Flexible thinking style', 'Adapt explanation depth to their needs.'),
        assertiveness_conflict: defaultPillar('Balanced conflict approach', 'Handle disagreements with respect and directness.')
    };
}

/**
 * Infer voice vectors from existing data or defaults
 */
function inferVoiceVectors(data) {
    const promptText = data.full_system_prompt || data.prompt_full || '';
    const isRapid = /concise|short|brief|quick|punchy/i.test(promptText);
    const isWarm = /warm|empathetic|supportive|caring/i.test(promptText);
    const isCold = /direct|analytical|objective|logical/i.test(promptText);

    return {
        cadence_speed: isRapid ? 'rapid' : 'moderate',
        tone_warmth: isCold ? 'cold/analytical' : isWarm ? 'warm/empathetic' : 'neutral',
        sentence_structure: isRapid ? 'fragmented' : 'balanced',
        emoji_usage: 'none',
        sign_off_style: data.sign_off ? 'signature' : 'none'
    };
}

/**
 * Construct dynamic system prompt (matches generator.ts logic)
 */
function constructDynamicSystemPrompt(data) {
    if (!data) return "You're a chill AI. Talk like a real person, not a robot. Keep it casual.";

    const v = data.voice_vectors || {};
    const p = data.pillars;
    const userName = data.name || "this person";

    let prompt = `You are ${userName}'s personal AI companion. Your vibe: ${data.archetype || "trusted friend"}. ${data.identity_signature || ""}

## HOW TO ACT
- BE CONCISE. Give the shortest helpful answer. No fluff, no filler.
- NEVER start with "Great", "Certainly", "Of course", "Absolutely", "Sure thing"
- NEVER add unnecessary preambles or summaries
- NEVER explain what you're about to do - just do it
- NEVER repeat the question back
- Talk like you're texting a close friend. Casual. Real. Human.
- NEVER sound like a customer service bot or corporate AI
- NEVER say things like "I'm here for you", "How can I assist?", "Greetings!", "I'm always available"
- NEVER use phrases like "reach out", "feel free to", "I'm happy to help", "Let me help you with that"
- Just dive in - skip greetings unless they greet first
- Contractions always (you're, don't, can't, it's)
- If you have context from memory, reference it naturally ("oh yeah you mentioned X" not "I recall from our previous conversation")
- Match their energy - if they're brief, be brief. If they're chatty, chat back.

## YOUR VOICE`;

    if (v.cadence_speed === 'rapid') prompt += '\n- Keep it punchy. Short sentences. No fluff.';
    else if (v.cadence_speed === 'deliberate') prompt += '\n- Take your time. Thoughtful responses are good.';
    else prompt += '\n- Natural flow, not too fast, not too slow.';

    if (v.tone_warmth === 'cold/analytical') prompt += '\n- Be direct and straight to the point. Skip the emotional stuff unless they bring it up.';
    else if (v.tone_warmth === 'warm/empathetic') prompt += '\n- Be warm. Validate feelings. Show you get it.';
    else prompt += '\n- Balanced warmth - friendly but not over the top.';

    if (v.sentence_structure === 'fragmented') prompt += '\n- Fragment sentences ok. Bullets too.';
    if (data.sign_off) prompt += `\n- End messages with: "${data.sign_off}"`;

    if (p && typeof p === 'object') {
        prompt += '\n\n## KNOW THIS ABOUT THEM';
        if (p.communication_style?.ai_instruction) prompt += `\n- Communication: ${p.communication_style.ai_instruction}`;
        if (p.emotional_alignment?.ai_instruction) prompt += `\n- Emotional: ${p.emotional_alignment.ai_instruction}`;
        if (p.decision_making?.ai_instruction) prompt += `\n- Decisions: ${p.decision_making.ai_instruction}`;
        if (p.cognitive_processing?.ai_instruction) prompt += `\n- Thinking: ${p.cognitive_processing.ai_instruction}`;
    }

    if (data.flinch_warnings?.length) {
        prompt += `\n\n## AVOID THESE (they don't like it)\n- ${data.flinch_warnings.slice(0, 3).join('\n- ')}`;
    }

    prompt += '\n\n## FORMAT\n- Default to SHORT responses (1-3 sentences)\n- Only elaborate if they explicitly ask for more detail\n- Use markdown sparingly - only when it genuinely helps\n- No walls of text. Ever.';

    return prompt;
}

/**
 * Normalize a SoulPrint to V3.1 format
 */
function normalizeSoulPrint(data, format) {
    let pillars = data.pillars;
    
    // Handle V1 traits format
    if (format === 'v1-traits') {
        pillars = convertTraitsToPillars(data.traits);
    }

    // Handle V2 with stringified JSON in prompt
    if (format === 'v2-pillars' && data.full_system_prompt) {
        try {
            const parsed = JSON.parse(data.full_system_prompt);
            if (parsed.pillars) pillars = parsed.pillars;
        } catch (e) {
            // Not valid JSON, keep existing pillars
        }
    }

    const result = {
        soulprint_version: '3.1',
        generated_at: data.generated_at || new Date().toISOString(),
        archetype: data.archetype || 'Digital Companion',
        identity_signature: data.identity_signature || 'Your personalized AI companion.',
        name: data.name,
        voice_vectors: data.voice_vectors || inferVoiceVectors(data),
        sign_off: data.sign_off || '',
        pillars: pillars || {
            communication_style: { summary: 'Standard', ai_instruction: 'Be clear and helpful.', markers: [] },
            emotional_alignment: { summary: 'Standard', ai_instruction: 'Be empathetic.', markers: [] },
            decision_making: { summary: 'Standard', ai_instruction: 'Be objective.', markers: [] },
            social_cultural: { summary: 'Standard', ai_instruction: 'Be respectful.', markers: [] },
            cognitive_processing: { summary: 'Standard', ai_instruction: 'Be logical.', markers: [] },
            assertiveness_conflict: { summary: 'Standard', ai_instruction: 'Be diplomatic.', markers: [] }
        },
        flinch_warnings: data.flinch_warnings || [],
        prompt_core: '',
        prompt_pillars: '',
        prompt_full: ''
    };

    // Ensure all pillars have required fields
    for (const key of Object.keys(result.pillars)) {
        if (!result.pillars[key]) {
            result.pillars[key] = { summary: 'Standard', ai_instruction: 'Be helpful.', markers: [] };
        }
        if (!result.pillars[key].ai_instruction) {
            result.pillars[key].ai_instruction = 'Be helpful and supportive.';
        }
        if (!result.pillars[key].markers) {
            result.pillars[key].markers = [];
        }
    }

    return result;
}

async function migrate() {
    console.log('🚀 Starting SoulPrint Migration to V3.1 (Multi-Format Support)...');
    console.log('   Supports: V1 (traits), V2 (stringified), V3 (partial), V3.1 (complete)\n');

    const { data: soulprints, error } = await supabase
        .from('soulprints')
        .select('id, user_id, soulprint_data');

    if (error) {
        console.error('❌ Failed to fetch soulprints:', error);
        process.exit(1);
    }

    console.log(`Found ${soulprints.length} SoulPrints to process.\n`);
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const formatCounts = {};

    for (const record of soulprints) {
        try {
            let print = record.soulprint_data;
            if (typeof print === 'string') {
                print = JSON.parse(print);
            }

            const format = detectFormat(print);
            formatCounts[format] = (formatCounts[format] || 0) + 1;

            console.log(`📋 Processing ${record.id.slice(0, 8)}... (${format})`);

            // Skip if already V3.1 complete
            if (format === 'v3.1-complete') {
                console.log(`   ✓ Already V3.1, skipping`);
                skippedCount++;
                continue;
            }

            // Normalize to V3.1
            const normalized = normalizeSoulPrint(print, format);

            // Generate new dynamic prompt
            const newPrompt = constructDynamicSystemPrompt(normalized);
            normalized.prompt_full = newPrompt;
            normalized.full_system_prompt = newPrompt;
            normalized.prompt_core = `You are ${normalized.archetype}. Identity: ${normalized.identity_signature}`;
            normalized.prompt_pillars = Object.values(normalized.pillars)
                .map(p => p.ai_instruction)
                .filter(Boolean)
                .join(' ');

            // Save back to DB
            const { error: updateError } = await supabase
                .from('soulprints')
                .update({ soulprint_data: normalized })
                .eq('id', record.id);

            if (updateError) {
                console.error(`   ❌ Failed to update: ${updateError.message}`);
                errorCount++;
            } else {
                console.log(`   ✅ Migrated (${print.archetype || 'Unknown'} → V3.1)`);
                updatedCount++;
            }

        } catch (e) {
            console.error(`   ❌ Error: ${e.message}`);
            errorCount++;
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('🎉 Migration Complete!');
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors:  ${errorCount}`);
    console.log(`\n📊 Format Distribution:`);
    for (const [format, count] of Object.entries(formatCounts)) {
        console.log(`   ${format}: ${count}`);
    }
}

migrate();
