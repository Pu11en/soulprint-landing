/**
 * AssemblyAI Voice Analyzer for SoulPrint
 * ========================================
 * Production-quality voice analysis using AssemblyAI API
 * 
 * Features:
 * - 99%+ transcription accuracy
 * - Sentiment analysis per sentence
 * - Filler word detection (um, uh, like, you know)
 * - Word-level timestamps for precise cadence analysis
 * - Speaker diarization (future: multi-speaker)
 * 
 * This runs SERVER-SIDE only to protect the API key
 */

import { AssemblyAI, type SentimentAnalysisResult } from 'assemblyai';

// Initialize client (server-side only)
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY || '',
});

// Common filler words to detect
const FILLER_WORDS = new Set([
  'um', 'uh', 'uhh', 'umm', 'er', 'ah', 'ahh',
  'like', 'you know', 'basically', 'actually',
  'literally', 'honestly', 'right', 'so', 'well',
  'i mean', 'kind of', 'sort of', 'stuff like that'
]);

export interface AssemblyAIAnalysisResult {
  // Core transcript
  transcript: string;
  confidence: number;
  
  // Word-level data for cadence
  words: {
    text: string;
    start: number;  // ms
    end: number;    // ms
    confidence: number;
  }[];
  
  // Emotional Signature Curve™ data
  emotionalSignature: {
    // Tempo metrics
    wordsPerMinute: number;
    averageWordDuration: number;  // ms
    
    // Pause analysis
    pauseCount: number;
    totalPauseTime: number;       // ms
    averagePauseLength: number;   // ms
    longestPause: number;         // ms
    pauseDistribution: {
      short: number;   // < 300ms
      medium: number;  // 300-800ms
      long: number;    // > 800ms
    };
    
    // Filler word analysis
    fillerWords: {
      word: string;
      count: number;
      timestamps: number[];  // when they occurred (ms)
    }[];
    totalFillerCount: number;
    fillerRatio: number;  // fillers per 100 words
    
    // Sentiment analysis
    sentiments: {
      text: string;
      sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
      confidence: number;
      start: number;
      end: number;
    }[];
    overallSentiment: {
      positive: number;  // percentage
      negative: number;
      neutral: number;
    };
    sentimentVariability: number;  // how much sentiment changes
    
    // Confidence patterns
    averageConfidence: number;
    confidenceVariability: number;
    lowConfidenceSegments: { start: number; end: number; text: string }[];
    
    // Speech rhythm
    rushingIndicators: number;     // fast bursts followed by pauses
    hesitationIndicators: number;  // pauses before certain words
    
    // Duration
    totalDuration: number;  // ms
    speechDuration: number; // ms (excluding pauses)
    silenceRatio: number;   // percentage of time silent
  };
  
  // Raw data for debugging/future use
  rawResponse: {
    id: string;
    audioUrl: string;
    status: string;
  };
}

/**
 * Analyze audio file using AssemblyAI
 * @param audioData - Audio file as Buffer or base64 string
 * @param _mimeType - Audio MIME type (audio/webm, audio/wav, etc.) - reserved for future use
 */
export async function analyzeWithAssemblyAI(
  audioData: Buffer | string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _mimeType: string = 'audio/webm'
): Promise<AssemblyAIAnalysisResult> {
  
  // Convert base64 to buffer if needed
  const audioBuffer = typeof audioData === 'string' 
    ? Buffer.from(audioData, 'base64')
    : audioData;
  
  // Upload and transcribe with all features enabled
  const transcript = await client.transcripts.transcribe({
    audio: audioBuffer,
    sentiment_analysis: true,
    // word_boost: ['soulprint', 'ai', 'personality'],  // boost accuracy for domain words
  });
  
  if (transcript.status === 'error') {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
  }

  // Extract words
  const words = (transcript.words || []).map(w => ({
    text: w.text,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
  }));
  
  // Calculate emotional signature
  const emotionalSignature = calculateEmotionalSignature(
    words,
    transcript.sentiment_analysis_results || [],
    transcript.audio_duration || 0
  );
  
  return {
    transcript: transcript.text || '',
    confidence: transcript.confidence || 0,
    words,
    emotionalSignature,
    rawResponse: {
      id: transcript.id,
      audioUrl: transcript.audio_url || '',
      status: transcript.status,
    },
  };
}

/**
 * Calculate the full Emotional Signature Curve from word data
 */
function calculateEmotionalSignature(
  words: AssemblyAIAnalysisResult['words'],
  sentiments: SentimentAnalysisResult[],
  audioDurationSec: number
): AssemblyAIAnalysisResult['emotionalSignature'] {
  
  const audioDuration = audioDurationSec * 1000; // convert to ms
  
  if (words.length === 0) {
    return getEmptySignature(audioDuration);
  }
  
  // === TEMPO METRICS ===
  const totalWordDuration = words.reduce((sum, w) => sum + (w.end - w.start), 0);
  const averageWordDuration = totalWordDuration / words.length;
  const speechDuration = words[words.length - 1].end - words[0].start;
  const wordsPerMinute = (words.length / speechDuration) * 60000;
  
  // === PAUSE ANALYSIS ===
  const pauses: number[] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > 150) {  // Count gaps > 150ms as pauses
      pauses.push(gap);
    }
  }
  
  const pauseCount = pauses.length;
  const totalPauseTime = pauses.reduce((sum, p) => sum + p, 0);
  const averagePauseLength = pauseCount > 0 ? totalPauseTime / pauseCount : 0;
  const longestPause = pauseCount > 0 ? Math.max(...pauses) : 0;
  
  const pauseDistribution = {
    short: pauses.filter(p => p < 300).length,
    medium: pauses.filter(p => p >= 300 && p <= 800).length,
    long: pauses.filter(p => p > 800).length,
  };
  
  // === FILLER WORD ANALYSIS ===
  const fillerMap = new Map<string, { count: number; timestamps: number[] }>();
  
  words.forEach(word => {
    const lower = word.text.toLowerCase().replace(/[^a-z\s]/g, '');
    if (FILLER_WORDS.has(lower)) {
      const existing = fillerMap.get(lower) || { count: 0, timestamps: [] };
      existing.count++;
      existing.timestamps.push(word.start);
      fillerMap.set(lower, existing);
    }
  });
  
  const fillerWords = Array.from(fillerMap.entries()).map(([word, data]) => ({
    word,
    count: data.count,
    timestamps: data.timestamps,
  }));
  
  const totalFillerCount = fillerWords.reduce((sum, f) => sum + f.count, 0);
  const fillerRatio = (totalFillerCount / words.length) * 100;
  
  // === SENTIMENT ANALYSIS ===
  const processedSentiments = sentiments.map(s => ({
    text: s.text,
    sentiment: s.sentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL',
    confidence: s.confidence,
    start: s.start,
    end: s.end,
  }));
  
  const sentimentCounts = {
    positive: sentiments.filter(s => s.sentiment === 'POSITIVE').length,
    negative: sentiments.filter(s => s.sentiment === 'NEGATIVE').length,
    neutral: sentiments.filter(s => s.sentiment === 'NEUTRAL').length,
  };
  
  const totalSentiments = sentiments.length || 1;
  const overallSentiment = {
    positive: (sentimentCounts.positive / totalSentiments) * 100,
    negative: (sentimentCounts.negative / totalSentiments) * 100,
    neutral: (sentimentCounts.neutral / totalSentiments) * 100,
  };
  
  // Sentiment variability - how much it changes
  let sentimentChanges = 0;
  for (let i = 1; i < sentiments.length; i++) {
    if (sentiments[i].sentiment !== sentiments[i - 1].sentiment) {
      sentimentChanges++;
    }
  }
  const sentimentVariability = sentiments.length > 1 
    ? sentimentChanges / (sentiments.length - 1) 
    : 0;
  
  // === CONFIDENCE PATTERNS ===
  const avgConfidence = words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
  
  const confidenceVariances = words.map(w => Math.pow(w.confidence - avgConfidence, 2));
  const confidenceVariability = Math.sqrt(
    confidenceVariances.reduce((sum, v) => sum + v, 0) / words.length
  );
  
  // Find low confidence segments (words with < 0.7 confidence)
  const lowConfidenceSegments: { start: number; end: number; text: string }[] = [];
  let currentLowSegment: typeof lowConfidenceSegments[0] | null = null;
  
  words.forEach(word => {
    if (word.confidence < 0.7) {
      if (!currentLowSegment) {
        currentLowSegment = { start: word.start, end: word.end, text: word.text };
      } else {
        currentLowSegment.end = word.end;
        currentLowSegment.text += ' ' + word.text;
      }
    } else if (currentLowSegment) {
      lowConfidenceSegments.push(currentLowSegment);
      currentLowSegment = null;
    }
  });
  if (currentLowSegment) {
    lowConfidenceSegments.push(currentLowSegment);
  }
  
  // === SPEECH RHYTHM ===
  // Rushing: fast word sequences followed by long pauses
  let rushingIndicators = 0;
  for (let i = 3; i < words.length; i++) {
    const recentGaps = [
      words[i - 2].start - words[i - 3].end,
      words[i - 1].start - words[i - 2].end,
      words[i].start - words[i - 1].end,
    ];
    const avgRecentGap = recentGaps.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    if (avgRecentGap < 200 && recentGaps[2] > 600) {
      rushingIndicators++;
    }
  }
  
  // Hesitation: long pause before a word (thinking before speaking)
  let hesitationIndicators = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > 400 && gap < 1500) {
      hesitationIndicators++;
    }
  }
  
  const silenceRatio = audioDuration > 0 
    ? ((audioDuration - speechDuration + totalPauseTime) / audioDuration) * 100
    : 0;
  
  return {
    wordsPerMinute: Math.round(wordsPerMinute),
    averageWordDuration: Math.round(averageWordDuration),
    pauseCount,
    totalPauseTime: Math.round(totalPauseTime),
    averagePauseLength: Math.round(averagePauseLength),
    longestPause: Math.round(longestPause),
    pauseDistribution,
    fillerWords,
    totalFillerCount,
    fillerRatio: Math.round(fillerRatio * 100) / 100,
    sentiments: processedSentiments,
    overallSentiment: {
      positive: Math.round(overallSentiment.positive),
      negative: Math.round(overallSentiment.negative),
      neutral: Math.round(overallSentiment.neutral),
    },
    sentimentVariability: Math.round(sentimentVariability * 100) / 100,
    averageConfidence: Math.round(avgConfidence * 100) / 100,
    confidenceVariability: Math.round(confidenceVariability * 100) / 100,
    lowConfidenceSegments,
    rushingIndicators,
    hesitationIndicators,
    totalDuration: Math.round(audioDuration),
    speechDuration: Math.round(speechDuration),
    silenceRatio: Math.round(silenceRatio),
  };
}

/**
 * Get empty signature for no-speech case
 */
function getEmptySignature(duration: number): AssemblyAIAnalysisResult['emotionalSignature'] {
  return {
    wordsPerMinute: 0,
    averageWordDuration: 0,
    pauseCount: 0,
    totalPauseTime: 0,
    averagePauseLength: 0,
    longestPause: 0,
    pauseDistribution: { short: 0, medium: 0, long: 0 },
    fillerWords: [],
    totalFillerCount: 0,
    fillerRatio: 0,
    sentiments: [],
    overallSentiment: { positive: 0, negative: 0, neutral: 100 },
    sentimentVariability: 0,
    averageConfidence: 0,
    confidenceVariability: 0,
    lowConfidenceSegments: [],
    rushingIndicators: 0,
    hesitationIndicators: 0,
    totalDuration: duration,
    speechDuration: 0,
    silenceRatio: 100,
  };
}

/**
 * Generate LLM instructions for mimicking the user's speech style
 * Based on the Emotional Signature Curve data
 */
export function generateCadenceInstructions(
  result: AssemblyAIAnalysisResult
): string {
  const sig = result.emotionalSignature;
  const lines: string[] = [];
  
  lines.push('## Voice Cadence Analysis (AssemblyAI)');
  lines.push('');
  
  // Tempo description
  if (sig.wordsPerMinute > 160) {
    lines.push('**Tempo:** Fast speaker (~' + sig.wordsPerMinute + ' WPM). Use shorter, punchy sentences. Keep responses energetic.');
  } else if (sig.wordsPerMinute > 120) {
    lines.push('**Tempo:** Moderate speaker (~' + sig.wordsPerMinute + ' WPM). Use balanced sentence lengths.');
  } else {
    lines.push('**Tempo:** Deliberate speaker (~' + sig.wordsPerMinute + ' WPM). Allow for thoughtful pauses. Use measured, complete thoughts.');
  }
  
  // Pause style
  if (sig.pauseDistribution.long > sig.pauseDistribution.short) {
    lines.push('**Rhythm:** Uses long pauses for emphasis. Include strategic breaks between thoughts.');
  } else if (sig.hesitationIndicators > 3) {
    lines.push('**Rhythm:** Thinks before speaking. Allow space for reflection in responses.');
  } else {
    lines.push('**Rhythm:** Flows continuously with minimal pauses. Keep responses smooth and connected.');
  }
  
  // Filler words
  if (sig.fillerRatio > 5) {
    lines.push('**Verbal style:** Uses filler words naturally (' + sig.fillerWords.map(f => f.word).join(', ') + '). This suggests a conversational, authentic tone.');
  } else {
    lines.push('**Verbal style:** Clean, polished speech with few fillers. Match with precise, clear responses.');
  }
  
  // Sentiment
  if (sig.overallSentiment.positive > 60) {
    lines.push('**Emotional tone:** Predominantly positive. Match with warm, encouraging responses.');
  } else if (sig.overallSentiment.negative > 40) {
    lines.push('**Emotional tone:** Cautious or analytical. Match with measured, thoughtful responses.');
  } else {
    lines.push('**Emotional tone:** Neutral/balanced. Match with objective, informative responses.');
  }
  
  if (sig.sentimentVariability > 0.5) {
    lines.push('**Emotional range:** Expressive, emotions shift. Allow for dynamic, varied responses.');
  }
  
  // Confidence patterns
  if (sig.confidenceVariability > 0.1) {
    lines.push('**Certainty patterns:** Variable confidence in speech. Some topics trigger more hesitation.');
  }
  
  // Rushing indicators
  if (sig.rushingIndicators > 2) {
    lines.push('**Note:** Tends to rush through thoughts then pause. Mirror this burst-pause pattern.');
  }
  
  return lines.join('\n');
}

/**
 * Format result for n8n webhook payload
 */
export function formatForN8N(result: AssemblyAIAnalysisResult) {
  return {
    transcript: result.transcript,
    confidence: result.confidence,
    wordCount: result.words.length,
    emotionalSignature: {
      tempo: {
        wpm: result.emotionalSignature.wordsPerMinute,
        avgWordDuration: result.emotionalSignature.averageWordDuration,
      },
      pauses: {
        count: result.emotionalSignature.pauseCount,
        avgLength: result.emotionalSignature.averagePauseLength,
        longest: result.emotionalSignature.longestPause,
        distribution: result.emotionalSignature.pauseDistribution,
      },
      fillers: {
        total: result.emotionalSignature.totalFillerCount,
        ratio: result.emotionalSignature.fillerRatio,
        breakdown: result.emotionalSignature.fillerWords,
      },
      sentiment: {
        overall: result.emotionalSignature.overallSentiment,
        variability: result.emotionalSignature.sentimentVariability,
        breakdown: result.emotionalSignature.sentiments,
      },
      confidence: {
        average: result.emotionalSignature.averageConfidence,
        variability: result.emotionalSignature.confidenceVariability,
        uncertainSegments: result.emotionalSignature.lowConfidenceSegments,
      },
      rhythm: {
        rushing: result.emotionalSignature.rushingIndicators,
        hesitation: result.emotionalSignature.hesitationIndicators,
        silenceRatio: result.emotionalSignature.silenceRatio,
      },
      duration: {
        total: result.emotionalSignature.totalDuration,
        speech: result.emotionalSignature.speechDuration,
      },
    },
    llmInstructions: generateCadenceInstructions(result),
    analysisSource: 'assemblyai',
    timestamp: new Date().toISOString(),
  };
}
