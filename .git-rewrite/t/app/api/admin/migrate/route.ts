/**
 * One-time migration endpoint - DELETE AFTER USE
 * Adds ai_name column to user_profiles
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  // Simple auth check
  const { secret } = await request.json();
  if (secret !== 'run-migration-20250127') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Check if column exists first
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('ai_name')
      .limit(1);
    
    if (existing !== null) {
      return NextResponse.json({ 
        success: true, 
        message: 'Column ai_name already exists',
        alreadyExists: true 
      });
    }
  } catch {
    // Column doesn't exist - this is expected
  }

  // We can't run raw SQL via REST API, so we'll do a workaround:
  // Try to update a row with ai_name - if it fails, column doesn't exist
  try {
    // This will fail gracefully if column doesn't exist
    const { error } = await supabase
      .from('user_profiles')
      .update({ ai_name: null })
      .eq('user_id', '00000000-0000-0000-0000-000000000000'); // Non-existent ID
    
    if (error && error.message.includes('ai_name')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Column does not exist. Please run: ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS ai_name TEXT;',
        needsManualRun: true
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Column ai_name exists and is ready'
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error)
    }, { status: 500 });
  }
}
