/**
 * POST /api/voice/process
 * Process all voice recordings to extract Emotional Signature Curve
 * Uses Deepgram for transcription and cadence analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { EmotionalSignatureCurve, CadenceMarkers } from '@/lib/soulprint/types';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 120; // 2 minutes for processing all 6 recordings

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word?: string;
}

interface DeepgramResponse {
  results: {
    channels: Array<{
      alternatives: Array<{
        transcript: string;
        confidence: number;
        words: DeepgramWord[];
      }>;
    }>;
  };
}

async function transcribeWithDeepgram(audioUrl: string): Promise<{
  transcript: string;
  confidence: number;
  words: DeepgramWord[];
}> {
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  
  if (!deepgramKey) {
    // Fallback: return empty transcription if no Deepgram key
    console.warn('[Voice Process] No DEEPGRAM_API_KEY, skipping transcription');
    return { transcript: '', confidence: 0, words: [] };
  }

  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&diarize=false&smart_format=true', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${deepgramKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram error: ${errorText}`);
  }

  const data: DeepgramResponse = await response.json();
  const alternative = data.results?.channels?.[0]?.alternatives?.[0];

  return {
    transcript: alternative?.transcript || '',
    confidence: alternative?.confidence || 0,
    words: alternative?.words || [],
  };
}

function extractCadenceMarkers(words: DeepgramWord[], duration: number): CadenceMarkers {
  if (words.length === 0) {
    return {
      pausePoints: [],
      emphasisWords: [],
      tempoVariance: 0.5,
      averageWordsPerMinute: 0,
      emotionalPeaks: [],
      toneShifts: [],
    };
  }

  // Find pause points (gaps > 0.5 seconds between words)
  const pausePoints: number[] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > 0.5) {
      pausePoints.push(words[i].start);
    }
  }

  // Find emphasis words (longer duration relative to word length)
  const emphasisWords: string[] = [];
  const wordDurations = words.map(w => ({
    word: w.word,
    duration: w.end - w.start,
    charRatio: (w.end - w.start) / Math.max(w.word.length, 1),
  }));
  
  const avgCharRatio = wordDurations.reduce((sum, w) => sum + w.charRatio, 0) / wordDurations.length;
  for (const w of wordDurations) {
    if (w.charRatio > avgCharRatio * 1.5 && w.word.length > 2) {
      emphasisWords.push(w.word.toLowerCase());
    }
  }

  // Calculate tempo variance
  const segmentDurations: number[] = [];
  const segmentSize = Math.max(5, Math.floor(words.length / 6));
  for (let i = 0; i < words.length; i += segmentSize) {
    const segment = words.slice(i, i + segmentSize);
    if (segment.length > 1) {
      const segmentDuration = segment[segment.length - 1].end - segment[0].start;
      const wpm = (segment.length / segmentDuration) * 60;
      segmentDurations.push(wpm);
    }
  }
  
  const avgWpm = segmentDurations.reduce((sum, d) => sum + d, 0) / segmentDurations.length || 0;
  const variance = segmentDurations.reduce((sum, d) => sum + Math.pow(d - avgWpm, 2), 0) / segmentDurations.length || 0;
  const stdDev = Math.sqrt(variance);
  const tempoVariance = Math.min(1, stdDev / (avgWpm || 1));

  // Find emotional peaks (clusters of longer pauses or emphasis)
  const emotionalPeaks: number[] = [];
  for (const pause of pausePoints) {
    if (pausePoints.filter(p => Math.abs(p - pause) < 3).length >= 2) {
      if (!emotionalPeaks.some(p => Math.abs(p - pause) < 5)) {
        emotionalPeaks.push(pause);
      }
    }
  }

  return {
    pausePoints,
    emphasisWords: [...new Set(emphasisWords)].slice(0, 10),
    tempoVariance: Math.round(tempoVariance * 100) / 100,
    averageWordsPerMinute: Math.round(avgWpm),
    emotionalPeaks,
    toneShifts: [], // Would need audio analysis for this
  };
}

function calculateEmotionalCurve(
  allCadenceMarkers: CadenceMarkers[],
  totalDuration: number
): EmotionalSignatureCurve {
  // Aggregate metrics across all recordings
  const allPausePoints = allCadenceMarkers.flatMap(m => m.pausePoints);
  const allEmphasisWords = allCadenceMarkers.flatMap(m => m.emphasisWords);
  const avgTempoVariance = allCadenceMarkers.reduce((sum, m) => sum + m.tempoVariance, 0) / allCadenceMarkers.length;
  const avgWpm = allCadenceMarkers.reduce((sum, m) => sum + m.averageWordsPerMinute, 0) / allCadenceMarkers.length;

  // Calculate curve metrics
  // Reactivity (0) vs Reflection (1): More pauses = more reflective
  const pauseFrequency = allPausePoints.length / (totalDuration / 60);
  const reactivityVsReflection = Math.min(1, pauseFrequency / 10);

  // Tension (0) vs Release (1): Higher tempo variance = more tension
  const tensionVsRelease = 1 - avgTempoVariance;

  // Lateral jumps: Based on variety of emphasis words
  const uniqueEmphasis = new Set(allEmphasisWords).size;
  const lateralJumps = Math.min(1, uniqueEmphasis / 20);

  // Gut punches (0) vs Rational (1): Faster = more gut, slower = more rational
  const normalizedWpm = Math.min(1, Math.max(0, (avgWpm - 100) / 100));
  const gutPunchesVsRational = normalizedWpm;

  return {
    reactivityVsReflection: Math.round(reactivityVsReflection * 100) / 100,
    tensionVsRelease: Math.round(tensionVsRelease * 100) / 100,
    lateralJumps: Math.round(lateralJumps * 100) / 100,
    gutPunchesVsRational: Math.round(gutPunchesVsRational * 100) / 100,
    averagePauseDuration: allPausePoints.length > 0 ? 
      Math.round((totalDuration / allPausePoints.length) * 100) / 100 : 0,
    emphasisFrequency: Math.round((allEmphasisWords.length / (totalDuration / 60)) * 100) / 100,
    tempoConsistency: Math.round((1 - avgTempoVariance) * 100) / 100,
    emotionalRange: Math.round(lateralJumps * 100) / 100,
  };
}

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

    // Get all recordings
    const { data: recordings, error: fetchError } = await supabase
      .from('voice_recordings')
      .select('*')
      .eq('user_id', user.id)
      .order('pillar');

    if (fetchError || !recordings) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch recordings' },
        { status: 500 }
      );
    }

    if (recordings.length < 6) {
      return NextResponse.json(
        { success: false, error: `Only ${recordings.length}/6 recordings. Complete all voice captures first.` },
        { status: 400 }
      );
    }

    console.log(`[Voice Process] Processing ${recordings.length} recordings for user ${user.id}`);

    // Process each recording
    const allCadenceMarkers: CadenceMarkers[] = [];
    let totalDuration = 0;

    for (const recording of recordings) {
      console.log(`[Voice Process] Transcribing pillar ${recording.pillar}...`);

      // Update status
      await supabase
        .from('voice_recordings')
        .update({ status: 'transcribing' })
        .eq('id', recording.id);

      try {
        // Transcribe with Deepgram
        const { transcript, confidence, words } = await transcribeWithDeepgram(recording.cloudinary_url);

        // Extract cadence markers
        const cadenceMarkers = extractCadenceMarkers(words, recording.duration_seconds);
        allCadenceMarkers.push(cadenceMarkers);
        totalDuration += recording.duration_seconds;

        // Update recording with transcription and markers
        await supabase
          .from('voice_recordings')
          .update({
            transcription: transcript,
            transcription_confidence: confidence,
            cadence_markers: cadenceMarkers,
            status: 'complete',
            updated_at: new Date().toISOString(),
          })
          .eq('id', recording.id);

      } catch (transcribeError) {
        console.error(`[Voice Process] Error processing pillar ${recording.pillar}:`, transcribeError);
        
        await supabase
          .from('voice_recordings')
          .update({
            status: 'error',
            error_message: transcribeError instanceof Error ? transcribeError.message : 'Processing failed',
          })
          .eq('id', recording.id);

        // Continue with other recordings
        allCadenceMarkers.push({
          pausePoints: [],
          emphasisWords: [],
          tempoVariance: 0.5,
          averageWordsPerMinute: 0,
          emotionalPeaks: [],
          toneShifts: [],
        });
        totalDuration += recording.duration_seconds;
      }
    }

    // Calculate Emotional Signature Curve
    const emotionalCurve = calculateEmotionalCurve(allCadenceMarkers, totalDuration);

    // Store in database
    const { error: storeError } = await supabase
      .from('emotional_signatures')
      .upsert({
        user_id: user.id,
        reactivity_vs_reflection: emotionalCurve.reactivityVsReflection,
        tension_vs_release: emotionalCurve.tensionVsRelease,
        lateral_jumps: emotionalCurve.lateralJumps,
        gut_punches_vs_rational: emotionalCurve.gutPunchesVsRational,
        average_pause_duration: emotionalCurve.averagePauseDuration,
        emphasis_frequency: emotionalCurve.emphasisFrequency,
        tempo_consistency: emotionalCurve.tempoConsistency,
        emotional_range: emotionalCurve.emotionalRange,
        raw_analysis: { allCadenceMarkers, totalDuration },
        recordings_analyzed: recordings.length,
        model_used: 'deepgram-nova-2',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (storeError) {
      console.error('[Voice Process] Store error:', storeError);
      throw new Error('Failed to store emotional signature');
    }

    console.log(`[Voice Process] Complete for user ${user.id}`);

    return NextResponse.json({
      success: true,
      data: {
        emotionalCurve,
        recordingsAnalyzed: recordings.length,
        totalDurationSeconds: Math.round(totalDuration),
      },
    });

  } catch (error) {
    console.error('[Voice Process] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/voice/process
 * Get existing emotional signature
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

    const { data, error } = await supabase
      .from('emotional_signatures')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({
        success: true,
        data: { exists: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        exists: true,
        emotionalCurve: {
          reactivityVsReflection: data.reactivity_vs_reflection,
          tensionVsRelease: data.tension_vs_release,
          lateralJumps: data.lateral_jumps,
          gutPunchesVsRational: data.gut_punches_vs_rational,
          averagePauseDuration: data.average_pause_duration,
          emphasisFrequency: data.emphasis_frequency,
          tempoConsistency: data.tempo_consistency,
          emotionalRange: data.emotional_range,
        },
        recordingsAnalyzed: data.recordings_analyzed,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });

  } catch (error) {
    console.error('[Voice Process GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
