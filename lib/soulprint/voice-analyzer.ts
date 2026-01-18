/**
 * SoulPrint Voice Analyzer
 * 
 * Extracts cadence, rhythm, and emotional presence from voice recordings.
 * Based on the SoulPrint Cadence Transfer Protocol requirements:
 * - Tone breaks
 * - Cadence arcs
 * - Emotive fluctuation
 * - Reactivity vs Reflection
 * - Tension vs Release
 */

import Meyda from 'meyda';
import { PitchDetector } from 'pitchy';

// ============================================================================
// TYPES
// ============================================================================

export interface CadenceSnapshot {
  timestamp: number;
  pitch: number;           // Hz (0 if unvoiced)
  pitchClarity: number;    // 0-1 confidence
  energy: number;          // RMS energy (0-1)
  loudness: number;        // Perceptual loudness
  spectralCentroid: number; // Brightness
  spectralFlux: number;    // Rate of change (rhythm indicator)
  isSilent: boolean;       // Pause detected
}

export interface PauseEvent {
  startTime: number;
  endTime: number;
  duration: number;        // ms
}

export interface EmotionalSignatureCurve {
  // Core rhythm metrics
  averageTempo: 'slow' | 'measured' | 'moderate' | 'brisk' | 'rapid';
  pausePattern: 'minimal' | 'natural' | 'deliberate' | 'frequent' | 'hesitant';
  rhythmConsistency: 'steady' | 'varied' | 'erratic';
  
  // Energy dynamics
  energyProfile: 'subdued' | 'even' | 'dynamic' | 'intense';
  tensionRelease: 'flat' | 'building' | 'releasing' | 'oscillating';
  
  // Pitch/intonation
  pitchRange: 'monotone' | 'narrow' | 'expressive' | 'dramatic';
  pitchContour: 'falling' | 'rising' | 'undulating' | 'flat';
  
  // Presence indicators
  confidenceLevel: 'uncertain' | 'tentative' | 'grounded' | 'assertive';
  emotionalIntensity: 'reserved' | 'moderate' | 'engaged' | 'passionate';
  
  // Raw metrics for fine-tuning
  metrics: {
    speechDuration: number;      // total speech time (ms)
    totalDuration: number;       // recording length (ms)
    pauseCount: number;
    averagePauseDuration: number; // ms
    longestPause: number;         // ms
    wordsPerMinuteEstimate: number;
    pitchMean: number;
    pitchVariance: number;
    energyMean: number;
    energyVariance: number;
    peakMoments: number;          // count of high-energy moments
  };
}

export interface VoiceAnalysisResult {
  curve: EmotionalSignatureCurve;
  snapshots: CadenceSnapshot[];
  pauses: PauseEvent[];
  rawSummary: string;           // Human-readable summary for LLM prompt
}

// ============================================================================
// VOICE ANALYZER CLASS
// ============================================================================

export class SoulPrintVoiceAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private meydaAnalyzer: ReturnType<typeof Meyda.createMeydaAnalyzer> | null = null;
  private pitchDetector: ReturnType<typeof PitchDetector.forFloat32Array> | null = null;
  
  private snapshots: CadenceSnapshot[] = [];
  private pauses: PauseEvent[] = [];
  
  private isRecording = false;
  private startTime = 0;
  private currentPauseStart: number | null = null;
  
  // Thresholds
  private readonly SILENCE_THRESHOLD = 0.015;      // RMS below this = silence
  private readonly MIN_PAUSE_DURATION = 150;       // ms - ignore tiny gaps
  private readonly PITCH_CLARITY_THRESHOLD = 0.85; // confidence needed
  
  /**
   * Analyze an audio blob and return the Emotional Signature Curve
   */
  async analyzeBlob(audioBlob: Blob): Promise<VoiceAnalysisResult> {
    console.log('[VoiceAnalyzer] Starting analysis...');
    
    // Reset state
    this.snapshots = [];
    this.pauses = [];
    this.currentPauseStart = null;
    
    try {
      // Decode audio
      console.log('[VoiceAnalyzer] Decoding audio blob, size:', audioBlob.size);
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('[VoiceAnalyzer] ArrayBuffer size:', arrayBuffer.byteLength);
      
      this.audioContext = new AudioContext();
      console.log('[VoiceAnalyzer] AudioContext created, sample rate:', this.audioContext.sampleRate);
      
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('[VoiceAnalyzer] Audio decoded, duration:', audioBuffer.duration, 'channels:', audioBuffer.numberOfChannels);
      
      // Process the entire audio buffer
      await this.processAudioBuffer(audioBuffer);
      console.log('[VoiceAnalyzer] Processing complete, snapshots:', this.snapshots.length, 'pauses:', this.pauses.length);
      
      // Generate the curve
      const curve = this.generateEmotionalSignatureCurve();
      const rawSummary = this.generateRawSummary(curve);
      
      console.log('[VoiceAnalyzer] Curve generated:', curve);
      
      // Cleanup
      await this.audioContext.close();
      this.audioContext = null;
      
      return {
        curve,
        snapshots: this.snapshots,
        pauses: this.pauses,
        rawSummary
      };
    } catch (error) {
      console.error('[VoiceAnalyzer] Error:', error);
      // Cleanup on error
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
      }
      this.audioContext = null;
      throw error;
    }
  }
  
  /**
   * Process audio buffer in chunks for analysis
   */
  private async processAudioBuffer(audioBuffer: AudioBuffer): Promise<void> {
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0); // mono
    
    // Analysis parameters
    const bufferSize = 512;
    const hopSize = 256; // 50% overlap
    const pitchBufferSize = 2048;
    
    // Configure Meyda with the correct sample rate and buffer size
    Meyda.sampleRate = sampleRate;
    Meyda.bufferSize = bufferSize;
    
    this.pitchDetector = PitchDetector.forFloat32Array(pitchBufferSize);
    
    const totalSamples = channelData.length;
    // totalDuration is calculated later in generateEmotionalSignatureCurve from snapshots
    
    console.log('[VoiceAnalyzer] Processing', totalSamples, 'samples at', sampleRate, 'Hz');
    
    this.startTime = 0;
    let inSilence = false;
    
    // Process in chunks
    for (let i = 0; i < totalSamples - bufferSize; i += hopSize) {
      const timestamp = (i / sampleRate) * 1000; // ms
      const chunk = channelData.slice(i, i + bufferSize);
      
      // Get Meyda features - ensure we have a proper Float32Array
      let meydaFeatures: {
        rms: number;
        energy: number;
        spectralCentroid: number;
        spectralFlux: number;
        loudness: { total: number } | null;
      };
      
      try {
        meydaFeatures = Meyda.extract(
          ['rms', 'energy', 'spectralCentroid', 'spectralFlux', 'loudness'],
          chunk
        ) as unknown as typeof meydaFeatures;
      } catch {
        // If Meyda fails, calculate RMS manually
        let sum = 0;
        for (let j = 0; j < chunk.length; j++) {
          sum += chunk[j] * chunk[j];
        }
        const rms = Math.sqrt(sum / chunk.length);
        meydaFeatures = {
          rms,
          energy: rms,
          spectralCentroid: 0,
          spectralFlux: 0,
          loudness: { total: rms * 100 }
        };
      }
      
      // Get pitch (needs larger buffer)
      let pitch = 0;
      let pitchClarity = 0;
      if (i + pitchBufferSize <= totalSamples) {
        const pitchChunk = channelData.slice(i, i + pitchBufferSize);
        try {
          [pitch, pitchClarity] = this.pitchDetector.findPitch(pitchChunk, sampleRate);
          
          // Filter unreliable pitch readings
          if (pitchClarity < this.PITCH_CLARITY_THRESHOLD || pitch < 50 || pitch > 500) {
            pitch = 0;
          }
        } catch {
          pitch = 0;
          pitchClarity = 0;
        }
      }
      
      // Detect silence
      const rms = meydaFeatures?.rms ?? 0;
      const isSilent = rms < this.SILENCE_THRESHOLD;
      
      // Track pauses
      if (isSilent && !inSilence) {
        this.currentPauseStart = timestamp;
        inSilence = true;
      } else if (!isSilent && inSilence) {
        if (this.currentPauseStart !== null) {
          const pauseDuration = timestamp - this.currentPauseStart;
          if (pauseDuration >= this.MIN_PAUSE_DURATION) {
            this.pauses.push({
              startTime: this.currentPauseStart,
              endTime: timestamp,
              duration: pauseDuration
            });
          }
        }
        inSilence = false;
        this.currentPauseStart = null;
      }
      
      // Store snapshot
      this.snapshots.push({
        timestamp,
        pitch,
        pitchClarity,
        energy: meydaFeatures?.rms ?? 0,
        loudness: meydaFeatures?.loudness?.total ?? 0,
        spectralCentroid: meydaFeatures?.spectralCentroid ?? 0,
        spectralFlux: meydaFeatures?.spectralFlux ?? 0,
        isSilent
      });
    }
    
    console.log('[VoiceAnalyzer] Finished processing, total snapshots:', this.snapshots.length);
  }
  
  /**
   * Generate the Emotional Signature Curve from collected data
   */
  private generateEmotionalSignatureCurve(): EmotionalSignatureCurve {
    const speechSnapshots = this.snapshots.filter(s => !s.isSilent);
    const totalDuration = this.snapshots.length > 0 
      ? this.snapshots[this.snapshots.length - 1].timestamp 
      : 0;
    
    // Calculate speech duration (excluding pauses)
    const totalPauseDuration = this.pauses.reduce((sum, p) => sum + p.duration, 0);
    const speechDuration = totalDuration - totalPauseDuration;
    
    // Energy metrics
    const energies = speechSnapshots.map(s => s.energy);
    const energyMean = this.mean(energies);
    const energyVariance = this.variance(energies);
    const peakMoments = energies.filter(e => e > energyMean * 1.5).length;
    
    // Pitch metrics (only voiced segments)
    const pitches = speechSnapshots.filter(s => s.pitch > 0).map(s => s.pitch);
    const pitchMean = this.mean(pitches);
    const pitchVariance = this.variance(pitches);
    
    // Pause metrics
    const pauseCount = this.pauses.length;
    const avgPauseDuration = pauseCount > 0 
      ? this.pauses.reduce((sum, p) => sum + p.duration, 0) / pauseCount 
      : 0;
    const longestPause = pauseCount > 0 
      ? Math.max(...this.pauses.map(p => p.duration)) 
      : 0;
    
    // Estimate words per minute (rough: ~4 syllables per second for fast speech)
    // Using spectral flux as a proxy for syllable rate
    const fluxes = speechSnapshots.map(s => s.spectralFlux);
    const avgFlux = this.mean(fluxes);
    const estimatedSyllablesPerSecond = Math.min(6, Math.max(1, avgFlux * 50));
    const wordsPerMinuteEstimate = (estimatedSyllablesPerSecond / 1.5) * 60;
    
    // Determine qualitative descriptors
    const averageTempo = this.categorizeTempo(wordsPerMinuteEstimate);
    const pausePattern = this.categorizePausePattern(pauseCount, avgPauseDuration, totalDuration);
    const rhythmConsistency = this.categorizeRhythmConsistency(energyVariance, pitchVariance);
    const energyProfile = this.categorizeEnergyProfile(energyMean, energyVariance);
    const tensionRelease = this.categorizeTensionRelease(energies);
    const pitchRange = this.categorizePitchRange(pitchVariance);
    const pitchContour = this.categorizePitchContour(pitches);
    const confidenceLevel = this.categorizeConfidence(energyMean, pausePattern);
    const emotionalIntensity = this.categorizeEmotionalIntensity(energyVariance, pitchVariance);
    
    return {
      averageTempo,
      pausePattern,
      rhythmConsistency,
      energyProfile,
      tensionRelease,
      pitchRange,
      pitchContour,
      confidenceLevel,
      emotionalIntensity,
      metrics: {
        speechDuration,
        totalDuration,
        pauseCount,
        averagePauseDuration: avgPauseDuration,
        longestPause,
        wordsPerMinuteEstimate: Math.round(wordsPerMinuteEstimate),
        pitchMean,
        pitchVariance,
        energyMean,
        energyVariance,
        peakMoments
      }
    };
  }
  
  // ============================================================================
  // CATEGORIZATION METHODS
  // ============================================================================
  
  private categorizeTempo(wpm: number): EmotionalSignatureCurve['averageTempo'] {
    if (wpm < 100) return 'slow';
    if (wpm < 120) return 'measured';
    if (wpm < 150) return 'moderate';
    if (wpm < 180) return 'brisk';
    return 'rapid';
  }
  
  private categorizePausePattern(
    count: number, 
    avgDuration: number, 
    totalDuration: number
  ): EmotionalSignatureCurve['pausePattern'] {
    const pausesPerMinute = (count / totalDuration) * 60000;
    
    if (pausesPerMinute < 2) return 'minimal';
    if (avgDuration > 800) return 'deliberate';
    if (pausesPerMinute > 8) return 'hesitant';
    if (pausesPerMinute > 5) return 'frequent';
    return 'natural';
  }
  
  private categorizeRhythmConsistency(
    energyVar: number, 
    pitchVar: number
  ): EmotionalSignatureCurve['rhythmConsistency'] {
    const combined = energyVar + (pitchVar / 1000);
    if (combined < 0.002) return 'steady';
    if (combined > 0.01) return 'erratic';
    return 'varied';
  }
  
  private categorizeEnergyProfile(
    mean: number, 
    variance: number
  ): EmotionalSignatureCurve['energyProfile'] {
    if (mean < 0.05) return 'subdued';
    if (variance > 0.003) return 'dynamic';
    if (mean > 0.15) return 'intense';
    return 'even';
  }
  
  private categorizeTensionRelease(energies: number[]): EmotionalSignatureCurve['tensionRelease'] {
    if (energies.length < 10) return 'flat';
    
    const thirds = this.splitIntoThirds(energies);
    const avgFirst = this.mean(thirds[0]);
    const avgMiddle = this.mean(thirds[1]);
    const avgLast = this.mean(thirds[2]);
    
    const buildUp = avgLast - avgFirst;
    const oscillation = Math.abs(avgMiddle - avgFirst) + Math.abs(avgLast - avgMiddle);
    
    if (oscillation > 0.04) return 'oscillating';
    if (buildUp > 0.02) return 'building';
    if (buildUp < -0.02) return 'releasing';
    return 'flat';
  }
  
  private categorizePitchRange(variance: number): EmotionalSignatureCurve['pitchRange'] {
    if (variance < 100) return 'monotone';
    if (variance < 500) return 'narrow';
    if (variance < 2000) return 'expressive';
    return 'dramatic';
  }
  
  private categorizePitchContour(pitches: number[]): EmotionalSignatureCurve['pitchContour'] {
    if (pitches.length < 10) return 'flat';
    
    const thirds = this.splitIntoThirds(pitches);
    const avgFirst = this.mean(thirds[0]);
    const avgLast = this.mean(thirds[2]);
    const variance = this.variance(pitches);
    
    const trend = avgLast - avgFirst;
    
    if (variance > 1500) return 'undulating';
    if (trend > 15) return 'rising';
    if (trend < -15) return 'falling';
    return 'flat';
  }
  
  private categorizeConfidence(
    energyMean: number, 
    pausePattern: string
  ): EmotionalSignatureCurve['confidenceLevel'] {
    if (energyMean < 0.04 || pausePattern === 'hesitant') return 'uncertain';
    if (energyMean < 0.08 || pausePattern === 'frequent') return 'tentative';
    if (energyMean > 0.15) return 'assertive';
    return 'grounded';
  }
  
  private categorizeEmotionalIntensity(
    energyVar: number, 
    pitchVar: number
  ): EmotionalSignatureCurve['emotionalIntensity'] {
    const combined = energyVar * 100 + pitchVar / 100;
    if (combined < 0.5) return 'reserved';
    if (combined < 1.5) return 'moderate';
    if (combined < 3) return 'engaged';
    return 'passionate';
  }
  
  // ============================================================================
  // SUMMARY GENERATION
  // ============================================================================
  
  /**
   * Generate a human-readable summary for LLM prompt injection
   */
  private generateRawSummary(curve: EmotionalSignatureCurve): string {
    const { metrics } = curve;
    
    return `
EMOTIONAL SIGNATURE CURVE ANALYSIS
==================================

CADENCE PROFILE:
- Speaking tempo: ${curve.averageTempo} (~${metrics.wordsPerMinuteEstimate} WPM estimate)
- Pause pattern: ${curve.pausePattern} (${metrics.pauseCount} pauses, avg ${Math.round(metrics.averagePauseDuration)}ms)
- Rhythm: ${curve.rhythmConsistency}

ENERGY DYNAMICS:
- Overall energy: ${curve.energyProfile}
- Tension arc: ${curve.tensionRelease}
- Peak moments: ${metrics.peakMoments} high-intensity points

VOCAL PRESENCE:
- Pitch range: ${curve.pitchRange}
- Intonation contour: ${curve.pitchContour}
- Confidence indicator: ${curve.confidenceLevel}
- Emotional intensity: ${curve.emotionalIntensity}

RAW METRICS:
- Total recording: ${(metrics.totalDuration / 1000).toFixed(1)}s
- Active speech: ${(metrics.speechDuration / 1000).toFixed(1)}s
- Longest pause: ${Math.round(metrics.longestPause)}ms
- Mean pitch: ${Math.round(metrics.pitchMean)}Hz
- Pitch variance: ${Math.round(metrics.pitchVariance)}

CADENCE INSTRUCTIONS FOR AI:
This speaker exhibits ${curve.averageTempo} pacing with ${curve.pausePattern} pauses.
Their energy is ${curve.energyProfile} with ${curve.tensionRelease} tension patterns.
Match their ${curve.pitchRange} pitch range and ${curve.pitchContour} intonation.
Respond with ${curve.confidenceLevel} confidence and ${curve.emotionalIntensity} emotional engagement.
Honor their natural pause points - they use pauses ${curve.pausePattern === 'deliberate' ? 'for emphasis' : curve.pausePattern === 'hesitant' ? 'while processing' : 'naturally'}.
`.trim();
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  private mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }
  
  private variance(arr: number[]): number {
    if (arr.length === 0) return 0;
    const m = this.mean(arr);
    return arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
  }
  
  private splitIntoThirds<T>(arr: T[]): [T[], T[], T[]] {
    const third = Math.floor(arr.length / 3);
    return [
      arr.slice(0, third),
      arr.slice(third, third * 2),
      arr.slice(third * 2)
    ];
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const voiceAnalyzer = new SoulPrintVoiceAnalyzer();

// Convenience function
export async function analyzeVoice(audioBlob: Blob): Promise<VoiceAnalysisResult> {
  return voiceAnalyzer.analyzeBlob(audioBlob);
}
