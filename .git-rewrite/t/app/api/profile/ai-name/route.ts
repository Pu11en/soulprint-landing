/**
 * Get/Set AI name for user
 */
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

// GET - retrieve AI name
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = getSupabaseAdmin();
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('ai_name')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({ 
      aiName: profile?.ai_name || null,
      hasName: !!profile?.ai_name,
    });
  } catch (error) {
    console.error('Error getting AI name:', error);
    return NextResponse.json({ error: 'Failed to get AI name' }, { status: 500 });
  }
}

// POST - set AI name
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const cleanName = name.trim().slice(0, 50); // Limit to 50 chars

    const adminSupabase = getSupabaseAdmin();
    const { error: updateError } = await adminSupabase
      .from('user_profiles')
      .update({ ai_name: cleanName, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating AI name:', updateError);
      return NextResponse.json({ error: 'Failed to save name' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      aiName: cleanName,
    });
  } catch (error) {
    console.error('Error setting AI name:', error);
    return NextResponse.json({ error: 'Failed to set AI name' }, { status: 500 });
  }
}
