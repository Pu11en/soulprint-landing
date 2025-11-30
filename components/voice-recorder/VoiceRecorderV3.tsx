/**
 * VoiceRecorder V3 - AssemblyAI Powered
 * ======================================
 * 
 * Production-quality voice recorder with:
 * - Real-time audio visualization during recording
 * - Post-recording analysis via AssemblyAI API
 * - Full Emotional Signature Curve extraction
 * - n8n webhook payload ready
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Loader2, CheckCircle, XCircle, Volume2 } from 'lucide-react';

interface EmotionalSignature {
  tempo: {
    wpm: number;
    avgWordDuration: number;
  };
  pauses: {
    count: number;
    avgLength: number;
    longest: number;
    distribution: { short: number; medium: number; long: number };
  };
  fillers: {
    total: number;
    ratio: number;
    breakdown: { word: string; count: number }[];
  };
  sentiment: {
    overall: { positive: number; negative: number; neutral: number };
    variability: number;
  };
  confidence: {
    average: number;
    variability: number;
  };
  rhythm: {
    rushing: number;
    hesitation: number;
    silenceRatio: number;
  };
  duration: {
    total: number;
    speech: number;
  };
}

interface AnalysisResult {
  transcript: string;
  confidence: number;
  wordCount: number;
  emotionalSignature: EmotionalSignature;
  llmInstructions: string;
  n8nPayload: any;
  processingTime: number;
}

interface VoiceRecorderV3Props {
  onAnalysisComplete?: (result: AnalysisResult) => void;
  minDuration?: number; // seconds
  maxDuration?: number; // seconds
  questionText?: string;
}

export function VoiceRecorderV3({
  onAnalysisComplete,
  minDuration = 5,
  maxDuration = 120,
  questionText
}: VoiceRecorderV3Props) {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Audio visualization
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);
  
  // Update audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (!analyzerRef.current) return;
    
    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(dataArray);
    
    // Calculate RMS for audio level
    const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
    const rms = Math.sqrt(sum / dataArray.length);
    const normalizedLevel = Math.min(rms / 128, 1);
    
    setAudioLevel(normalizedLevel);
    
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);
  
  // Start recording
  const startRecording = async () => {
    setError(null);
    setAnalysisResult(null);
    setAudioBlob(null);
    chunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio context for visualization
      audioContextRef.current = new AudioContext();
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyzerRef.current);
      
      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Clean up audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };
      
      // Start recording
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start visualization
      updateAudioLevel();
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t >= maxDuration) {
            stopRecording();
            return t;
          }
          return t + 1;
        });
      }, 1000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };
  
  // Analyze recording
  const analyzeRecording = async () => {
    if (!audioBlob) {
      setError('No recording to analyze');
      return;
    }
    
    if (recordingTime < minDuration) {
      setError(`Recording too short. Please record at least ${minDuration} seconds.`);
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Create FormData with audio
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      // Send to API
      const response = await fetch('/api/voice/analyze', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }
      
      setAnalysisResult(data);
      
      if (onAnalysisComplete) {
        onAnalysisComplete(data);
      }
      
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Reset to record again
  const resetRecording = () => {
    setAudioBlob(null);
    setAnalysisResult(null);
    setRecordingTime(0);
    setError(null);
  };
  
  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Question display */}
      {questionText && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Question:</p>
          <p className="text-lg font-medium">{questionText}</p>
        </div>
      )}
      
      {/* Recording controls */}
      <div className="flex flex-col items-center gap-6">
        {/* Audio level visualization */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Background rings */}
          <div 
            className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 transition-transform duration-100"
            style={{ transform: `scale(${1 + audioLevel * 0.5})` }}
          />
          <div 
            className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 transition-transform duration-100"
            style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
          />
          
          {/* Main button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isAnalyzing}
            className={`
              relative w-20 h-20 rounded-full flex items-center justify-center transition-all
              ${isRecording 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : 'bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg hover:shadow-xl
            `}
          >
            {isRecording ? (
              <Square className="w-8 h-8 text-white" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </button>
        </div>
        
        {/* Timer */}
        <div className="text-center">
          <p className="text-3xl font-mono font-bold">
            {formatTime(recordingTime)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isRecording 
              ? `Recording... (min ${minDuration}s, max ${maxDuration}s)`
              : audioBlob 
                ? 'Recording complete'
                : 'Click to start recording'
            }
          </p>
        </div>
        
        {/* Analyze button */}
        {audioBlob && !isRecording && !analysisResult && (
          <div className="flex gap-3">
            <button
              onClick={resetRecording}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Record Again
            </button>
            <button
              onClick={analyzeRecording}
              disabled={isAnalyzing}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  Analyze Voice
                </>
              )}
            </button>
          </div>
        )}
        
        {/* Error display */}
        {error && (
          <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
      
      {/* Analysis results */}
      {analysisResult && (
        <div className="mt-8 space-y-6">
          {/* Success banner */}
          <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <p>Analysis complete! Processed in {analysisResult.processingTime}ms</p>
          </div>
          
          {/* Transcript */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              Transcript 
              <span className="text-sm font-normal text-gray-500">
                ({analysisResult.wordCount} words, {Math.round(analysisResult.confidence * 100)}% confidence)
              </span>
            </h3>
            <p className="text-gray-700 dark:text-gray-300 italic">
              "{analysisResult.transcript}"
            </p>
          </div>
          
          {/* Emotional Signature Summary */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <h3 className="font-semibold mb-3">Emotional Signature Curve™</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Tempo</p>
                <p className="text-xl font-bold">{analysisResult.emotionalSignature.tempo.wpm} WPM</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pauses</p>
                <p className="text-xl font-bold">{analysisResult.emotionalSignature.pauses.count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Fillers</p>
                <p className="text-xl font-bold">{analysisResult.emotionalSignature.fillers.total}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sentiment</p>
                <p className="text-xl font-bold">
                  {analysisResult.emotionalSignature.sentiment.overall.positive > 50 ? '😊' : 
                   analysisResult.emotionalSignature.sentiment.overall.negative > 30 ? '😐' : '😶'}
                  {' '}
                  {analysisResult.emotionalSignature.sentiment.overall.positive}% +
                </p>
              </div>
            </div>
            
            {/* Filler breakdown */}
            {analysisResult.emotionalSignature.fillers.breakdown.length > 0 && (
              <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Filler words detected:</p>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.emotionalSignature.fillers.breakdown.map((f, i) => (
                    <span key={i} className="px-2 py-1 bg-purple-100 dark:bg-purple-800 rounded text-sm">
                      "{f.word}" × {f.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* LLM Instructions */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="font-semibold mb-2">AI Personality Training Instructions</h3>
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono bg-white dark:bg-gray-900 p-3 rounded">
              {analysisResult.llmInstructions}
            </pre>
          </div>
          
          {/* n8n Payload (collapsible) */}
          <details className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <summary className="font-semibold cursor-pointer hover:text-purple-600">
              n8n Webhook Payload (click to expand)
            </summary>
            <pre className="mt-3 text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-96">
              {JSON.stringify(analysisResult.n8nPayload, null, 2)}
            </pre>
          </details>
          
          {/* Reset button */}
          <div className="flex justify-center">
            <button
              onClick={resetRecording}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Record New Response
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceRecorderV3;
