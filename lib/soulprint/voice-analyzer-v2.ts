/**
 * SoulPrint Voice Analyzer v2
 * 
 * Combines:
 * 1. Speech-to-text transcription (Web Speech API)
 * 2. Audio cadence analysis (energy, pauses, tempo)
 * 
 * This gives us BOTH what you say AND how you say it.
 */

// ============================================================================
// TYPES
// ============================================================================

// Type for Web Speech API SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInterface {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionInstance = SpeechRecognitionInterface | null;

export interface TranscriptSegment {
  text: string;
  confidence: number;
  timestamp: number;
}

export interface CadenceMetrics {
  // Timing
  totalDuration: number;        // ms
  speechDuration: number;       // ms (excluding pauses)
  pauseCount: number;
  averagePauseDuration: number; // ms
  longestPause: number;         // ms
  
  // Energy
  averageEnergy: number;        // 0-1
  energyVariance: number;
  peakMoments: number;          // count of high-energy bursts
  
  // Tempo estimate
  wordsPerMinute: number;       // based on actual word count
  syllablesPerSecond: number;   // estimated
}

export interface EmotionalSignatureCurve {
  // Cadence Profile
  averageTempo: 'slow' | 'measured' | 'moderate' | 'brisk' | 'rapid';
  pausePattern: 'minimal' | 'natural' | 'deliberate' | 'frequent' | 'hesitant';
  rhythmConsistency: 'steady' | 'varied' | 'erratic';
  
  // Energy Dynamics
  energyProfile: 'subdued' | 'even' | 'dynamic' | 'intense';
  tensionRelease: 'flat' | 'building' | 'releasing' | 'oscillating';
  
  // Presence indicators
  confidenceLevel: 'uncertain' | 'tentative' | 'grounded' | 'assertive';
  emotionalIntensity: 'reserved' | 'moderate' | 'engaged' | 'passionate';
}

export interface VoiceAnalysisResult {
  // The actual words spoken
  transcript: string;
  transcriptSegments: TranscriptSegment[];
  wordCount: number;
  
  // Cadence analysis
  curve: EmotionalSignatureCurve;
  metrics: CadenceMetrics;
  
  // Ready-to-use for LLM
  cadenceInstructions: string;
  summary: string;
}

// ============================================================================
// SIMPLE AUDIO ANALYZER (Energy & Pauses)
// ============================================================================

interface AudioSnapshot {
  timestamp: number;
  energy: number;
  isSilent: boolean;
}

interface PauseEvent {
  startTime: number;
  endTime: number;
  duration: number;
}

async function analyzeAudioBuffer(audioBlob: Blob): Promise<{
  snapshots: AudioSnapshot[];
  pauses: PauseEvent[];
  totalDuration: number;
}> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new AudioContext();
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    const bufferSize = 512;
    const hopSize = 256;
    const silenceThreshold = 0.015;
    const minPauseDuration = 200; // ms
    
    const snapshots: AudioSnapshot[] = [];
    const pauses: PauseEvent[] = [];
    
    let inSilence = false;
    let pauseStart: number | null = null;
    
    for (let i = 0; i < channelData.length - bufferSize; i += hopSize) {
      const timestamp = (i / sampleRate) * 1000;
      const chunk = channelData.slice(i, i + bufferSize);
      
      // Calculate RMS energy
      let sum = 0;
      for (let j = 0; j < chunk.length; j++) {
        sum += chunk[j] * chunk[j];
      }
      const energy = Math.sqrt(sum / chunk.length);
      const isSilent = energy < silenceThreshold;
      
      snapshots.push({ timestamp, energy, isSilent });
      
      // Track pauses
      if (isSilent && !inSilence) {
        pauseStart = timestamp;
        inSilence = true;
      } else if (!isSilent && inSilence) {
        if (pauseStart !== null) {
          const duration = timestamp - pauseStart;
          if (duration >= minPauseDuration) {
            pauses.push({ startTime: pauseStart, endTime: timestamp, duration });
          }
        }
        inSilence = false;
        pauseStart = null;
      }
    }
    
    const totalDuration = (channelData.length / sampleRate) * 1000;
    
    return { snapshots, pauses, totalDuration };
  } finally {
    await audioContext.close();
  }
}

// ============================================================================
// SPEECH TRANSCRIPTION (Web Speech API)
// ============================================================================

export function createSpeechRecognition(): SpeechRecognitionInstance {
  if (typeof window === 'undefined') return null;

  const windowWithSpeech = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionInterface;
    webkitSpeechRecognition?: new () => SpeechRecognitionInterface;
  };
  const SpeechRecognition = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('[VoiceAnalyzer] Web Speech API not supported in this browser');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  return recognition;
}

// ============================================================================
// MAIN ANALYZER CLASS
// ============================================================================

export class SoulPrintVoiceAnalyzerV2 {
  private recognition: SpeechRecognitionInstance = null;
  private transcriptSegments: TranscriptSegment[] = [];
  private finalTranscript = '';
  private isListening = false;
  private startTime = 0;
  
  // Callbacks
  public onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  public onError?: (error: string) => void;
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.recognition = createSpeechRecognition();
      this.setupRecognition();
    }
  }
  
  private setupRecognition() {
    if (!this.recognition) return;
    
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          final += text;
          this.transcriptSegments.push({
            text: text.trim(),
            confidence: result[0].confidence,
            timestamp: Date.now() - this.startTime
          });
        } else {
          interim += text;
        }
      }

      if (final) {
        this.finalTranscript += final;
      }

      this.onTranscriptUpdate?.(this.finalTranscript + interim, !!final);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[VoiceAnalyzer] Speech recognition error:', event.error);
      this.onError?.(event.error);
    };
    
    this.recognition.onend = () => {
      // Restart if still listening (continuous mode)
      if (this.isListening) {
        try {
          this.recognition?.start();
        } catch {
          // Ignore - might already be started
        }
      }
    };
  }
  
  /**
   * Start listening for speech
   */
  startListening() {
    if (!this.recognition) {
      this.onError?.('Speech recognition not supported');
      return false;
    }
    
    this.transcriptSegments = [];
    this.finalTranscript = '';
    this.startTime = Date.now();
    this.isListening = true;
    
    try {
      this.recognition.start();
      console.log('[VoiceAnalyzer] Started listening...');
      return true;
    } catch (error) {
      console.error('[VoiceAnalyzer] Failed to start:', error);
      return false;
    }
  }
  
  /**
   * Stop listening
   */
  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    console.log('[VoiceAnalyzer] Stopped listening. Final transcript:', this.finalTranscript);
  }
  
  /**
   * Get current transcript
   */
  getTranscript(): string {
    return this.finalTranscript;
  }
  
  /**
   * Analyze a recorded audio blob combined with the transcript
   */
  async analyze(audioBlob: Blob): Promise<VoiceAnalysisResult> {
    console.log('[VoiceAnalyzer] Analyzing audio blob...');
    
    // Get audio metrics
    const { snapshots, pauses, totalDuration } = await analyzeAudioBuffer(audioBlob);
    
    // Calculate metrics
    const transcript = this.finalTranscript.trim();
    const wordCount = transcript ? transcript.split(/\s+/).length : 0;
    
    const speechSnapshots = snapshots.filter(s => !s.isSilent);
    const energies = speechSnapshots.map(s => s.energy);
    
    const totalPauseDuration = pauses.reduce((sum, p) => sum + p.duration, 0);
    const speechDuration = totalDuration - totalPauseDuration;
    
    const avgEnergy = energies.length > 0 
      ? energies.reduce((a, b) => a + b, 0) / energies.length 
      : 0;
    
    const energyVariance = energies.length > 0
      ? energies.reduce((sum, e) => sum + Math.pow(e - avgEnergy, 2), 0) / energies.length
      : 0;
    
    const peakMoments = energies.filter(e => e > avgEnergy * 1.5).length;
    
    // Calculate WPM based on actual words
    const minutesDuration = speechDuration / 60000;
    const wordsPerMinute = minutesDuration > 0 ? Math.round(wordCount / minutesDuration) : 0;
    
    const metrics: CadenceMetrics = {
      totalDuration,
      speechDuration,
      pauseCount: pauses.length,
      averagePauseDuration: pauses.length > 0 
        ? pauses.reduce((sum, p) => sum + p.duration, 0) / pauses.length 
        : 0,
      longestPause: pauses.length > 0 
        ? Math.max(...pauses.map(p => p.duration)) 
        : 0,
      averageEnergy: avgEnergy,
      energyVariance,
      peakMoments,
      wordsPerMinute,
      syllablesPerSecond: wordsPerMinute / 60 * 1.5, // rough estimate
    };
    
    // Generate curve
    const curve = this.generateCurve(metrics, pauses.length, totalDuration);
    
    // Generate summaries
    const cadenceInstructions = this.generateCadenceInstructions(curve, metrics, transcript);
    const summary = this.generateSummary(curve, wordCount);
    
    return {
      transcript,
      transcriptSegments: this.transcriptSegments,
      wordCount,
      curve,
      metrics,
      cadenceInstructions,
      summary
    };
  }
  
  private generateCurve(
    metrics: CadenceMetrics, 
    pauseCount: number, 
    totalDuration: number
  ): EmotionalSignatureCurve {
    // Tempo
    let averageTempo: EmotionalSignatureCurve['averageTempo'];
    if (metrics.wordsPerMinute < 100) averageTempo = 'slow';
    else if (metrics.wordsPerMinute < 130) averageTempo = 'measured';
    else if (metrics.wordsPerMinute < 160) averageTempo = 'moderate';
    else if (metrics.wordsPerMinute < 190) averageTempo = 'brisk';
    else averageTempo = 'rapid';
    
    // Pause pattern
    const pausesPerMinute = (pauseCount / totalDuration) * 60000;
    let pausePattern: EmotionalSignatureCurve['pausePattern'];
    if (pausesPerMinute < 2) pausePattern = 'minimal';
    else if (metrics.averagePauseDuration > 800) pausePattern = 'deliberate';
    else if (pausesPerMinute > 8) pausePattern = 'hesitant';
    else if (pausesPerMinute > 5) pausePattern = 'frequent';
    else pausePattern = 'natural';
    
    // Rhythm consistency
    let rhythmConsistency: EmotionalSignatureCurve['rhythmConsistency'];
    if (metrics.energyVariance < 0.001) rhythmConsistency = 'steady';
    else if (metrics.energyVariance > 0.005) rhythmConsistency = 'erratic';
    else rhythmConsistency = 'varied';
    
    // Energy profile
    let energyProfile: EmotionalSignatureCurve['energyProfile'];
    if (metrics.averageEnergy < 0.03) energyProfile = 'subdued';
    else if (metrics.energyVariance > 0.003) energyProfile = 'dynamic';
    else if (metrics.averageEnergy > 0.1) energyProfile = 'intense';
    else energyProfile = 'even';
    
    // Tension release (simplified)
    let tensionRelease: EmotionalSignatureCurve['tensionRelease'] = 'flat';
    if (metrics.peakMoments > 5) tensionRelease = 'oscillating';
    else if (metrics.peakMoments > 2) tensionRelease = 'building';
    
    // Confidence
    let confidenceLevel: EmotionalSignatureCurve['confidenceLevel'];
    if (metrics.averageEnergy < 0.025 || pausePattern === 'hesitant') confidenceLevel = 'uncertain';
    else if (metrics.averageEnergy < 0.05 || pausePattern === 'frequent') confidenceLevel = 'tentative';
    else if (metrics.averageEnergy > 0.1) confidenceLevel = 'assertive';
    else confidenceLevel = 'grounded';
    
    // Emotional intensity
    let emotionalIntensity: EmotionalSignatureCurve['emotionalIntensity'];
    const intensityScore = metrics.energyVariance * 1000 + metrics.peakMoments;
    if (intensityScore < 1) emotionalIntensity = 'reserved';
    else if (intensityScore < 3) emotionalIntensity = 'moderate';
    else if (intensityScore < 6) emotionalIntensity = 'engaged';
    else emotionalIntensity = 'passionate';
    
    return {
      averageTempo,
      pausePattern,
      rhythmConsistency,
      energyProfile,
      tensionRelease,
      confidenceLevel,
      emotionalIntensity
    };
  }
  
  private generateCadenceInstructions(
    curve: EmotionalSignatureCurve, 
    metrics: CadenceMetrics,
    transcript: string
  ): string {
    return `
SOULPRINT CADENCE ANALYSIS
==========================

TRANSCRIPT:
"${transcript}"

WORD COUNT: ${transcript.split(/\s+/).filter(w => w).length}
SPEAKING TIME: ${(metrics.speechDuration / 1000).toFixed(1)}s
WORDS PER MINUTE: ${metrics.wordsPerMinute}

CADENCE PROFILE:
- Tempo: ${curve.averageTempo} (${metrics.wordsPerMinute} WPM)
- Pause Pattern: ${curve.pausePattern} (${metrics.pauseCount} pauses, avg ${Math.round(metrics.averagePauseDuration)}ms)
- Rhythm: ${curve.rhythmConsistency}

ENERGY DYNAMICS:
- Energy Profile: ${curve.energyProfile}
- Tension Pattern: ${curve.tensionRelease}
- Peak Moments: ${metrics.peakMoments}

PRESENCE INDICATORS:
- Confidence: ${curve.confidenceLevel}
- Emotional Intensity: ${curve.emotionalIntensity}

CADENCE INSTRUCTIONS FOR AI:
Match this speaker's ${curve.averageTempo} speaking pace (~${metrics.wordsPerMinute} words per minute).
Use ${curve.pausePattern} pauses - ${curve.pausePattern === 'deliberate' ? 'longer pauses for emphasis' : curve.pausePattern === 'hesitant' ? 'brief pauses while processing' : 'natural conversational pauses'}.
Energy should be ${curve.energyProfile} with ${curve.tensionRelease} tension patterns.
Respond with ${curve.confidenceLevel} confidence and ${curve.emotionalIntensity} emotional engagement.
`.trim();
  }
  
  private generateSummary(curve: EmotionalSignatureCurve, wordCount: number): string {
    const tempoDesc = {
      slow: 'deliberate, contemplative pace',
      measured: 'thoughtful, measured rhythm',
      moderate: 'natural, flowing pace',
      brisk: 'energetic momentum',
      rapid: 'quick, dynamic energy'
    };
    
    const energyDesc = {
      subdued: 'soft, restrained energy',
      even: 'steady, consistent presence',
      dynamic: 'expressive variation',
      intense: 'powerful vocal presence'
    };
    
    let summary = `Your speech (${wordCount} words) shows ${tempoDesc[curve.averageTempo]} with ${energyDesc[curve.energyProfile]}`;
    
    if (curve.pausePattern === 'deliberate') {
      summary += ' — you use pauses for emphasis';
    } else if (curve.emotionalIntensity === 'passionate') {
      summary += ' — your emotional investment is clear';
    }
    
    return summary + '.';
  }
  
  /**
   * Reset for new recording
   */
  reset() {
    this.transcriptSegments = [];
    this.finalTranscript = '';
    this.isListening = false;
  }
}

// Singleton instance
let analyzerInstance: SoulPrintVoiceAnalyzerV2 | null = null;

export function getVoiceAnalyzer(): SoulPrintVoiceAnalyzerV2 {
  if (!analyzerInstance) {
    analyzerInstance = new SoulPrintVoiceAnalyzerV2();
  }
  return analyzerInstance;
}
