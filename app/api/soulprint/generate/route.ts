import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { processSoulPrint } from '@/lib/soulprint/service';

export const maxDuration = 60; // Allow up to 60 seconds for processing
export const runtime = 'edge'; // Use Edge Runtime for longer timeout on Hobby plan

// Supabase admin client
const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
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
        
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error generating SoulPrint:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
