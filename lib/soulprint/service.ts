import { SupabaseClient } from '@supabase/supabase-js';
import type { QuestionnaireAnswers } from '@/lib/soulprint/types';
import { generateSoulPrint } from '@/lib/soulprint/generator';
import { saveSoulPrint } from './db';

export async function processSoulPrint(
    supabaseAdmin: SupabaseClient,
    userId: string,
    answers: QuestionnaireAnswers,
    userData?: { email?: string; full_name?: string; avatar_url?: string }
) {
    console.log('🧠 Generating SoulPrint for user:', userId);

    // Generate SoulPrint via local LLM (AWS SageMaker)
    const soulprintData = await generateSoulPrint(answers, userId);
    console.log('✅ SoulPrint generated via AWS SageMaker LLM');
    console.log('✅ Archetype:', soulprintData.archetype);

    // Save to Supabase soulprints table
    const savedRecord = await saveSoulPrint(supabaseAdmin, userId, soulprintData, userData);
    console.log('💾 SoulPrint saved to Supabase with ID:', savedRecord.id);

    return {
        success: true,
        message: 'SoulPrint generated and saved successfully',
        soulprint_id: savedRecord.id,
        user_id: userId,
        archetype: soulprintData.archetype,
        generated_at: soulprintData.generated_at,
        soulprint_data: soulprintData
    };
}
