"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { VoiceRecorderV3 } from "@/components/voice-recorder/VoiceRecorderV3";

// Define the result type for V3 (AssemblyAI)
interface V3AnalysisResult {
  transcript: string;
  confidence: number;
  wordCount: number;
  emotionalSignature: {
    tempo: { wpm: number; avgWordDuration: number };
    pauses: { count: number; avgLength: number; longest: number; distribution: { short: number; medium: number; long: number } };
    fillers: { total: number; ratio: number; breakdown: { word: string; count: number }[] };
    sentiment: { overall: { positive: number; negative: number; neutral: number }; variability: number };
    confidence: { average: number; variability: number };
    rhythm: { rushing: number; hesitation: number; silenceRatio: number };
    duration: { total: number; speech: number };
  };
  llmInstructions: string;
  n8nPayload: any;
  processingTime: number;
}

export default function VoiceTestPage() {
  const [result, setResult] = useState<V3AnalysisResult | null>(null);
  const [showN8nPayload, setShowN8nPayload] = useState(true);
  const [showRawInstructions, setShowRawInstructions] = useState(false);

  // Get tempo description
  const getTempoDescription = (wpm: number) => {
    if (wpm > 160) return "Fast";
    if (wpm > 120) return "Moderate";
    if (wpm > 80) return "Measured";
    return "Slow";
  };

  // Get sentiment emoji
  const getSentimentEmoji = (sentiment: { positive: number; negative: number; neutral: number }) => {
    if (sentiment.positive > 50) return "😊 Positive";
    if (sentiment.negative > 30) return "😐 Cautious";
    return "😶 Neutral";
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="border border-[#2c2c2c] rounded-lg p-5 bg-[#0f0f14]">
          <h1 className="text-xl font-mono mb-2">SoulPrint Voice Analysis v3</h1>
          <p className="text-sm text-neutral-400 mb-2">
            Powered by <span className="text-purple-400">AssemblyAI</span> for production-quality analysis.
          </p>
          <ul className="text-xs text-neutral-500 mb-6 space-y-1">
            <li>✓ 99%+ transcription accuracy</li>
            <li>✓ Sentiment analysis per sentence</li>
            <li>✓ Filler word detection (um, uh, like, you know)</li>
            <li>✓ Word-level timestamps for precise cadence</li>
          </ul>

          <VoiceRecorderV3
            minDuration={5}
            maxDuration={120}
            questionText="Describe a moment when someone really understood you. Speak naturally, like telling a friend."
            onAnalysisComplete={(r) => setResult(r as V3AnalysisResult)}
          />
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Transcript */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              className="border border-blue-500/30 bg-[#0f0f14] rounded-lg overflow-hidden"
            >
              <div className="p-4 border-b border-blue-500/20 bg-blue-500/5">
                <h2 className="text-lg font-mono text-blue-400">📝 Your Words</h2>
              </div>
              <div className="p-4">
                <p className="text-neutral-200 leading-relaxed">"{result.transcript}"</p>
                <p className="text-xs text-neutral-500 mt-2">
                  {result.wordCount} words • {Math.round(result.confidence * 100)}% confidence • {(result.emotionalSignature.duration.speech / 1000).toFixed(1)}s speaking time
                </p>
              </div>
            </motion.div>

            {/* Analysis Summary */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border border-orange-500/30 bg-[#0f0f14] rounded-lg overflow-hidden"
            >
              <div className="p-4 border-b border-orange-500/20 bg-orange-500/5">
                <h2 className="text-lg font-mono text-orange-400">🎭 Emotional Signature Curve™</h2>
              </div>
              <div className="p-4 space-y-4">
                {/* Grid of traits */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-2 bg-[#1a1a22] rounded text-center">
                    <p className="text-xs text-neutral-500">Tempo</p>
                    <p className="text-sm text-white capitalize">{getTempoDescription(result.emotionalSignature.tempo.wpm)}</p>
                    <p className="text-xs text-neutral-400">{result.emotionalSignature.tempo.wpm} WPM</p>
                  </div>
                  <div className="p-2 bg-[#1a1a22] rounded text-center">
                    <p className="text-xs text-neutral-500">Pauses</p>
                    <p className="text-sm text-white">{result.emotionalSignature.pauses.count} total</p>
                    <p className="text-xs text-neutral-400">avg {result.emotionalSignature.pauses.avgLength}ms</p>
                  </div>
                  <div className="p-2 bg-[#1a1a22] rounded text-center">
                    <p className="text-xs text-neutral-500">Fillers</p>
                    <p className="text-sm text-white">{result.emotionalSignature.fillers.total}</p>
                    <p className="text-xs text-neutral-400">{result.emotionalSignature.fillers.ratio}%</p>
                  </div>
                  <div className="p-2 bg-[#1a1a22] rounded text-center">
                    <p className="text-xs text-neutral-500">Sentiment</p>
                    <p className="text-sm text-white">{getSentimentEmoji(result.emotionalSignature.sentiment.overall)}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div className="p-2 bg-[#1a1a22] rounded text-center">
                    <p className="text-xs text-neutral-500">Confidence</p>
                    <p className="text-sm text-white">{Math.round(result.emotionalSignature.confidence.average * 100)}%</p>
                  </div>
                  <div className="p-2 bg-[#1a1a22] rounded text-center">
                    <p className="text-xs text-neutral-500">Hesitations</p>
                    <p className="text-sm text-white">{result.emotionalSignature.rhythm.hesitation}</p>
                  </div>
                  <div className="p-2 bg-[#1a1a22] rounded text-center">
                    <p className="text-xs text-neutral-500">Rushing</p>
                    <p className="text-sm text-white">{result.emotionalSignature.rhythm.rushing}</p>
                  </div>
                </div>

                {/* Filler breakdown */}
                {result.emotionalSignature.fillers.breakdown.length > 0 && (
                  <div className="pt-3 border-t border-orange-500/20">
                    <p className="text-xs text-neutral-500 mb-2">Filler words detected:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.emotionalSignature.fillers.breakdown.map((f, i) => (
                        <span key={i} className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs">
                          "{f.word}" × {f.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sentiment breakdown */}
                <div className="pt-3 border-t border-orange-500/20">
                  <p className="text-xs text-neutral-500 mb-2">Sentiment distribution:</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-green-500/20 text-green-300 rounded px-2 py-1 text-center text-xs">
                      + {result.emotionalSignature.sentiment.overall.positive}%
                    </div>
                    <div className="flex-1 bg-gray-500/20 text-gray-300 rounded px-2 py-1 text-center text-xs">
                      ~ {result.emotionalSignature.sentiment.overall.neutral}%
                    </div>
                    <div className="flex-1 bg-red-500/20 text-red-300 rounded px-2 py-1 text-center text-xs">
                      - {result.emotionalSignature.sentiment.overall.negative}%
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* N8N Payload */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="border border-green-500/30 bg-[#0f0f14] rounded-lg overflow-hidden"
            >
              <div 
                className="p-4 border-b border-green-500/20 bg-green-500/5 cursor-pointer flex justify-between items-center"
                onClick={() => setShowN8nPayload(!showN8nPayload)}
              >
                <div>
                  <h2 className="text-lg font-mono text-green-400">📤 n8n Webhook Payload</h2>
                  <p className="text-xs text-neutral-400">JSON data for SoulPrint generation</p>
                </div>
                <span className="text-green-400">{showN8nPayload ? '▼' : '▶'}</span>
              </div>
              
              {showN8nPayload && (
                <div className="p-4">
                  <pre className="text-xs text-green-300 bg-black/50 p-4 rounded overflow-x-auto whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
                    {JSON.stringify(result.n8nPayload, null, 2)}
                  </pre>
                  
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(result.n8nPayload, null, 2));
                        alert('Copied to clipboard!');
                      }}
                      className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded hover:bg-green-500/30 transition-colors"
                    >
                      📋 Copy JSON
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(result.n8nPayload, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'soulprint-voice-data.json';
                        a.click();
                      }}
                      className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded hover:bg-green-500/30 transition-colors"
                    >
                      💾 Download JSON
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Raw LLM Instructions */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="border border-purple-500/30 bg-[#0f0f14] rounded-lg overflow-hidden"
            >
              <div 
                className="p-4 border-b border-purple-500/20 bg-purple-500/5 cursor-pointer flex justify-between items-center"
                onClick={() => setShowRawInstructions(!showRawInstructions)}
              >
                <div>
                  <h2 className="text-lg font-mono text-purple-400">🤖 LLM Cadence Instructions</h2>
                  <p className="text-xs text-neutral-400">Ready-to-use prompt for AI personality training</p>
                </div>
                <span className="text-purple-400">{showRawInstructions ? '▼' : '▶'}</span>
              </div>
              
              {showRawInstructions && (
                <div className="p-4">
                  <pre className="text-xs text-purple-300 bg-black/50 p-4 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                    {result.llmInstructions}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.llmInstructions);
                      alert('Copied to clipboard!');
                    }}
                    className="mt-3 px-3 py-1.5 bg-purple-500/20 text-purple-400 text-xs rounded hover:bg-purple-500/30 transition-colors"
                  >
                    📋 Copy Instructions
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
