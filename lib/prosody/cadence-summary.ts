/**
 * Cadence Summary Generator
 * 
 * Transforms numeric prosodic features into qualitative traits and
 * generates natural language descriptions of communication style.
 * 
 * This is designed for SoulPrint's Emotional Signature Curve - focusing on
 * communication cadence rather than clinical voice assessment.
 */

import { ProsodyFeatures, CadenceTraits } from './types';

/**
 * Thresholds for interpreting prosodic features
 * These can be adjusted based on empirical data
 */
const THRESHOLDS = {
  // Speech rate (speech-to-silence ratio)
  speechRate: {
    slow: 1.5,      // Below this = slow/thoughtful
    fast: 3.5,      // Above this = fast/reactive
  },
  
  // Pitch variation (standard deviation in Hz)
  pitchVariation: {
    flat: 15,       // Below this = monotone
    expressive: 35, // Above this = highly expressive
  },
  
  // Intensity variation (standard deviation in dB)
  intensityVariation: {
    subtle: 5,      // Below this = consistent volume
    emphatic: 12,   // Above this = strong emphasis patterns
  },
  
  // Average pause length in seconds
  pauseLength: {
    minimal: 0.3,   // Below this = minimal pausing
    extended: 0.8,  // Above this = extended/thoughtful pauses
  },
  
  // Mean intensity in dB
  energyLevel: {
    low: 55,        // Below this = soft/quiet
    high: 70,       // Above this = strong/loud
  },
  
  // HNR in dB (voice clarity)
  voiceClarity: {
    breathy: 8,     // Below this = breathy/soft quality
    resonant: 15,   // Above this = clear/resonant
  },
};

/**
 * Analyze prosody features and derive qualitative traits
 */
export function deriveCadenceTraits(features: ProsodyFeatures): CadenceTraits {
  const { pitch, intensity, duration, voiceQuality } = features;
  
  // Determine rhythm speed
  let rhythm: CadenceTraits['rhythm'];
  if (duration.speechSilenceRatio < THRESHOLDS.speechRate.slow) {
    rhythm = 'slow';
  } else if (duration.speechSilenceRatio > THRESHOLDS.speechRate.fast) {
    rhythm = 'fast';
  } else {
    rhythm = 'moderate';
  }
  
  // Determine rhythm smoothness based on pitch consistency
  let rhythmSmoothness: CadenceTraits['rhythmSmoothness'];
  const pitchCoefficient = pitch.stdDev / (pitch.mean || 1);
  if (pitchCoefficient < 0.1) {
    rhythmSmoothness = 'smooth';
  } else if (pitchCoefficient > 0.25) {
    rhythmSmoothness = 'choppy';
  } else {
    rhythmSmoothness = 'varied';
  }
  
  // Determine pause style
  let pauseStyle: CadenceTraits['pauseStyle'];
  if (duration.averagePauseLength < THRESHOLDS.pauseLength.minimal) {
    pauseStyle = 'minimal';
  } else if (duration.averagePauseLength > THRESHOLDS.pauseLength.extended) {
    pauseStyle = 'extended';
  } else {
    pauseStyle = 'thoughtful';
  }
  
  // Determine expressiveness from pitch variation
  let expressiveness: CadenceTraits['expressiveness'];
  if (pitch.stdDev < THRESHOLDS.pitchVariation.flat) {
    expressiveness = 'flat';
  } else if (pitch.stdDev > THRESHOLDS.pitchVariation.expressive) {
    expressiveness = 'highly-expressive';
  } else {
    expressiveness = 'moderate';
  }
  
  // Determine energy level
  let energy: CadenceTraits['energy'];
  if (intensity.mean < THRESHOLDS.energyLevel.low) {
    energy = 'low';
  } else if (intensity.mean > THRESHOLDS.energyLevel.high) {
    energy = 'high';
  } else {
    energy = 'moderate';
  }
  
  // Determine emphasis style from intensity variation
  let emphasis: CadenceTraits['emphasis'];
  if (intensity.stdDev < THRESHOLDS.intensityVariation.subtle) {
    emphasis = 'subtle';
  } else if (intensity.stdDev > THRESHOLDS.intensityVariation.emphatic) {
    emphasis = 'emphatic';
  } else {
    emphasis = 'moderate';
  }
  
  // Determine voice clarity from HNR
  let voiceClarity: CadenceTraits['voiceClarity'];
  if (voiceQuality.hnrMean < THRESHOLDS.voiceClarity.breathy) {
    voiceClarity = 'breathy';
  } else if (voiceQuality.hnrMean > THRESHOLDS.voiceClarity.resonant) {
    voiceClarity = 'resonant';
  } else {
    voiceClarity = 'clear';
  }
  
  return {
    rhythm,
    rhythmSmoothness,
    pauseStyle,
    expressiveness,
    energy,
    emphasis,
    voiceClarity,
  };
}

/**
 * Generate a natural language cadence summary from traits
 * This description is designed to be pasted into the SoulPrint system prompt
 * as part of the Emotional Signature Curve.
 */
export function generateCadenceSummary(
  traits: CadenceTraits,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _features: ProsodyFeatures
): string {
  const sentences: string[] = [];
  
  // Rhythm and pacing sentence
  const rhythmDescriptions: Record<CadenceTraits['rhythm'], string> = {
    fast: 'speaks with a quick, energetic pace',
    moderate: 'maintains a balanced conversational tempo',
    slow: 'takes time with their words, speaking deliberately',
  };
  
  const smoothnessAddons: Record<CadenceTraits['rhythmSmoothness'], string> = {
    smooth: 'with a flowing, continuous cadence',
    varied: 'with natural rhythm variations',
    choppy: 'with distinct, punctuated phrasing',
  };
  
  sentences.push(
    `This person ${rhythmDescriptions[traits.rhythm]} ${smoothnessAddons[traits.rhythmSmoothness]}.`
  );
  
  // Pause and reflection sentence
  const pauseDescriptions: Record<CadenceTraits['pauseStyle'], string> = {
    minimal: 'They move quickly between thoughts with brief transitions.',
    thoughtful: 'They use measured pauses that suggest reflection between ideas.',
    extended: 'They embrace silence, taking meaningful pauses to gather thoughts.',
  };
  sentences.push(pauseDescriptions[traits.pauseStyle]);
  
  // Expressiveness sentence
  const expressiveDescriptions: Record<CadenceTraits['expressiveness'], string> = {
    flat: 'Their vocal tone stays relatively consistent, projecting steadiness.',
    moderate: 'They show natural vocal variety, expressing engagement through subtle inflection.',
    'highly-expressive': 'Their voice carries significant emotional range, with dynamic pitch shifts that convey feeling.',
  };
  sentences.push(expressiveDescriptions[traits.expressiveness]);
  
  // Energy and emphasis sentence
  const energyPhrases: Record<CadenceTraits['energy'], string> = {
    low: 'soft-spoken presence',
    moderate: 'balanced vocal energy',
    high: 'strong vocal presence',
  };
  
  const emphasisPhrases: Record<CadenceTraits['emphasis'], string> = {
    subtle: 'with understated emphasis',
    moderate: 'with clear points of emphasis',
    emphatic: 'with pronounced emphasis on key points',
  };
  
  sentences.push(
    `They communicate with a ${energyPhrases[traits.energy]} ${emphasisPhrases[traits.emphasis]}.`
  );
  
  // Voice quality sentence (optional, add if notable)
  if (traits.voiceClarity === 'breathy') {
    sentences.push('Their voice has a softer, more intimate quality.');
  } else if (traits.voiceClarity === 'resonant') {
    sentences.push('Their voice carries clarity and resonance.');
  }
  
  return sentences.join(' ');
}

/**
 * Main function to process features and generate complete cadence analysis
 */
export function analyzeCadence(features: ProsodyFeatures): {
  traits: CadenceTraits;
  summary: string;
} {
  const traits = deriveCadenceTraits(features);
  const summary = generateCadenceSummary(traits, features);
  
  return { traits, summary };
}

/**
 * Utility to describe specific prosody aspects for detailed reports
 */
export function getDetailedInsights(features: ProsodyFeatures): Record<string, string> {
  const { pitch, intensity, duration, voiceQuality } = features;
  
  return {
    pitchRange: `Pitch ranges from ${pitch.min.toFixed(0)}Hz to ${pitch.max.toFixed(0)}Hz (${pitch.range.toFixed(0)}Hz range)`,
    pitchVariability: `Pitch standard deviation of ${pitch.stdDev.toFixed(1)}Hz indicates ${
      pitch.stdDev < 15 ? 'consistent' : pitch.stdDev > 35 ? 'highly variable' : 'moderately variable'
    } intonation`,
    voicedRatio: `${pitch.percentVoiced.toFixed(0)}% of the recording contains voiced speech`,
    volumeRange: `Volume ranges from ${intensity.min.toFixed(0)}dB to ${intensity.max.toFixed(0)}dB`,
    speechPace: `Speech-to-silence ratio of ${duration.speechSilenceRatio.toFixed(2)} with ${duration.averagePauseLength.toFixed(2)}s average pauses`,
    voiceClarity: `Harmonics-to-noise ratio of ${voiceQuality.hnrMean.toFixed(1)}dB indicates ${
      voiceQuality.hnrMean < 8 ? 'softer' : voiceQuality.hnrMean > 15 ? 'clear' : 'typical'
    } voice quality`,
  };
}
