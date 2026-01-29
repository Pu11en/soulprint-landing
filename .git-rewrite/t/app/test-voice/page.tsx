'use client';

import { useState, useRef } from 'react';

export default function TestVoicePage() {
  const [status, setStatus] = useState<string>('Ready');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  };

  const startRecording = async () => {
    setError('');
    setTranscript('');
    addLog('Requesting microphone access...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog('✅ Microphone access granted');
      
      // Check supported MIME types
      const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          addLog(`✅ Using MIME type: ${mime}`);
          break;
        }
      }
      if (!selectedMime) {
        addLog('⚠️ No standard MIME type supported, using default');
      }

      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          addLog(`📦 Received chunk: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = async () => {
        addLog('🛑 Recording stopped');
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        addLog(`📁 Total audio size: ${audioBlob.size} bytes`);
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.onerror = (e) => {
        addLog(`❌ MediaRecorder error: ${e}`);
        setError('Recording error occurred');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus('Recording... (tap Stop when done)');
      addLog('🎙️ Recording started');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog(`❌ Error: ${errorMsg}`);
      setError(errorMsg);
      setStatus('Error - check logs');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('Processing...');
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    addLog('📤 Sending to transcribe API...');
    setStatus('Transcribing...');
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      addLog(`📥 Response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        addLog(`✅ Transcription successful!`);
        addLog(`📝 Text: "${data.text}"`);
        if (data.voiceVerified !== undefined) {
          addLog(`🔐 Voice verified: ${data.voiceVerified}`);
        }
        setTranscript(data.text || '(empty response)');
        setStatus('Done!');
      } else {
        const errorData = await response.json();
        addLog(`❌ API error: ${JSON.stringify(errorData)}`);
        setError(errorData.error || 'Transcription failed');
        setStatus('Error - check logs');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog(`❌ Network error: ${errorMsg}`);
      setError(errorMsg);
      setStatus('Error - check logs');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-6">🎤 Voice Debug Tool</h1>
      
      <div className="mb-6">
        <p className="text-gray-400 mb-2">Status: <span className="text-white font-mono">{status}</span></p>
        
        <div className="flex gap-4 mb-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold"
            >
              🎙️ Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-semibold animate-pulse"
            >
              ⏹️ Stop Recording
            </button>
          )}
          
          <button
            onClick={() => setLogs([])}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            Clear Logs
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg mb-4">
            <p className="font-bold text-red-400">Error:</p>
            <p className="font-mono text-sm">{error}</p>
          </div>
        )}

        {transcript && (
          <div className="p-4 bg-green-900/50 border border-green-500 rounded-lg mb-4">
            <p className="font-bold text-green-400">Transcript:</p>
            <p className="font-mono">{transcript}</p>
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">📋 Debug Logs</h2>
        <div className="font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs yet. Click Start Recording to begin.</p>
          ) : (
            logs.map((log, i) => (
              <p key={i} className="text-gray-300">{log}</p>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 text-gray-500 text-sm">
        <p>This page tests the voice recording and transcription pipeline.</p>
        <p>If this works but chat doesn't, the issue is in the chat component.</p>
      </div>
    </div>
  );
}
