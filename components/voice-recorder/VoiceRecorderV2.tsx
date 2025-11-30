"use client";

/**
 * Voice Recorder v2
 * 
 * Records audio AND transcribes speech in real-time using Web Speech API.
 * Shows live transcript as you speak.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, RotateCcw, Send, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  getVoiceAnalyzer, 
  type VoiceAnalysisResult,
  type EmotionalSignatureCurve 
} from '@/lib/soulprint/voice-analyzer-v2';

interface VoiceRecorderV2Props {
  userId: string;
  pillarId: string;
  onAnalysisComplete?: (result: VoiceAnalysisResult) => void;
  onError?: (error: string) => void;
  minDuration?: number;
  maxDuration?: number;
  prompt?: string;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'recorded' | 'analyzing' | 'success' | 'error';

export function VoiceRecorderV2({
  userId,
  pillarId,
  onAnalysisComplete,
  onError,
  minDuration = 3,
  maxDuration = 120,
  prompt,
  disabled = false,
}: VoiceRecorderV2Props) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<VoiceAnalysisResult | null>(null);
  const [liveEnergy, setLiveEnergy] = useState<number>(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const voiceAnalyzer = typeof window !== 'undefined' ? getVoiceAnalyzer() : null;
  
  // Setup analyzer callbacks
  useEffect(() => {
    if (voiceAnalyzer) {
      voiceAnalyzer.onTranscriptUpdate = (transcript, isFinal) => {
        setLiveTranscript(transcript);
      };
      voiceAnalyzer.onError = (error) => {
        console.warn('[VoiceRecorder] Speech recognition error:', error);
        // Don't show error for 'no-speech' - that's normal
        if (error !== 'no-speech') {
          setErrorMessage(`Speech recognition: ${error}`);
        }
      };
    }
  }, [voiceAnalyzer]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      voiceAnalyzer?.stopListening();
    };
  }, [audioUrl, voiceAnalyzer]);
  
  // Auto-stop at max duration
  useEffect(() => {
    if (state === 'recording' && duration >= maxDuration) {
      stopRecording();
    }
  }, [duration, maxDuration, state]);
  
  const startRecording = useCallback(async () => {
    try {
      setErrorMessage(null);
      setLiveTranscript('');
      voiceAnalyzer?.reset();
      
      // Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } 
      });
      streamRef.current = stream;
      
      // Start speech recognition
      const speechStarted = voiceAnalyzer?.startListening();
      if (!speechStarted) {
        console.warn('[VoiceRecorder] Speech recognition not available - will only capture audio');
      }
      
      // Setup audio visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateEnergy = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setLiveEnergy(avg / 255);
        }
        if (state === 'recording') {
          animationFrameRef.current = requestAnimationFrame(updateEnergy);
        }
      };
      
      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setLiveEnergy(0);
        
        // Stop speech recognition
        voiceAnalyzer?.stopListening();
        
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        
        stream.getTracks().forEach(track => track.stop());
        
        const finalDuration = (Date.now() - startTimeRef.current) / 1000;
        if (finalDuration < minDuration) {
          setErrorMessage(`Recording too short. Please record at least ${minDuration} seconds.`);
          setState('idle');
          return;
        }
        
        setState('recorded');
      };
      
      // Start recording
      mediaRecorder.start(1000);
      startTimeRef.current = Date.now();
      setDuration(0);
      setState('recording');
      
      setTimeout(() => {
        animationFrameRef.current = requestAnimationFrame(updateEnergy);
      }, 0);
      
      timerRef.current = setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to access microphone';
      setErrorMessage(message);
      onError?.(message);
      setState('error');
    }
  }, [minDuration, audioUrl, onError, voiceAnalyzer, state]);
  
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);
  
  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setErrorMessage(null);
    setAnalysisResult(null);
    setLiveTranscript('');
    voiceAnalyzer?.reset();
    setState('idle');
  }, [audioUrl, voiceAnalyzer]);
  
  const analyzeRecording = useCallback(async () => {
    if (!audioBlob || !voiceAnalyzer) {
      setErrorMessage('No recording to analyze');
      return;
    }
    
    setState('analyzing');
    setErrorMessage(null);
    
    try {
      const result = await voiceAnalyzer.analyze(audioBlob);
      console.log('[VoiceRecorder] Analysis complete:', result);
      
      setAnalysisResult(result);
      setState('success');
      onAnalysisComplete?.(result);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed';
      setErrorMessage(message);
      setState('error');
      onError?.(message);
    }
  }, [audioBlob, voiceAnalyzer, onAnalysisComplete, onError]);
  
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const progressPercent = Math.min((duration / maxDuration) * 100, 100);
  const isMinMet = duration >= minDuration;
  
  return (
    <div className="w-full space-y-4">
      {/* Prompt */}
      {prompt && state === 'idle' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-orange-500/10 border border-orange-500/30 rounded">
          <p className="text-sm text-neutral-300 italic">"{prompt}"</p>
        </motion.div>
      )}
      
      {/* Recording visualization */}
      <div className="relative flex items-center justify-center h-24">
        <AnimatePresence mode="wait">
          {state === 'recording' && (
            <motion.div key="recording" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="relative">
              <motion.div
                className="absolute rounded-full border-4 border-red-500/50"
                style={{ 
                  width: 70 + liveEnergy * 40, 
                  height: 70 + liveEnergy * 40,
                  left: '50%', top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              />
              <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
                <Mic className="w-7 h-7 text-white" />
              </div>
            </motion.div>
          )}
          
          {state === 'idle' && (
            <motion.div key="idle" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-14 h-14 rounded-full bg-neutral-800 border-2 border-neutral-600 flex items-center justify-center">
              <Mic className="w-7 h-7 text-neutral-400" />
            </motion.div>
          )}
          
          {state === 'analyzing' && (
            <motion.div key="analyzing" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-14 h-14 rounded-full bg-orange-500/20 border-2 border-orange-500 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
            </motion.div>
          )}
          
          {state === 'success' && (
            <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-14 h-14 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-green-500" />
            </motion.div>
          )}
          
          {(state === 'recorded' || state === 'error') && (
            <motion.div key="recorded" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
              className={`w-14 h-14 rounded-full flex items-center justify-center ${state === 'error' ? 'bg-red-500/20 border-2 border-red-500' : 'bg-orange-500/20 border-2 border-orange-500'}`}>
              {state === 'error' ? <XCircle className="w-7 h-7 text-red-500" /> : <Mic className="w-7 h-7 text-orange-500" />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Live transcript while recording */}
      {(state === 'recording' || state === 'recorded') && liveTranscript && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-[#1a1a22] rounded-lg border border-neutral-700">
          <p className="text-xs text-neutral-500 mb-1">Transcript:</p>
          <p className="text-sm text-neutral-200">{liveTranscript}</p>
        </motion.div>
      )}
      
      {/* Duration and progress */}
      {(state === 'recording' || state === 'recorded') && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-neutral-400">
            <span>{formatDuration(duration)}</span>
            <span>{formatDuration(maxDuration)}</span>
          </div>
          <div className="relative h-1 bg-neutral-800 rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${state === 'recording' ? (isMinMet ? 'bg-green-500' : 'bg-orange-500') : 'bg-orange-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
            />
            {minDuration > 1 && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-neutral-500" style={{ left: `${(minDuration / maxDuration) * 100}%` }} />
            )}
          </div>
        </div>
      )}
      
      {/* Error message */}
      {errorMessage && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400 text-center">
          {errorMessage}
        </motion.p>
      )}
      
      {/* Audio playback */}
      {audioUrl && state === 'recorded' && (
        <audio src={audioUrl} controls className="w-full h-10 opacity-60 hover:opacity-100 transition-opacity" />
      )}
      
      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {state === 'idle' && (
          <Button onClick={startRecording} disabled={disabled} className="bg-red-500 hover:bg-red-600 text-white px-6">
            <Mic className="w-4 h-4 mr-2" /> Start Recording
          </Button>
        )}
        
        {state === 'recording' && (
          <Button onClick={stopRecording} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10 px-6">
            <Square className="w-4 h-4 mr-2" /> Stop Recording
          </Button>
        )}
        
        {state === 'recorded' && (
          <>
            <Button onClick={resetRecording} variant="outline" className="border-neutral-600 text-neutral-400 hover:bg-neutral-800">
              <RotateCcw className="w-4 h-4 mr-2" /> Re-record
            </Button>
            <Button onClick={analyzeRecording} className="bg-orange-500 hover:bg-orange-600 text-white px-6">
              <Send className="w-4 h-4 mr-2" /> Analyze Voice
            </Button>
          </>
        )}
        
        {state === 'analyzing' && (
          <Button disabled className="bg-neutral-700 text-neutral-400 px-6">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...
          </Button>
        )}
        
        {(state === 'success' || state === 'error') && (
          <Button onClick={resetRecording} variant="outline" className="border-neutral-600 text-neutral-400 hover:bg-neutral-800">
            <RotateCcw className="w-4 h-4 mr-2" /> Record Again
          </Button>
        )}
      </div>
      
      {/* Helper text */}
      {state === 'idle' && (
        <p className="text-xs text-neutral-500 text-center">
          Speak for at least {minDuration} seconds. Your words will be transcribed in real-time.
        </p>
      )}
    </div>
  );
}

export default VoiceRecorderV2;
export type { VoiceAnalysisResult, EmotionalSignatureCurve };
