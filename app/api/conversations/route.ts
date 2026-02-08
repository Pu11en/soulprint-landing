import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { handleAPIError } from '@/lib/api/error-handler';
import { parseRequestBody, createConversationSchema } from '@/lib/api/schemas';
import { checkRateLimit } from '@/lib/rate-limit';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET - List user's conversations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = getSupabaseAdmin();

    const { data: conversations, error } = await adminSupabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Conversations] Load error:', error);
      return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 });
    }

    return NextResponse.json({
      conversations: conversations || []
    });

  } catch (error) {
    return handleAPIError(error, 'API:Conversations:GET');
  }
}

// POST - Create new conversation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'standard');
    if (rateLimited) return rateLimited;

    // Parse and validate request body
    const result = await parseRequestBody(request, createConversationSchema);
    if (result instanceof Response) return result;
    const { title } = result;

    const adminSupabase = getSupabaseAdmin();

    const { data: conversation, error } = await adminSupabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title,
      })
      .select()
      .single();

    if (error) {
      console.error('[Conversations] Create error:', error);
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }

    return NextResponse.json({ conversation }, { status: 201 });

  } catch (error) {
    return handleAPIError(error, 'API:Conversations:POST');
  }
}
