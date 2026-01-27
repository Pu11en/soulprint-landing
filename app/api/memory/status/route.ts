import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ 
        status: 'none',
        hasSoulprint: false,
        stats: null,
      });
    }

    // Check user_profiles for soulprint
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('import_status, total_conversations, total_messages, soulprint_generated_at')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error checking profile:', profileError);
    }

    const hasSoulprint = profile?.import_status === 'complete' || profile?.import_status === 'quick_ready';
    
    const status = hasSoulprint ? 'ready' : 
                   profile?.import_status === 'processing' ? 'processing' : 'none';

    return NextResponse.json({ 
      status,
      hasSoulprint,
      stats: profile ? {
        totalConversations: profile.total_conversations,
        totalMessages: profile.total_messages,
        generatedAt: profile.soulprint_generated_at,
      } : null,
    });
  } catch (error) {
    console.error('Memory status error:', error);
    return NextResponse.json({ 
      status: 'error',
      hasSoulprint: false,
      stats: null,
    });
  }
}
