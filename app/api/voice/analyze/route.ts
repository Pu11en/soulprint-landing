/**
 * AssemblyAI Voice Analysis API Route
 * ====================================
 * POST /api/voice/analyze
 * 
 * Accepts audio file upload and returns full Emotional Signature Curve analysis
 * Uses AssemblyAI for production-quality transcription + sentiment analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeWithAssemblyAI,
  formatForN8N,
  generateCadenceInstructions
} from '@/lib/soulprint/assemblyai-analyzer';

export const maxDuration = 60; // Allow up to 60 seconds for processing

export async function POST(request: NextRequest) {
  try {
    // Check API key is configured
    if (!process.env.ASSEMBLYAI_API_KEY) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
        { status: 500 }
      );
    }

    // Get the audio data from the request
    const contentType = request.headers.get('content-type') || '';
    let audioBuffer: Buffer;
    let mimeType: string = 'audio/webm';

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData upload
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File;

      if (!audioFile) {
        return NextResponse.json(
          { error: 'No audio file provided' },
          { status: 400 }
        );
      }

      mimeType = audioFile.type || 'audio/webm';
      const arrayBuffer = await audioFile.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);

    } else if (contentType.includes('application/json')) {
      // Handle JSON with base64 audio
      const body = await request.json();

      if (!body.audio) {
        return NextResponse.json(
          { error: 'No audio data provided' },
          { status: 400 }
        );
      }

      // Remove data URL prefix if present
      let base64Data = body.audio;
      if (base64Data.includes(',')) {
        const parts = base64Data.split(',');
        const header = parts[0];
        base64Data = parts[1];

        // Extract mime type from data URL
        const mimeMatch = header.match(/data:([^;]+);/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      }

      audioBuffer = Buffer.from(base64Data, 'base64');
      mimeType = body.mimeType || mimeType;

    } else {
      return NextResponse.json(
        { error: 'Unsupported content type. Use multipart/form-data or application/json' },
        { status: 400 }
      );
    }

    // Validate audio size (avoid empty / effectively-empty payloads)
    if (audioBuffer.length < 128) {
      return NextResponse.json(
        { error: 'No audio captured. Please try again.' },
        { status: 400 }
      );
    }

    if (audioBuffer.length > 25 * 1024 * 1024) { // 25MB limit
      return NextResponse.json(
        { error: 'Audio file too large. Maximum 25MB.' },
        { status: 400 }
      );
    }

    // Analyze with AssemblyAI
    const startTime = Date.now();

    const result = await analyzeWithAssemblyAI(audioBuffer, mimeType);

    // Check if any speech was actually detected
    if (!result.transcript || result.words.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No speech detected. Please make sure your microphone is working and you are speaking clearly.",
        wordCount: 0,
        confidence: 0,
        transcript: ""
      }, { status: 400 });
    }

    const processingTime = Date.now() - startTime;

    // Format for response
    const n8nPayload = formatForN8N(result);
    const llmInstructions = generateCadenceInstructions(result);

    return NextResponse.json({
      success: true,
      processingTime,

      // Main results
      transcript: result.transcript,
      confidence: result.confidence,
      wordCount: result.words.length,

      // Detailed analysis - use n8nPayload's nested format for consistency
      emotionalSignature: n8nPayload.emotionalSignature,

      // For integration
      n8nPayload,
      llmInstructions,

      // Debug info
      debug: {
        transcriptId: result.rawResponse.id,
        audioDuration: result.emotionalSignature.totalDuration,
        speechDuration: result.emotionalSignature.speechDuration,
        analysisSource: 'assemblyai',
      }
    });

  } catch (error) {
    console.error('[API] Voice analysis error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific AssemblyAI errors
    if (errorMessage.includes('Invalid API key')) {
      return NextResponse.json(
        { error: 'Invalid AssemblyAI API key' },
        { status: 401 }
      );
    }

    if (errorMessage.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Analysis failed: ' + errorMessage },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'AssemblyAI Voice Analysis',
    configured: !!process.env.ASSEMBLYAI_API_KEY,
    timestamp: new Date().toISOString(),
  });
}
