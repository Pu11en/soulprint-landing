import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

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

    const { data: messages, error } = await query;

    if (error) {
      console.error('[Messages] Load error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reverse to get chronological order
    return NextResponse.json({ 
      messages: (messages || []).reverse(),
      hasMore: messages?.length === limit 
    });

  } catch (error) {
    console.error('[Messages] Error:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
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

    const { role, content } = await request.json();

    if (!role || !content) {
      return NextResponse.json({ error: 'Role and content required' }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdmin();
    
    const { data: message, error } = await adminSupabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        role,
        content,
      })
      .select()
      .single();

    if (error) {
      console.error('[Messages] Save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message });

  } catch (error) {
    console.error('[Messages] Error:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}
