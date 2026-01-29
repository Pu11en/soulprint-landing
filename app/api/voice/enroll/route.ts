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

export async function POST(request: NextRequest) {
  try {
    // Check auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log('[VoiceEnroll] User:', user.id);
    console.log('[VoiceEnroll] File:', audioFile.size, 'bytes');

    // For now, store a simple voice fingerprint using audio characteristics
    // In production, use Azure Speaker Recognition or Resemblyzer
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);
    
    // Simple fingerprint: hash of audio characteristics (placeholder for real voice embedding)
    // This will be replaced with actual voice embedding from Azure/Resemblyzer
    const simpleFingerprint = Array.from(audioBytes.slice(0, 1000))
      .reduce((a, b) => a + b, 0)
      .toString(16);

    // Store voice enrollment
    const adminSupabase = getSupabaseAdmin();
    const { error: updateError } = await adminSupabase
      .from('user_profiles')
      .update({ 
        voice_enrolled: true,
        voice_fingerprint: simpleFingerprint,
        voice_enrolled_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[VoiceEnroll] DB error:', updateError);
      return NextResponse.json({ error: 'Failed to save voice enrollment' }, { status: 500 });
    }

    console.log('[VoiceEnroll] Success for user:', user.id);
    return NextResponse.json({ success: true, message: 'Voice enrolled successfully' });
  } catch (error) {
    console.error('[VoiceEnroll] Error:', error);
    return NextResponse.json({ error: 'Voice enrollment failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = getSupabaseAdmin();
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('voice_enrolled, voice_enrolled_at')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({ 
      enrolled: profile?.voice_enrolled || false,
      enrolledAt: profile?.voice_enrolled_at || null,
    });
  } catch (error) {
    console.error('[VoiceEnroll] GET Error:', error);
    return NextResponse.json({ error: 'Failed to check enrollment' }, { status: 500 });
  }
}
