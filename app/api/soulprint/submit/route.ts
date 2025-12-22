import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
    generateSoulPrint,
    createFileSearchStore,
    uploadToFileSearchStore,
    soulPrintToDocument,
} from '@/lib/gemini';
import type { QuestionnaireAnswers } from '@/lib/gemini';
import { saveSoulPrint } from '@/lib/soulprint/db';

// Supabase admin client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const supabaseAuth = await createServerClient();
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { user_id, answers } = body as { user_id: string; answers: QuestionnaireAnswers };

        if (!user_id) {
            return NextResponse.json(
                { error: 'user_id is required' },
                { status: 400 }
            );
        }

        // Verify user permission (allow matching ID or Email)
        if (user.id !== user_id && user.email !== user_id) {
            // Allow demo user bypass if needed, or service role calls (but we are checking auth user here)
            // For now, strict check.
            console.warn(`Unauthorized attempt: User ${user.id}/${user.email} tried to submit for ${user_id}`);
            return NextResponse.json(
                { error: 'Unauthorized: User ID mismatch' },
                { status: 403 }
            );
        }

        if (!answers) {
            return NextResponse.json(
                { error: 'answers are required' },
                { status: 400 }
            );
        }

        console.log('🧠 Generating SoulPrint for user:', user_id);

        // 1. Generate SoulPrint using Gemini
        const soulprintData = await generateSoulPrint(answers);
        console.log('✅ SoulPrint generated, archetype:', soulprintData.archetype);

        // 2. Save to Supabase soulprints table (using safe save)
        try {
            await saveSoulPrint(supabaseAdmin, user_id, soulprintData);
            console.log('💾 SoulPrint saved to Supabase');
        } catch (saveError) {
            console.error('Failed to save SoulPrint:', saveError);
            return NextResponse.json(
                { error: 'Failed to save SoulPrint to database' },
                { status: 500 }
            );
        }

        // 3. Get or create Gemini File Search Store for user (optional - may fail if table doesn't exist)
        let storeName: string | null = null;
        let uploadOpName: string | null = null;

        try {
            const { data: existingStore, error: storeError } = await supabaseAdmin
                .from('gemini_file_stores')
                .select('store_name')
                .eq('user_id', user_id)
                .single();

            if (storeError && storeError.code !== 'PGRST116') {
                // PGRST116 = not found, which is fine
                console.warn('⚠️ Could not check for existing store:', storeError.message);
            }

            if (existingStore) {
                storeName = existingStore.store_name;
                console.log('📚 Using existing File Search Store:', storeName);
            } else {
                // Create new store
                const displayName = `soulprint-${user_id.substring(0, 8)}`;
                const store = await createFileSearchStore(displayName);
                storeName = store.name;

                // Save store reference (may fail if table doesn't exist)
                const { error: insertError } = await supabaseAdmin
                    .from('gemini_file_stores')
                    .insert({
                        user_id,
                        store_name: storeName,
                        display_name: displayName
                    });

                if (insertError) {
                    console.warn('⚠️ Could not save store reference:', insertError.message);
                } else {
                    console.log('📚 Created new File Search Store:', storeName);
                }
            }

            // 4. Upload SoulPrint as document to File Search Store (async)
            if (storeName) {
                const documentContent = soulPrintToDocument(soulprintData);
                const uploadOp = await uploadToFileSearchStore(
                    storeName,
                    documentContent,
                    'SoulPrint Identity Document'
                );
                uploadOpName = uploadOp.name;
                console.log('📤 Upload operation started:', uploadOpName);
            }
        } catch (fileSearchError) {
            console.warn('⚠️ File Search operations failed (continuing without RAG):', fileSearchError);
        }

        // Return success - upload continues in background
        return NextResponse.json({
            success: true,
            message: 'SoulPrint generated and saved successfully',
            user_id,
            archetype: soulprintData.archetype,
            store_name: storeName,
            upload_operation: uploadOpName,
            generated_at: soulprintData.generated_at
        });

    } catch (error) {
        console.error('Error in SoulPrint submit:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate SoulPrint',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}