import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { constructDynamicSystemPrompt } from '../lib/soulprint/generator';
import type { SoulPrintData, SoulPrintPillars, VoiceVectors } from '../lib/soulprint/types';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Detect the version/format of an old SoulPrint
 */
function detectFormat(data: any): 'v1-traits' | 'v2-pillars' | 'v3-partial' | 'v3.1-complete' | 'unknown' {
    if (!data) return 'unknown';
    
    // V1: Has "traits" object with numeric values (e.g., decision_making.speed)
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
        // Check if full_system_prompt is stringified JSON (V2.0 bug)
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
function convertTraitsToPillars(traits: any): SoulPrintPillars {
    const defaultPillar = (summary: string, instruction: string) => ({
        summary,
        ai_instruction: instruction,
        markers: []
    });

    // Map V1 trait values to descriptive summaries
    const decisionSpeed = traits.decision_making?.speed ?? 50;
    const gutTrust = traits.decision_making?.gut_trust ?? 50;
    const riskTolerance = traits.decision_making?.risk_tolerance ?? 50;

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
        social_cultural: defaultPillar(
            'Adaptable social style',
            'Respect their social boundaries and preferences.'
        ),
        cognitive_processing: defaultPillar(
            'Flexible thinking style',
            'Adapt explanation depth to their needs.'
        ),
        assertiveness_conflict: defaultPillar(
            'Balanced conflict approach',
            'Handle disagreements with respect and directness.'
        )
    };
}

/**
 * Infer voice vectors from existing data or defaults
 */
function inferVoiceVectors(data: any): VoiceVectors {
    // Try to extract from existing prompt text
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
 * Normalize a SoulPrint to V3.1 format
 */
function normalizeSoulPrint(data: any, format: string): SoulPrintData {
    const result: SoulPrintData = {
        soulprint_version: '3.1',
        generated_at: data.generated_at || new Date().toISOString(),
        archetype: data.archetype || 'Digital Companion',
        identity_signature: data.identity_signature || 'Your personalized AI companion.',
        name: data.name,
        voice_vectors: data.voice_vectors || inferVoiceVectors(data),
        sign_off: data.sign_off || '',
        pillars: data.pillars || convertTraitsToPillars(data.traits || {}),
        flinch_warnings: data.flinch_warnings || [],
        prompt_core: '',
        prompt_pillars: '',
        prompt_full: ''
    };

    // Handle V1 traits format
    if (format === 'v1-traits') {
        result.pillars = convertTraitsToPillars(data.traits);
        result.archetype = data.archetype || 'Unique Individual';
        console.log(`      Converted V1 traits to pillars`);
    }

    // Handle V2 with stringified JSON in prompt
    if (format === 'v2-pillars' && data.full_system_prompt) {
        try {
            // The prompt might be double-encoded JSON - parse it to extract useful data
            const parsed = JSON.parse(data.full_system_prompt);
            if (parsed.pillars) result.pillars = parsed.pillars;
            if (parsed.identity_signature) result.identity_signature = parsed.identity_signature;
            if (parsed.flinch_warnings) result.flinch_warnings = parsed.flinch_warnings;
            console.log(`      Extracted data from stringified V2 prompt`);
        } catch (e) {
            // Not valid JSON, keep existing pillars
            console.log(`      V2 prompt wasn't valid JSON, keeping existing pillars`);
        }
    }

    // Ensure all pillars have required fields
    const pillars = result.pillars;
    for (const key of Object.keys(pillars) as (keyof SoulPrintPillars)[]) {
        if (!pillars[key]) {
            pillars[key] = { summary: 'Standard', ai_instruction: 'Be helpful.', markers: [] };
        }
        if (!pillars[key].ai_instruction) {
            pillars[key].ai_instruction = 'Be helpful and supportive.';
        }
        if (!pillars[key].markers) {
            pillars[key].markers = [];
        }
    }

    return result;
}

async function migrate() {
    console.log('🚀 Starting SoulPrint Migration to V3.1 (Multi-Format Support)...');
    console.log('   Supports: V1 (traits), V2 (stringified), V3 (partial), V3.1 (complete)\n');

    // 1. Fetch all SoulPrints
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
    const formatCounts: Record<string, number> = {};

    for (const record of soulprints) {
        try {
            let print: any = record.soulprint_data;
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
            console.error(`   ❌ Error: ${e}`);
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
