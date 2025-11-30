#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SoulPrint Prosody Analyzer
==========================

A wrapper script for prosodic analysis that outputs JSON-formatted features.
Based on pilarOG/prosodic-analysis but adapted for single-file analysis
with structured JSON output for the SoulPrint voice analysis pipeline.

Usage:
    python run_prosody.py <audio_file_path>

Output:
    JSON object with prosodic features to stdout

Dependencies:
    - parselmouth (Praat wrapper)
    - numpy
    - scipy

Install with:
    pip install praat-parselmouth numpy scipy
"""

import sys
import json
import numpy as np
import parselmouth
from parselmouth.praat import call
import warnings

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')


class ProsodyAnalyzer:
    """
    Analyzes prosodic features of a single audio file.
    """
    
    def __init__(self, pitch_floor=50, pitch_ceiling=500, smooth_bandwidth=10):
        """
        Initialize analyzer with configuration.
        
        Args:
            pitch_floor: Minimum expected pitch in Hz (default 50 for low voices)
            pitch_ceiling: Maximum expected pitch in Hz (default 500 for high voices)
            smooth_bandwidth: Bandwidth for pitch smoothing in Hz
        """
        self.pitch_floor = pitch_floor
        self.pitch_ceiling = pitch_ceiling
        self.smooth_bandwidth = smooth_bandwidth
    
    def load_audio(self, filepath: str) -> parselmouth.Sound:
        """Load and convert audio to mono."""
        try:
            sound = parselmouth.Sound(filepath)
            # Convert to mono if stereo
            if sound.n_channels > 1:
                sound = call(sound, "Convert to mono")
            return sound
        except Exception as e:
            raise RuntimeError(f"Failed to load audio file: {e}")
    
    def extract_pitch_features(self, sound: parselmouth.Sound) -> dict:
        """
        Extract fundamental frequency (pitch) features.
        
        Returns:
            Dictionary with pitch statistics
        """
        pitch = sound.to_pitch(
            pitch_floor=self.pitch_floor,
            pitch_ceiling=self.pitch_ceiling
        )
        
        # Get pitch values (excluding unvoiced frames)
        pitch_values = pitch.selected_array['frequency']
        pitch_values = pitch_values[pitch_values != 0]  # Remove unvoiced
        pitch_values = pitch_values[~np.isnan(pitch_values)]
        
        if len(pitch_values) == 0:
            return {
                'mean': 0,
                'min': 0,
                'max': 0,
                'stdDev': 0,
                'range': 0,
                'percentVoiced': 0
            }
        
        # Calculate percentage of voiced frames
        total_frames = pitch.get_number_of_frames()
        voiced_frames = pitch.count_voiced_frames()
        percent_voiced = (voiced_frames / total_frames * 100) if total_frames > 0 else 0
        
        return {
            'mean': float(np.nanmean(pitch_values)),
            'min': float(np.nanmin(pitch_values)),
            'max': float(np.nanmax(pitch_values)),
            'stdDev': float(np.nanstd(pitch_values)),
            'range': float(np.nanmax(pitch_values) - np.nanmin(pitch_values)),
            'percentVoiced': float(percent_voiced)
        }
    
    def extract_intensity_features(self, sound: parselmouth.Sound) -> dict:
        """
        Extract intensity (volume) features.
        
        Returns:
            Dictionary with intensity statistics
        """
        intensity = sound.to_intensity()
        
        # Get intensity values
        intensity_values = [n[0] for n in intensity.values.T]
        intensity_values = np.array(intensity_values)
        intensity_values = intensity_values[intensity_values > 0]  # Remove silence
        intensity_values = intensity_values[~np.isnan(intensity_values)]
        
        if len(intensity_values) == 0:
            return {
                'mean': 0,
                'min': 0,
                'max': 0,
                'stdDev': 0,
                'range': 0
            }
        
        return {
            'mean': float(np.nanmean(intensity_values)),
            'min': float(np.nanmin(intensity_values)),
            'max': float(np.nanmax(intensity_values)),
            'stdDev': float(np.nanstd(intensity_values)),
            'range': float(np.nanmax(intensity_values) - np.nanmin(intensity_values))
        }
    
    def extract_duration_features(self, sound: parselmouth.Sound) -> dict:
        """
        Extract duration and pause features.
        
        Returns:
            Dictionary with duration statistics
        """
        total_duration = sound.duration
        
        try:
            # Create TextGrid with silence detection
            text_grid = call(sound, "To TextGrid (silences)", 
                           100,    # minimum pitch
                           0.0,    # time step
                           -25.0,  # silence threshold (dB)
                           0.1,    # minimum silent interval
                           0.1)    # minimum sounding interval
            
            # Extract sounding (speech) intervals
            soundings = call([text_grid, sound], "Extract intervals where", 
                           1, False, 'is equal to', 'sounding')
            
            # Extract silent intervals
            silences = call([text_grid, sound], "Extract intervals where", 
                          1, False, 'is equal to', 'silent')
            
            # Calculate total speech duration
            if isinstance(soundings, list):
                total_speech = sum([s.duration for s in soundings])
                num_speech_segments = len(soundings)
            else:
                total_speech = soundings.duration if soundings else 0
                num_speech_segments = 1 if soundings else 0
            
            # Calculate total silence duration
            if isinstance(silences, list):
                total_silence = sum([s.duration for s in silences])
                num_pauses = len(silences)
            else:
                total_silence = silences.duration if silences else 0
                num_pauses = 1 if silences else 0
            
            # Avoid division by zero
            speech_silence_ratio = total_speech / total_silence if total_silence > 0 else total_speech
            avg_pause_length = total_silence / num_pauses if num_pauses > 0 else 0
            
        except Exception as e:
            # Fallback if TextGrid creation fails
            total_speech = total_duration * 0.7  # Estimate
            total_silence = total_duration * 0.3
            speech_silence_ratio = 2.33
            avg_pause_length = 0.5
        
        return {
            'totalSpeech': float(total_speech),
            'totalSilence': float(total_silence),
            'speechSilenceRatio': float(speech_silence_ratio),
            'averagePauseLength': float(avg_pause_length)
        }
    
    def extract_voice_quality_features(self, sound: parselmouth.Sound) -> dict:
        """
        Extract voice quality features (Harmonics-to-Noise Ratio).
        
        Returns:
            Dictionary with HNR statistics
        """
        try:
            harmonicity = call(sound, "To Harmonicity (cc)", 
                             0.01,   # time step
                             75.0,   # minimum pitch
                             0.1,    # silence threshold
                             4.5)    # periods per window
            
            # Get HNR values
            hnr_values = [n[0] for n in harmonicity.values.T]
            hnr_values = np.array(hnr_values)
            hnr_values = hnr_values[hnr_values != -200]  # Remove undefined values
            hnr_values = hnr_values[~np.isnan(hnr_values)]
            
            if len(hnr_values) == 0:
                return {
                    'hnrMean': 0,
                    'hnrMin': 0,
                    'hnrMax': 0,
                    'hnrStdDev': 0
                }
            
            return {
                'hnrMean': float(np.nanmean(hnr_values)),
                'hnrMin': float(np.nanmin(hnr_values)),
                'hnrMax': float(np.nanmax(hnr_values)),
                'hnrStdDev': float(np.nanstd(hnr_values))
            }
            
        except Exception as e:
            return {
                'hnrMean': 0,
                'hnrMin': 0,
                'hnrMax': 0,
                'hnrStdDev': 0
            }
    
    def analyze(self, filepath: str) -> dict:
        """
        Perform complete prosodic analysis on an audio file.
        
        Args:
            filepath: Path to the audio file (WAV format preferred)
            
        Returns:
            Dictionary with all prosodic features
        """
        sound = self.load_audio(filepath)
        
        return {
            'pitch': self.extract_pitch_features(sound),
            'intensity': self.extract_intensity_features(sound),
            'duration': self.extract_duration_features(sound),
            'voiceQuality': self.extract_voice_quality_features(sound),
            'totalDuration': float(sound.duration)
        }


def main():
    """Main entry point for command-line usage."""
    if len(sys.argv) < 2:
        print(json.dumps({
            'error': 'No audio file path provided',
            'usage': 'python run_prosody.py <audio_file_path>'
        }))
        sys.exit(1)
    
    filepath = sys.argv[1]
    
    try:
        analyzer = ProsodyAnalyzer()
        features = analyzer.analyze(filepath)
        
        # Output JSON to stdout
        print(json.dumps(features, indent=2))
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'filepath': filepath
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
