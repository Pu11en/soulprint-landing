/**
 * POST /api/voice/upload
 * Upload voice recording for a pillar micro-story
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { v2 as cloudinary } from 'cloudinary';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    // Auth
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'expensive');
    if (rateLimited) return rateLimited;

    // Parse form data
    const formData = await request.formData();
    const pillar = parseInt(formData.get('pillar') as string);
    const audioFile = formData.get('audio') as File;
    const duration = parseFloat(formData.get('duration') as string) || 0;

    // Validate
    if (!pillar || pillar < 1 || pillar > 6) {
      return NextResponse.json(
        { success: false, error: 'Invalid pillar (1-6 required)' },
        { status: 400 }
      );
    }

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Audio file required' },
        { status: 400 }
      );
    }

    // Check file size (max 25MB)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Audio file too large (max 25MB)' },
        { status: 400 }
      );
    }

    console.log(`[Voice Upload] User ${user.id}, pillar ${pillar}, size ${audioFile.size}`);

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const uploadResult = await new Promise<{
      secure_url: string;
      public_id: string;
      duration?: number;
      bytes: number;
    }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'video', // Cloudinary uses 'video' for audio
          folder: `soulprint/voice/${user.id}`,
          public_id: `pillar_${pillar}`,
          overwrite: true,
          format: 'mp3', // Convert to mp3 for compatibility
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as any);
        }
      ).end(buffer);
    });

    console.log(`[Voice Upload] Cloudinary upload complete: ${uploadResult.public_id}`);

    // Store in database
    const { error: dbError } = await supabase
      .from('voice_recordings')
      .upsert({
        user_id: user.id,
        pillar,
        cloudinary_url: uploadResult.secure_url,
        cloudinary_public_id: uploadResult.public_id,
        duration_seconds: uploadResult.duration || duration,
        file_size_bytes: uploadResult.bytes,
        mime_type: 'audio/mp3',
        status: 'uploaded',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,pillar' });

    if (dbError) {
      console.error('[Voice Upload] Database error:', dbError);
      throw new Error('Failed to save recording metadata');
    }

    // Check if all 6 recordings exist
    const { count: recordingCount } = await supabase
      .from('voice_recordings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const allRecorded = (recordingCount || 0) >= 6;

    // Update user profile
    await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        voice_recordings_count: recordingCount || 0,
        voice_completed: allRecorded,
        voice_completed_at: allRecorded ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    return NextResponse.json({
      success: true,
      data: {
        pillar,
        cloudinaryUrl: uploadResult.secure_url,
        durationSeconds: uploadResult.duration || duration,
        fileSizeBytes: uploadResult.bytes,
        totalRecordings: recordingCount || 0,
        allRecorded,
      },
    });

  } catch (error) {
    console.error('[Voice Upload] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/voice/upload
 * Get recording status for all pillars
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: recordings, error } = await supabase
      .from('voice_recordings')
      .select('pillar, cloudinary_url, duration_seconds, status, transcription')
      .eq('user_id', user.id)
      .order('pillar');

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch recordings' },
        { status: 500 }
      );
    }

    const recorded = new Set(recordings?.map(r => r.pillar) || []);

    return NextResponse.json({
      success: true,
      data: {
        recordings: recordings || [],
        recordedPillars: Array.from(recorded),
        totalRecordings: recordings?.length || 0,
        allRecorded: (recordings?.length || 0) >= 6,
      },
    });

  } catch (error) {
    console.error('[Voice Upload GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
