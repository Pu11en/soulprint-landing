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

async function verifyVoice(userId: string, audioBytes: Uint8Array): Promise<{ isOwner: boolean; confidence: number }> {
  try {
    const adminSupabase = getSupabaseAdmin();
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('voice_enrolled, voice_fingerprint')
      .eq('user_id', userId)
      .single();

    if (!profile?.voice_enrolled || !profile?.voice_fingerprint) {
      // Not enrolled - assume owner
      return { isOwner: true, confidence: 1.0 };
    }

    // Simple fingerprint comparison (placeholder for real voice embedding)
    const incomingFingerprint = Array.from(audioBytes.slice(0, 1000))
      .reduce((a, b) => a + b, 0)
      .toString(16);
    
    const storedFingerprint = profile.voice_fingerprint;
    const diff = Math.abs(parseInt(incomingFingerprint, 16) - parseInt(storedFingerprint, 16));
    const isOwner = diff < 50000;

    return { isOwner, confidence: isOwner ? 0.95 : 0.3 };
  } catch {
    return { isOwner: true, confidence: 0.5 }; // Default to owner on error
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('[Transcribe] Auth error:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.log('[Transcribe] No audio file');
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log('[Transcribe] File received:', audioFile.name, audioFile.type, audioFile.size, 'bytes');

    // Get audio bytes for voice verification
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // Verify voice ownership
    const voiceCheck = await verifyVoice(user.id, audioBytes);
    console.log('[Transcribe] Voice check:', voiceCheck.isOwner ? 'OWNER' : 'IMPOSTER', 'confidence:', voiceCheck.confidence);

    // Determine file extension from MIME type
    let extension = 'webm';
    if (audioFile.type.includes('mp4') || audioFile.type.includes('m4a')) {
      extension = 'mp4';
    } else if (audioFile.type.includes('ogg')) {
      extension = 'ogg';
    } else if (audioFile.type.includes('wav')) {
      extension = 'wav';
    }

    // Send to OpenAI Whisper
    const openaiFormData = new FormData();
    // Recreate the file from buffer since we consumed it
    const newFile = new File([audioBuffer], `audio.${extension}`, { type: audioFile.type });
    openaiFormData.append('file', newFile, `audio.${extension}`);
    openaiFormData.append('model', 'whisper-1');

    console.log('[Transcribe] Sending to OpenAI...');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openaiFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Transcribe] OpenAI error:', response.status, error);
      return NextResponse.json({ error: 'Transcription failed', details: error }, { status: 500 });
    }

    const data = await response.json();
    console.log('[Transcribe] Success:', data.text?.slice(0, 50) + '...');
    
    return NextResponse.json({ 
      text: data.text,
      voiceVerified: voiceCheck.isOwner,
      voiceConfidence: voiceCheck.confidence,
    });
  } catch (error) {
    console.error('[Transcribe] Error:', error);
    return NextResponse.json({ error: 'Transcription failed', details: String(error) }, { status: 500 });
  }
}
