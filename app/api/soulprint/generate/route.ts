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
        console.log('🚀 [SoulPrint API] Generation process started');
        const supabase = await createClient();

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error('❌ [SoulPrint API] Unauthorized access attempt');
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log(`👤 [SoulPrint API] User identified: ${user.id} (${user.email})`);

        const body = await request.json();
        const { answers } = body;

        if (!answers) {
            console.error('❌ [SoulPrint API] Missing answers in request body');
            return NextResponse.json(
                { error: 'answers are required' },
                { status: 400 }
            );
        }

        // Process SoulPrint directly (Generate, Save, Index)
        console.log('🧠 [SoulPrint API] Calling processSoulPrint...');
        const result = await processSoulPrint(supabaseAdmin, user.id, answers, {
            email: user.email,
            full_name: user.user_metadata?.full_name,
            avatar_url: user.user_metadata?.avatar_url
        });

        // Activate any pending default API keys
        console.log('🔑 [SoulPrint API] Activating API keys...');
        const { error: keyError } = await supabaseAdmin
            .from('api_keys')
            .update({ status: 'active' })
            .eq('user_id', user.id)
            .eq('status', 'inactive');

        if (keyError) {
            console.warn('⚠️ Failed to activate API keys:', keyError);
        } else {
            console.log('✅ API keys activated');
        }

        const duration = (Date.now() - startTime) / 1000;
        console.log(`✅ [SoulPrint API] Success! Archetype: ${result.archetype}. Total time: ${duration.toFixed(2)}s`);

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
