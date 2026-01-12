/**
 * Emotion Detector
 * Analyzes text to detect emotional state and sentiment
 *
 * Uses a combination of:
 * - Sentiment analysis (valence)
 * - Emotion classification
 * - Arousal detection
 */

export type PrimaryEmotion =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'surprise'
  | 'disgust'
  | 'neutral'
  | 'love'
  | 'anticipation';

export interface EmotionState {
  primary: PrimaryEmotion;
  secondary?: PrimaryEmotion;
  intensity: number;     // 0-100
  valence: number;       // -100 to 100 (negative to positive)
  arousal: number;       // 0-100 (calm to excited)
  confidence: number;    // 0-100
}

// Emotion word dictionaries
const EMOTION_WORDS: Record<PrimaryEmotion, string[]> = {
  joy: [
    'happy', 'joy', 'excited', 'thrilled', 'delighted', 'cheerful', 'ecstatic',
    'glad', 'pleased', 'content', 'satisfied', 'wonderful', 'amazing', 'great',
    'awesome', 'fantastic', 'love', 'loving', 'blessed', 'grateful', 'thankful',
    'yay', 'woohoo', 'haha', 'lol', 'fun', 'enjoy', 'celebrate', 'smile', 'laugh'
  ],
  sadness: [
    'sad', 'unhappy', 'depressed', 'down', 'blue', 'miserable', 'heartbroken',
    'devastated', 'grief', 'sorrow', 'lonely', 'alone', 'hopeless', 'despair',
    'crying', 'tears', 'hurt', 'pain', 'suffering', 'loss', 'miss', 'missing',
    'disappointed', 'regret', 'sorry', 'unfortunately', 'tragic', 'melancholy'
  ],
  anger: [
    'angry', 'mad', 'furious', 'rage', 'irritated', 'annoyed', 'frustrated',
    'pissed', 'hate', 'hatred', 'disgusted', 'outraged', 'livid', 'hostile',
    'aggressive', 'violent', 'bitter', 'resentful', 'offended', 'insulted',
    'unfair', 'injustice', 'ridiculous', 'stupid', 'idiot', 'damn', 'hell'
  ],
  fear: [
    'afraid', 'scared', 'frightened', 'terrified', 'anxious', 'nervous', 'worried',
    'panic', 'dread', 'horror', 'terror', 'phobia', 'paranoid', 'uneasy',
    'uncomfortable', 'threatened', 'vulnerable', 'helpless', 'overwhelmed',
    'stress', 'stressed', 'tense', 'apprehensive', 'concerned', 'alarmed'
  ],
  surprise: [
    'surprised', 'shocked', 'amazed', 'astonished', 'stunned', 'wow', 'omg',
    'unexpected', 'unbelievable', 'incredible', 'whoa', 'what', 'really',
    'seriously', 'no way', 'can\'t believe', 'mind blown', 'speechless'
  ],
  disgust: [
    'disgusted', 'gross', 'nasty', 'revolting', 'repulsive', 'sickening',
    'vile', 'awful', 'terrible', 'horrible', 'dreadful', 'appalling',
    'offensive', 'distasteful', 'unpleasant', 'yuck', 'ugh', 'eww'
  ],
  love: [
    'love', 'adore', 'cherish', 'treasure', 'devoted', 'affection', 'fond',
    'caring', 'tender', 'romantic', 'passionate', 'intimate', 'close',
    'connected', 'attached', 'admire', 'appreciate', 'value', 'dear'
  ],
  anticipation: [
    'excited', 'eager', 'looking forward', 'can\'t wait', 'anticipate',
    'expect', 'hope', 'hopeful', 'optimistic', 'curious', 'interested',
    'wonder', 'waiting', 'soon', 'tomorrow', 'future', 'upcoming'
  ],
  neutral: []
};

// Intensity modifiers
const INTENSIFIERS = ['very', 'really', 'extremely', 'incredibly', 'so', 'super', 'absolutely', 'totally'];
const DIMINISHERS = ['slightly', 'somewhat', 'a bit', 'kind of', 'sort of', 'little', 'barely'];

// Negation words
const NEGATIONS = ['not', 'no', 'never', 'don\'t', 'doesn\'t', 'didn\'t', 'won\'t', 'can\'t', 'couldn\'t', 'wouldn\'t'];

/**
 * Detect emotion from text
 */
export function detectEmotion(text: string): EmotionState {
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;

  if (wordCount < 3) {
    return getDefaultEmotion();
  }

  // Count emotion words
  const emotionCounts: Record<PrimaryEmotion, number> = {
    joy: 0,
    sadness: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
    disgust: 0,
    love: 0,
    anticipation: 0,
    neutral: 0,
  };

  // Check for negations
  const hasNegation = words.some(w => NEGATIONS.includes(w));
  const hasIntensifier = words.some(w => INTENSIFIERS.includes(w));
  const hasDiminisher = words.some(w => DIMINISHERS.includes(w));

  // Count emotion words
  for (const word of words) {
    for (const [emotion, emotionWords] of Object.entries(EMOTION_WORDS)) {
      if (emotionWords.includes(word)) {
        emotionCounts[emotion as PrimaryEmotion]++;
      }
    }
  }

  // Find primary emotion
  let maxCount = 0;
  let primaryEmotion: PrimaryEmotion = 'neutral';
  let secondaryEmotion: PrimaryEmotion | undefined;

  const sortedEmotions = Object.entries(emotionCounts)
    .filter(([e]) => e !== 'neutral')
    .sort(([, a], [, b]) => b - a);

  if (sortedEmotions.length > 0 && sortedEmotions[0][1] > 0) {
    primaryEmotion = sortedEmotions[0][0] as PrimaryEmotion;
    maxCount = sortedEmotions[0][1];

    if (sortedEmotions.length > 1 && sortedEmotions[1][1] > 0) {
      secondaryEmotion = sortedEmotions[1][0] as PrimaryEmotion;
    }
  }

  // Handle negation (flip positive/negative emotions)
  if (hasNegation && maxCount > 0) {
    if (primaryEmotion === 'joy') primaryEmotion = 'sadness';
    else if (primaryEmotion === 'sadness') primaryEmotion = 'neutral';
    else if (primaryEmotion === 'love') primaryEmotion = 'neutral';
  }

  // Calculate intensity
  let intensity = Math.min(100, maxCount * 20);
  if (hasIntensifier) intensity = Math.min(100, intensity + 20);
  if (hasDiminisher) intensity = Math.max(0, intensity - 20);

  // Calculate valence (positive/negative)
  const positiveEmotions = ['joy', 'love', 'anticipation', 'surprise'];
  const negativeEmotions = ['sadness', 'anger', 'fear', 'disgust'];

  let valence = 0;
  if (positiveEmotions.includes(primaryEmotion)) {
    valence = intensity;
  } else if (negativeEmotions.includes(primaryEmotion)) {
    valence = -intensity;
  }

  // Calculate arousal (excitement level)
  const highArousalEmotions = ['anger', 'fear', 'surprise', 'joy', 'anticipation'];
  const lowArousalEmotions = ['sadness', 'disgust'];

  let arousal = 50;
  if (highArousalEmotions.includes(primaryEmotion)) {
    arousal = 50 + intensity / 2;
  } else if (lowArousalEmotions.includes(primaryEmotion)) {
    arousal = 50 - intensity / 4;
  }

  // Calculate confidence
  const confidence = Math.min(100, Math.floor(wordCount * 2 + maxCount * 10));

  return {
    primary: primaryEmotion,
    secondary: secondaryEmotion,
    intensity: Math.round(intensity),
    valence: Math.round(valence),
    arousal: Math.round(arousal),
    confidence: Math.round(confidence),
  };
}

/**
 * Get default neutral emotion
 */
function getDefaultEmotion(): EmotionState {
  return {
    primary: 'neutral',
    intensity: 0,
    valence: 0,
    arousal: 50,
    confidence: 0,
  };
}

/**
 * Describe emotion for system prompt
 */
export function describeEmotion(emotion: EmotionState): string {
  if (emotion.primary === 'neutral' || emotion.intensity < 20) {
    return 'calm and neutral';
  }

  const intensityDesc = emotion.intensity >= 70 ? 'very ' : emotion.intensity >= 40 ? '' : 'slightly ';

  const emotionDescriptions: Record<PrimaryEmotion, string> = {
    joy: 'happy and positive',
    sadness: 'sad or down',
    anger: 'frustrated or upset',
    fear: 'anxious or worried',
    surprise: 'surprised',
    disgust: 'put off',
    love: 'warm and affectionate',
    anticipation: 'excited and looking forward',
    neutral: 'neutral',
  };

  return `${intensityDesc}${emotionDescriptions[emotion.primary]}`;
}

/**
 * Get emotional support suggestions based on detected emotion
 */
export function getEmotionalGuidance(emotion: EmotionState): string {
  switch (emotion.primary) {
    case 'sadness':
      return 'Be extra supportive and validating. Acknowledge their feelings before offering perspective.';
    case 'anger':
      return 'Stay calm and non-defensive. Validate the feeling while gently exploring the cause.';
    case 'fear':
      return 'Be reassuring and grounding. Help them feel safe and supported.';
    case 'joy':
      return 'Match their energy! Celebrate with them and build on the positive momentum.';
    case 'love':
      return 'Be warm and appreciative. Reciprocate the connection.';
    case 'anticipation':
      return 'Share their excitement. Help them plan and prepare.';
    case 'surprise':
      return 'Give them space to process. Be curious about their reaction.';
    case 'disgust':
      return 'Validate their reaction. Help them process or distance from the source.';
    default:
      return 'Be present and attentive. Follow their lead.';
  }
}

/**
 * Analyze emotional trend over multiple messages
 */
export function analyzeEmotionalTrend(messages: string[]): {
  trend: 'improving' | 'declining' | 'stable';
  average: EmotionState;
} {
  if (messages.length < 2) {
    return {
      trend: 'stable',
      average: messages.length > 0 ? detectEmotion(messages[0]) : getDefaultEmotion(),
    };
  }

  const emotions = messages.map(detectEmotion);
  const recentValence = emotions.slice(-3).reduce((sum, e) => sum + e.valence, 0) / Math.min(3, emotions.length);
  const olderValence = emotions.slice(0, -3).reduce((sum, e) => sum + e.valence, 0) / Math.max(1, emotions.length - 3);

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentValence > olderValence + 10) trend = 'improving';
  else if (recentValence < olderValence - 10) trend = 'declining';

  // Calculate average emotion
  const avgIntensity = emotions.reduce((sum, e) => sum + e.intensity, 0) / emotions.length;
  const avgValence = emotions.reduce((sum, e) => sum + e.valence, 0) / emotions.length;
  const avgArousal = emotions.reduce((sum, e) => sum + e.arousal, 0) / emotions.length;

  // Find most common primary emotion
  const emotionCounts: Record<string, number> = {};
  for (const e of emotions) {
    emotionCounts[e.primary] = (emotionCounts[e.primary] || 0) + 1;
  }
  const mostCommon = Object.entries(emotionCounts).sort(([, a], [, b]) => b - a)[0][0] as PrimaryEmotion;

  return {
    trend,
    average: {
      primary: mostCommon,
      intensity: Math.round(avgIntensity),
      valence: Math.round(avgValence),
      arousal: Math.round(avgArousal),
      confidence: 80,
    },
  };
}
