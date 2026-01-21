/**
 * Audio Analysis API Route
 * 
 * Accepts audio uploads, runs prosodic analysis, generates cadence summaries,
 * and sends results to the automation webhook.
 * 
 * POST /api/audio/analyze
 * 
 * Request: multipart/form-data
 *   - audio: File (audio/webm, audio/wav, audio/mpeg)
 *   - userId: string
 *   - pillarId: string (SoulPrint pillar identifier)
 * 
 * Response: JSON with prosodic features and cadence summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Resolve ffmpeg path manually - ffmpeg-static has issues with path resolution in some environments
function getFfmpegPath(): string {
  // Try to find ffmpeg-static in node_modules
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    'ffmpeg', // Fallback to system ffmpeg
  ];
  
  for (const p of possiblePaths) {
    if (p === 'ffmpeg' || existsSync(p)) {
      return p;
    }
  }
  return 'ffmpeg';
}
import { randomBytes } from 'crypto';
import { ProsodyFeatures, ProsodyAnalysis, SoulPrintPillar } from '@/lib/prosody/types';
import { analyzeCadence } from '@/lib/prosody/cadence-summary';
import { sendToAutomationWebhookAsync } from '@/lib/prosody/webhook';

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max
const ALLOWED_TYPES = ['audio/webm', 'audio/wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/ogg'];
// Use a project-local tmp folder by default for cross-platform compatibility
const TEMP_DIR = process.env.AUDIO_TEMP_DIR || path.join(process.cwd(), 'tmp', 'soulprint-audio');
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const PROSODY_SCRIPT = path.join(process.cwd(), 'backend', 'prosody', 'run_prosody.py');

/**
 * Ensure temp directory exists
 */
async function ensureTempDir(): Promise<void> {
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true });
  }
}

/**
 * Generate a unique temporary file path
 */
function generateTempPath(extension: string): string {
  const id = randomBytes(8).toString('hex');
  return path.join(TEMP_DIR, `audio_${id}${extension}`);
}

/**
 * Get file extension from content type
 */
function getExtensionFromType(contentType: string): string {
  const map: Record<string, string> = {
    'audio/webm': '.webm',
    'audio/wav': '.wav',
    'audio/wave': '.wav',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/ogg': '.ogg',
  };
  return map[contentType] || '.wav';
}

/**
 * Convert audio to WAV format using ffmpeg
 */
async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Get ffmpeg path (bundled or system)
    const ffmpegBin = getFfmpegPath();

    const ffmpeg = spawn(ffmpegBin, [
      '-i', inputPath,
      '-ar', '16000',      // Sample rate
      '-ac', '1',          // Mono
      '-f', 'wav',         // Output format
      '-y',                // Overwrite
      outputPath
    ]);
    
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg conversion failed: ${stderr}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(new Error(`ffmpeg not found or failed to start: ${err.message}`));
    });
  });
}

/**
 * Run the Python prosody analysis script
 */
async function runProsodyAnalysis(audioPath: string): Promise<ProsodyFeatures> {
  return new Promise((resolve, reject) => {
    const process = spawn(PYTHON_PATH, [PROSODY_SCRIPT, audioPath]);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        try {
          const features = JSON.parse(stdout) as ProsodyFeatures;
          resolve(features);
        } catch {
          reject(new Error(`Failed to parse prosody output: ${stdout}`));
        }
      } else {
        reject(new Error(`Prosody analysis failed (code ${code}): ${stderr || stdout}`));
      }
    });
    
    process.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}. Ensure Python is installed with required dependencies.`));
    });
  });
}

/**
 * Clean up temporary files
 */
async function cleanupFiles(...paths: string[]): Promise<void> {
  for (const filePath of paths) {
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * POST handler for audio analysis
 */
export async function POST(request: NextRequest) {
  let tempInputPath = '';
  let tempWavPath = '';
  
  try {
    // Parse multipart form data
    const formData = await request.formData();
    
    const audioFile = formData.get('audio') as File | null;
    const userId = formData.get('userId') as string | null;
    const pillarId = formData.get('pillarId') as string | null;
    
    // Validate required fields
    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }
    
    if (!pillarId) {
      return NextResponse.json(
        { success: false, error: 'pillarId is required' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const contentType = audioFile.type;
    // Extract base MIME type (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    const baseMimeType = contentType.split(';')[0].trim();
    
    if (!ALLOWED_TYPES.includes(baseMimeType)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid audio type: ${contentType}. Allowed: ${ALLOWED_TYPES.join(', ')}` 
        },
        { status: 400 }
      );
    }
    
    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` 
        },
        { status: 400 }
      );
    }
    
    // Ensure temp directory exists
    await ensureTempDir();
    
    // Save uploaded file
    const extension = getExtensionFromType(baseMimeType);
    tempInputPath = generateTempPath(extension);
    const arrayBuffer = await audioFile.arrayBuffer();
    await writeFile(tempInputPath, Buffer.from(arrayBuffer));
    
    // Convert to WAV if needed
    let analysisPath = tempInputPath;
    if (extension !== '.wav') {
      tempWavPath = generateTempPath('.wav');
      try {
        await convertToWav(tempInputPath, tempWavPath);
        analysisPath = tempWavPath;
      } catch (conversionError) {
        console.error('FFmpeg conversion failed:', conversionError);
        await cleanupFiles(tempInputPath, tempWavPath);
        return NextResponse.json(
          {
            success: false,
            error: 'Audio conversion failed. Please ensure ffmpeg is available or install the bundled binary via npm (ffmpeg-static).',
          },
          { status: 500 }
        );
      }
    }
    
    // Run prosody analysis
    const features = await runProsodyAnalysis(analysisPath);
    
    // Generate cadence summary
    const { traits, summary } = analyzeCadence(features);
    
    // Build response
    const analysis: ProsodyAnalysis = {
      userId,
      pillarId: pillarId as SoulPrintPillar,
      features,
      cadenceSummary: summary,
      cadenceTraits: traits,
      createdAt: new Date().toISOString(),
    };
    
    // Send to webhook asynchronously (don't block response)
    const { analysisId } = sendToAutomationWebhookAsync(
      userId,
      pillarId,
      features,
      summary,
      traits
    );
    
    analysis.analysisId = analysisId;
    
    // Cleanup temp files
    await cleanupFiles(tempInputPath, tempWavPath);
    
    return NextResponse.json({
      success: true,
      data: analysis,
    });
    
  } catch (error) {
    // Cleanup on error
    await cleanupFiles(tempInputPath, tempWavPath);
    
    console.error('Audio analysis error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - return API info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/audio/analyze',
    method: 'POST',
    contentType: 'multipart/form-data',
    fields: {
      audio: 'File (audio/webm, audio/wav, audio/mpeg)',
      userId: 'string (required)',
      pillarId: 'string (required) - SoulPrint pillar ID',
    },
    pillars: [
      'communication_style',
      'emotional_alignment', 
      'decision_risk',
      'social_cultural',
      'cognitive_processing',
      'assertiveness_conflict',
    ],
    response: {
      success: 'boolean',
      data: {
        userId: 'string',
        pillarId: 'string',
        features: 'ProsodyFeatures object',
        cadenceSummary: 'Natural language description',
        cadenceTraits: 'Qualitative traits object',
        createdAt: 'ISO timestamp',
        analysisId: 'Unique analysis identifier',
      },
    },
  });
}
