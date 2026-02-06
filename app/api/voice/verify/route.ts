import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';

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

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'expensive');
    if (rateLimited) return rateLimited;

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Get user's enrolled voice fingerprint
    const adminSupabase = getSupabaseAdmin();
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('voice_enrolled, voice_fingerprint')
      .eq('user_id', user.id)
      .single();

    if (!profile?.voice_enrolled || !profile?.voice_fingerprint) {
      // Not enrolled - assume it's the owner (they need to enroll first)
      return NextResponse.json({ 
        verified: true, 
        isOwner: true,
        reason: 'not_enrolled',
        message: 'Voice verification not set up yet'
      });
    }

    // Calculate fingerprint of incoming audio
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);
    const incomingFingerprint = Array.from(audioBytes.slice(0, 1000))
      .reduce((a, b) => a + b, 0)
      .toString(16);

    // Compare fingerprints (placeholder - in production use actual voice embedding comparison)
    // For now, we'll use a simple similarity check
    // Real implementation would use cosine similarity on voice embeddings
    const storedFingerprint = profile.voice_fingerprint;
    
    // Simple comparison - in production, this would be embedding similarity > 0.85
    const isOwner = incomingFingerprint === storedFingerprint || 
      Math.abs(parseInt(incomingFingerprint, 16) - parseInt(storedFingerprint, 16)) < 50000;

    console.log('[VoiceVerify] User:', user.id, 'isOwner:', isOwner);

    return NextResponse.json({ 
      verified: true,
      isOwner,
      confidence: isOwner ? 0.95 : 0.3,
    });
  } catch (error) {
    console.error('[VoiceVerify] Error:', error);
    return NextResponse.json({ error: 'Voice verification failed' }, { status: 500 });
  }
}
