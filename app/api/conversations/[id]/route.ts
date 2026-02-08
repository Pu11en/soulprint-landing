import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { handleAPIError } from '@/lib/api/error-handler';
import { parseRequestBody, updateConversationSchema } from '@/lib/api/schemas';
import { checkRateLimit } from '@/lib/rate-limit';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// PATCH - Rename conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const result = await parseRequestBody(request, updateConversationSchema);
    if (result instanceof Response) return result;
    const { title } = result;

    // Extract conversation ID from route params
    const { id } = await params;

    const adminSupabase = getSupabaseAdmin();

    const { data: conversation, error } = await adminSupabase
      .from('conversations')
      .update({ title })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Conversations] Update error:', error);
      return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ conversation });

  } catch (error) {
    return handleAPIError(error, 'API:Conversations:PATCH');
  }
}

// DELETE - Delete conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'standard');
    if (rateLimited) return rateLimited;

    // Extract conversation ID from route params
    const { id } = await params;

    const adminSupabase = getSupabaseAdmin();

    const { error } = await adminSupabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Conversations] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    return handleAPIError(error, 'API:Conversations:DELETE');
  }
}
