import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { processSoulPrint } from '@/lib/soulprint/service';
import type { QuestionnaireAnswers } from '@/lib/soulprint/types';

export const maxDuration = 60; // Allow up to 60 seconds for processing
export const runtime = 'edge'; // Use Edge Runtime for longer timeout on Hobby plan

// Supabase admin client
const supabaseAdmin = createAdminClient(
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

        // Verify user permission
        if (user.id !== user_id && user.email !== user_id) {
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

        // Process SoulPrint (Generate, Save, Index)
        const result = await processSoulPrint(supabaseAdmin, user_id, answers, {
            email: user.email,
            full_name: user.user_metadata?.full_name,
            avatar_url: user.user_metadata?.avatar_url
        });

        return NextResponse.json(result);

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