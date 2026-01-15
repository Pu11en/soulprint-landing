import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { constructDynamicSystemPrompt } from '../lib/soulprint/generator';
import type { SoulPrintData } from '../lib/soulprint/types';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('🚀 Starting SoulPrint Migration to V3.1 (Claude-Formatting)...');

    // 1. Fetch all SoulPrints
    const { data: soulprints, error } = await supabase
        .from('soulprints')
        .select('id, user_id, soulprint_data');

    if (error) {
        console.error('❌ Failed to fetch soulprints:', error);
        process.exit(1);
    }

    console.log(`Found ${soulprints.length} SoulPrints to process.`);
    let updatedCount = 0;

    for (const record of soulprints) {
        try {
            let print: any = record.soulprint_data;
            if (typeof print === 'string') {
                print = JSON.parse(print);
            }

            let needsUpdate = false;

            // CHECK 1: Version or Missing Version
            if (print.soulprint_version !== '3.1') {
                needsUpdate = true;
                print.soulprint_version = '3.1';
            }

            // CHECK 2: Output Formatting (Check if prompt contains "OUTPUT FORMATTING")
            if (!print.full_system_prompt || !print.full_system_prompt.includes('OUTPUT FORMATTING RULES')) {
                needsUpdate = true;
            }

            // BACKFILL: Voice Vectors
            if (!print.voice_vectors) {
                console.log(`   - Backfilling Voice for ${record.id}`);
                print.voice_vectors = {
                    cadence_speed: 'moderate',
                    tone_warmth: 'neutral',
                    sentence_structure: 'balanced',
                    emoji_usage: 'none',
                    sign_off_style: 'none'
                };
                needsUpdate = true;
            }

            // BACKFILL: Sign Off
            if (!print.sign_off) {
                print.sign_off = "";
                needsUpdate = true;
            }

            // BACKFILL: Pillars (Simplistic Fallback)
            if (!print.pillars) {
                console.log(`   - Backfilling Pillars for ${record.id}`);
                print.pillars = {
                    communication_style: { summary: "Standard", ai_instruction: "Be clear and helpful." },
                    emotional_alignment: { summary: "Standard", ai_instruction: "Be empathetic." },
                    decision_making: { summary: "Standard", ai_instruction: "Be objective." },
                    social_cultural: { summary: "Standard", ai_instruction: "Be polite." },
                    cognitive_processing: { summary: "Standard", ai_instruction: "Be logical." },
                    assertiveness_conflict: { summary: "Standard", ai_instruction: "Be diplomatic." }
                };
                needsUpdate = true;
            }

            if (needsUpdate) {
                // RE-GENERATE PROMPT using the new code
                const newPrompt = constructDynamicSystemPrompt(print as SoulPrintData);
                print.full_system_prompt = newPrompt;
                print.prompt_full = newPrompt; // Ensure both fields are set

                // Save back to DB
                const { error: updateError } = await supabase
                    .from('soulprints')
                    .update({ soulprint_data: print })
                    .eq('id', record.id);

                if (updateError) {
                    console.error(`❌ Failed to update ${record.id}:`, updateError.message);
                } else {
                    console.log(`✅ Migrated SoulPrint ${record.id} (${print.archetype})`);
                    updatedCount++;
                }
            } else {
                console.log(`   - Skipped ${record.id} (Already V3.1)`);
            }

        } catch (e) {
            console.error(`❌ Error processing ${record.id}:`, e);
        }
    }

    console.log(`\n🎉 Migration Complete. Updated ${updatedCount} records.`);
}

migrate();
