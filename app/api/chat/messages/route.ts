import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { handleAPIError } from '@/lib/api/error-handler';
import { parseRequestBody, saveMessageSchema } from '@/lib/api/schemas';
import { checkRateLimit } from '@/lib/rate-limit';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET - Load chat history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // For pagination
    const conversationId = searchParams.get('conversation_id'); // For filtering by conversation

    const adminSupabase = getSupabaseAdmin();

    let query = adminSupabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('[Messages] Load error:', error);
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    // Reverse to get chronological order
    return NextResponse.json({ 
      messages: (messages || []).reverse(),
      hasMore: messages?.length === limit 
    });

  } catch (error) {
    return handleAPIError(error, 'API:ChatMessages:GET');
  }
}

// POST - Save a message
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
    const result = await parseRequestBody(request, saveMessageSchema);
    if (result instanceof Response) return result;
    const { role, content, conversation_id } = result;

    const adminSupabase = getSupabaseAdmin();

    const { data: message, error } = await adminSupabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        role,
        content,
        conversation_id,
      })
      .select()
      .single();

    if (error) {
      console.error('[Messages] Save error:', error);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    // Update conversation's updated_at to keep sidebar order fresh
    await adminSupabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation_id);

    return NextResponse.json({ message });

  } catch (error) {
    return handleAPIError(error, 'API:ChatMessages:POST');
  }
}
