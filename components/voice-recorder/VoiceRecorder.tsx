"use client";

/**
 * Voice Recorder Component
 * 
 * A React component for recording voice input using the browser's MediaRecorder API.
 * Used in the SoulPrint questionnaire for capturing micro-stories.
 * 
 * Features:
 * - Start/stop/re-record controls
 * - Visual feedback during recording
 * - Real-time energy visualization
 * - Duration tracking
 * - Browser-based voice analysis (no server-side processing needed)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, RotateCcw, Send, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analyzeVoice, type EmotionalSignatureCurve } from '@/lib/soulprint/voice-analyzer';

interface VoiceRecorderProps {
  userId?: string;
  pillarId?: string;
  onRecordingComplete?: (blob: Blob, duration: number) => void;
  onAnalysisComplete?: (result: VoiceAnalysisResultExtended) => void;
  onError?: (error: string) => void;
  minDuration?: number;  // Minimum recording duration in seconds (default: 1)
  maxDuration?: number;  // Maximum recording duration in seconds
  autoSubmit?: boolean;  // Automatically submit after recording stops
  prompt?: string;       // What to tell the user to talk about
  disabled?: boolean;
}

export interface VoiceAnalysisResultExtended {
  success: boolean;
  cadenceSummary?: string;
  curve?: EmotionalSignatureCurve;
  rawSummary?: string;
  error?: string;
}

// Keep backward-compatible export
export type VoiceAnalysisResult = VoiceAnalysisResultExtended;

type RecordingState = 'idle' | 'recording' | 'recorded' | 'analyzing' | 'success' | 'error';

export function VoiceRecorder({
  onRecordingComplete,
  onAnalysisComplete,
  onError,
  minDuration = 1,
  maxDuration = 120,
  autoSubmit = false,
  prompt,
  disabled = false,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<VoiceAnalysisResultExtended | null>(null);
  const [liveEnergy, setLiveEnergy] = useState<number>(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [audioUrl]);
  
  // Auto-stop at max duration
  useEffect(() => {
    if (state === 'recording' && duration >= maxDuration) {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, maxDuration, state]);
  
  /**
   * Start recording audio
   */
  const startRecording = useCallback(async () => {
    try {
      setErrorMessage(null);
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;
      
      // Set up audio context for live visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Start live energy visualization
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateEnergy = () => {
        if (analyserRef.current && state === 'recording') {
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setLiveEnergy(avg / 255); // Normalize to 0-1
          animationFrameRef.current = requestAnimationFrame(updateEnergy);
        }
      };
      
      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        // Stop animation
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        setLiveEnergy(0);
        
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        
        // Create playback URL
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        const finalDuration = (Date.now() - startTimeRef.current) / 1000;
        
        if (finalDuration < minDuration) {
          setErrorMessage(`Recording too short. Please record at least ${minDuration} seconds.`);
          setState('idle');
          return;
        }
        
        setState('recorded');
        onRecordingComplete?.(blob, finalDuration);
        
        // Auto-analyze if enabled
        if (autoSubmit) {
          analyzeRecording(blob);
        }
      };
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      startTimeRef.current = Date.now();
      setDuration(0);
      setState('recording');
      
      // Start live energy tracking after state change
      setTimeout(() => {
        animationFrameRef.current = requestAnimationFrame(updateEnergy);
      }, 0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to access microphone';
      setErrorMessage(message);
      onError?.(message);
      setState('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDuration, autoSubmit, audioUrl, onRecordingComplete, onError, state]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);
  
  /**
   * Reset and allow re-recording
   */
  const resetRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setErrorMessage(null);
    setAnalysisResult(null);
    setState('idle');
  }, [audioUrl]);
  
  /**
   * Analyze recording using browser-based SoulPrint analyzer
   */
  const analyzeRecording = useCallback(async (blob?: Blob) => {
    const recordingBlob = blob || audioBlob;
    
    if (!recordingBlob) {
      setErrorMessage('No recording to analyze');
      return;
    }
    
    setState('analyzing');
    setErrorMessage(null);
    
    try {
      console.log('[VoiceRecorder] Starting analysis, blob size:', recordingBlob.size, 'type:', recordingBlob.type);
      
      // Use browser-based analysis - no server needed!
      const result = await analyzeVoice(recordingBlob);
      
      console.log('[VoiceRecorder] Analysis result:', result);
      
      // Generate a short, human-friendly summary
      const shortSummary = generateShortSummary(result.curve);
      
      const analysisResult: VoiceAnalysisResultExtended = {
        success: true,
        cadenceSummary: shortSummary,
        curve: result.curve,
        rawSummary: result.rawSummary,
      };
      
      setAnalysisResult(analysisResult);
      setState('success');
      onAnalysisComplete?.(analysisResult);
      
      // Log for debugging
      console.log('[SoulPrint Voice Analysis]', {
        curve: result.curve,
        rawSummary: result.rawSummary
      });
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed';
      setAnalysisResult({ success: false, error: message });
      setErrorMessage(message);
      setState('error');
      onError?.(message);
    }
  }, [audioBlob, onAnalysisComplete, onError]);
  
  /**
   * Generate a short, user-friendly summary of the emotional signature
   */
  const generateShortSummary = (curve: EmotionalSignatureCurve): string => {
    const parts: string[] = [];
    
    // Tempo description
    const tempoMap = {
      slow: 'Your speech has a deliberate, contemplative pace',
      measured: 'You speak with thoughtful, measured rhythm',
      moderate: 'Your speaking pace feels natural and flowing',
      brisk: 'Your speech carries energetic momentum',
      rapid: 'You speak with quick, dynamic energy'
    };
    parts.push(tempoMap[curve.averageTempo]);
    
    // Energy profile
    const energyMap = {
      subdued: 'with soft, restrained energy',
      even: 'with steady, consistent presence',
      dynamic: 'with expressive variation',
      intense: 'with powerful vocal presence'
    };
    parts.push(energyMap[curve.energyProfile]);
    
    // Emotional characteristic
    if (curve.pausePattern === 'deliberate') {
      parts.push('— you use pauses for emphasis');
    } else if (curve.emotionalIntensity === 'passionate') {
      parts.push('— your emotional investment is clear');
    } else if (curve.pitchRange === 'expressive' || curve.pitchRange === 'dramatic') {
      parts.push('— your voice carries emotional range');
    }
    
    return parts.join(' ') + '.';
  };
  
  /**
   * Format duration as MM:SS
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  /**
   * Calculate progress percentage
   */
  const progressPercent = Math.min((duration / maxDuration) * 100, 100);
  const isMinMet = duration >= minDuration;
  
  return (
    <div className="w-full space-y-4">
      {/* Prompt text */}
      {prompt && state === 'idle' && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-neutral-400 text-center"
        >
          {prompt}
        </motion.p>
      )}
      
      {/* Recording visualization */}
      <div className="relative flex items-center justify-center h-32">
        <AnimatePresence mode="wait">
          {state === 'recording' && (
            <motion.div
              key="recording"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative"
            >
              {/* Live energy ring */}
              <motion.div
                className="absolute rounded-full border-4 border-red-500/50"
                style={{ 
                  width: 80 + liveEnergy * 40, 
                  height: 80 + liveEnergy * 40,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
                animate={{ 
                  scale: [1, 1 + liveEnergy * 0.2, 1],
                  opacity: [0.3 + liveEnergy * 0.5, 0.1, 0.3 + liveEnergy * 0.5]
                }}
                transition={{ duration: 0.3 }}
              />
              
              {/* Pulsing rings */}
              <motion.div
                className="absolute inset-0 rounded-full bg-red-500/20"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ width: 80, height: 80, marginLeft: -40, marginTop: -40, left: '50%', top: '50%' }}
              />
              
              {/* Center mic icon */}
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                <Mic className="w-8 h-8 text-white" />
              </div>
            </motion.div>
          )}
          
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-16 h-16 rounded-full bg-neutral-800 border-2 border-neutral-600 flex items-center justify-center"
            >
              <Mic className="w-8 h-8 text-neutral-400" />
            </motion.div>
          )}
          
          {state === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-16 h-16 rounded-full bg-orange-500/20 border-2 border-orange-500 flex items-center justify-center"
            >
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </motion.div>
          )}
          
          {state === 'success' && (
            <motion.div
              key="success"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center"
            >
              <CheckCircle className="w-8 h-8 text-green-500" />
            </motion.div>
          )}
          
          {(state === 'recorded' || state === 'error') && (
            <motion.div
              key="recorded"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                state === 'error' 
                  ? 'bg-red-500/20 border-2 border-red-500' 
                  : 'bg-orange-500/20 border-2 border-orange-500'
              }`}
            >
              {state === 'error' ? (
                <XCircle className="w-8 h-8 text-red-500" />
              ) : (
                <Mic className="w-8 h-8 text-orange-500" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Duration and progress */}
      {(state === 'recording' || state === 'recorded') && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-neutral-400">
            <span>{formatDuration(duration)}</span>
            <span>{formatDuration(maxDuration)}</span>
          </div>
          
          <div className="relative h-1 bg-neutral-800 rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${
                state === 'recording' 
                  ? isMinMet ? 'bg-green-500' : 'bg-orange-500'
                  : 'bg-orange-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.1 }}
            />
            
            {/* Min duration marker */}
            {minDuration > 1 && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-neutral-500"
                style={{ left: `${(minDuration / maxDuration) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Error message */}
      {errorMessage && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-400 text-center"
        >
          {errorMessage}
        </motion.p>
      )}
      
      {/* Success message with cadence summary */}
      {state === 'success' && analysisResult?.cadenceSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-3"
        >
          <p className="text-sm text-green-400 font-medium">✓ Voice analysis complete!</p>
          <p className="text-sm text-neutral-300">{analysisResult.cadenceSummary}</p>
          
          {/* Show key metrics */}
          {analysisResult.curve && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-green-500/20">
              <div className="text-xs text-neutral-400">
                <span className="text-green-400">Tempo:</span> {analysisResult.curve.averageTempo}
              </div>
              <div className="text-xs text-neutral-400">
                <span className="text-green-400">Energy:</span> {analysisResult.curve.energyProfile}
              </div>
              <div className="text-xs text-neutral-400">
                <span className="text-green-400">Pauses:</span> {analysisResult.curve.pausePattern}
              </div>
              <div className="text-xs text-neutral-400">
                <span className="text-green-400">Intensity:</span> {analysisResult.curve.emotionalIntensity}
              </div>
            </div>
          )}
        </motion.div>
      )}
      
      {/* Audio playback */}
      {audioUrl && state === 'recorded' && (
        <audio 
          src={audioUrl} 
          controls 
          className="w-full h-10 opacity-60 hover:opacity-100 transition-opacity"
        />
      )}
      
      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {state === 'idle' && (
          <Button
            onClick={startRecording}
            disabled={disabled}
            className="bg-red-500 hover:bg-red-600 text-white px-6"
          >
            <Mic className="w-4 h-4 mr-2" />
            Start Recording
          </Button>
        )}
        
        {state === 'recording' && (
          <Button
            onClick={stopRecording}
            variant="outline"
            className="border-red-500 text-red-500 hover:bg-red-500/10 px-6"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop Recording
          </Button>
        )}
        
        {state === 'recorded' && (
          <>
            <Button
              onClick={resetRecording}
              variant="outline"
              className="border-neutral-600 text-neutral-400 hover:bg-neutral-800"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Re-record
            </Button>
            
            <Button
              onClick={() => analyzeRecording()}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6"
            >
              <Send className="w-4 h-4 mr-2" />
              Analyze Voice
            </Button>
          </>
        )}
        
        {state === 'analyzing' && (
          <Button disabled className="bg-neutral-700 text-neutral-400 px-6">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Analyzing cadence...
          </Button>
        )}
        
        {(state === 'success' || state === 'error') && (
          <Button
            onClick={resetRecording}
            variant="outline"
            className="border-neutral-600 text-neutral-400 hover:bg-neutral-800"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Record Again
          </Button>
        )}
      </div>
      
      {/* Helper text */}
      {state === 'idle' && (
        <p className="text-xs text-neutral-500 text-center">
          Record up to {maxDuration} seconds of audio. Speak naturally about the prompt above.
        </p>
      )}
    </div>
  );
}

export default VoiceRecorder;
