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
    // Generate SoulPrint via local LLM (AWS SageMaker)
    const soulprintData = await generateSoulPrint(answers, userId);

    // Save to Supabase soulprints table
    const savedRecord = await saveSoulPrint(supabaseAdmin, userId, soulprintData, userData);

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
