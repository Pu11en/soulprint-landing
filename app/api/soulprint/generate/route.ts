import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { processSoulPrint } from '@/lib/soulprint/service';

export const maxDuration = 300; // Allow up to 300 seconds (5 minutes) for processing
export const runtime = 'nodejs'; // Use Node.js runtime to avoid Edge timeout limits

// Supabase admin client
const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    try {
        const supabase = await createClient();

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { answers } = body;

        if (!answers) {
            return NextResponse.json(
                { error: 'answers are required' },
                { status: 400 }
            );
        }

        // Process SoulPrint directly (Generate, Save, Index)
        const result = await processSoulPrint(supabaseAdmin, user.id, answers, {
            email: user.email,
            full_name: user.user_metadata?.full_name,
            avatar_url: user.user_metadata?.avatar_url
        });

        // Activate any pending default API keys
        await supabaseAdmin
            .from('api_keys')
            .update({ status: 'active' })
            .eq('user_id', user.id)
            .eq('status', 'inactive');

        return NextResponse.json(result);

    } catch (error: unknown) {
        const duration = (Date.now() - startTime) / 1000;
        console.error(`❌ [SoulPrint API] Critical error after ${duration.toFixed(2)}s:`, error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
