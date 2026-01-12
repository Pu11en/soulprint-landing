/**
 * Big Five Personality Detector
 * Analyzes text to detect personality traits using linguistic markers
 *
 * Based on LIWC (Linguistic Inquiry and Word Count) research
 * and modern NLP approaches to personality detection
 */

export interface BigFiveProfile {
  openness: number;          // 0-100: Creativity, curiosity, openness to experience
  conscientiousness: number; // 0-100: Organization, dependability, self-discipline
  extraversion: number;      // 0-100: Sociability, assertiveness, positive emotions
  agreeableness: number;     // 0-100: Compassion, cooperation, trust
  neuroticism: number;       // 0-100: Emotional instability, anxiety, moodiness
  confidence: number;        // 0-100: How confident the detection is (based on text volume)
}

// Linguistic markers for each trait
const TRAIT_MARKERS = {
  openness: {
    high: [
      'imagine', 'creative', 'curious', 'wonder', 'explore', 'idea', 'concept',
      'abstract', 'philosophy', 'art', 'music', 'poetry', 'innovative', 'unique',
      'different', 'new', 'experience', 'adventure', 'dream', 'vision', 'inspire',
      'fascinating', 'interesting', 'beautiful', 'aesthetic', 'intellectual'
    ],
    low: [
      'practical', 'routine', 'traditional', 'conventional', 'same', 'usual',
      'normal', 'standard', 'simple', 'basic', 'plain', 'ordinary'
    ]
  },
  conscientiousness: {
    high: [
      'plan', 'organize', 'schedule', 'goal', 'achieve', 'accomplish', 'complete',
      'finish', 'deadline', 'responsible', 'careful', 'thorough', 'precise',
      'accurate', 'detail', 'systematic', 'efficient', 'productive', 'discipline',
      'focus', 'commit', 'reliable', 'consistent', 'prepared', 'ready'
    ],
    low: [
      'spontaneous', 'flexible', 'casual', 'relax', 'whatever', 'maybe', 'later',
      'eventually', 'sometime', 'lazy', 'messy', 'chaotic', 'random'
    ]
  },
  extraversion: {
    high: [
      'party', 'social', 'friends', 'people', 'talk', 'chat', 'meet', 'fun',
      'exciting', 'energetic', 'enthusiastic', 'outgoing', 'loud', 'active',
      'adventure', 'group', 'team', 'together', 'share', 'celebrate', 'enjoy',
      'love', 'amazing', 'awesome', 'great', 'fantastic', 'wonderful'
    ],
    low: [
      'alone', 'quiet', 'solitude', 'private', 'introvert', 'calm', 'peaceful',
      'reserved', 'shy', 'withdrawn', 'independent', 'solo', 'myself'
    ]
  },
  agreeableness: {
    high: [
      'help', 'kind', 'care', 'support', 'understand', 'empathy', 'compassion',
      'generous', 'trust', 'forgive', 'cooperate', 'team', 'together', 'share',
      'appreciate', 'grateful', 'thank', 'please', 'sorry', 'love', 'friend',
      'harmony', 'peace', 'gentle', 'patient', 'considerate', 'thoughtful'
    ],
    low: [
      'compete', 'win', 'fight', 'argue', 'disagree', 'challenge', 'confront',
      'critical', 'skeptical', 'suspicious', 'distrust', 'selfish', 'aggressive'
    ]
  },
  neuroticism: {
    high: [
      'worry', 'anxious', 'stress', 'nervous', 'fear', 'scared', 'panic',
      'overwhelm', 'depressed', 'sad', 'angry', 'frustrated', 'upset', 'hurt',
      'lonely', 'insecure', 'doubt', 'uncertain', 'confused', 'lost', 'stuck',
      'terrible', 'awful', 'horrible', 'worst', 'hate', 'can\'t', 'impossible'
    ],
    low: [
      'calm', 'relaxed', 'confident', 'secure', 'stable', 'peaceful', 'content',
      'happy', 'satisfied', 'comfortable', 'okay', 'fine', 'good', 'great'
    ]
  }
};

// First-person pronoun patterns (correlates with traits)
const FIRST_PERSON_SINGULAR = ['i', 'me', 'my', 'mine', 'myself'];
const FIRST_PERSON_PLURAL = ['we', 'us', 'our', 'ours', 'ourselves'];

// Certainty markers
const CERTAINTY_MARKERS = ['always', 'never', 'definitely', 'certainly', 'absolutely', 'must', 'will'];
const UNCERTAINTY_MARKERS = ['maybe', 'perhaps', 'might', 'could', 'possibly', 'sometimes', 'probably'];

/**
 * Analyze a single text for Big Five traits
 */
export function analyzeText(text: string): BigFiveProfile {
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;

  if (wordCount < 10) {
    return getDefaultProfile(0);
  }

  const wordSet = new Set(words);

  // Count markers for each trait
  const scores = {
    openness: calculateTraitScore(words, TRAIT_MARKERS.openness),
    conscientiousness: calculateTraitScore(words, TRAIT_MARKERS.conscientiousness),
    extraversion: calculateTraitScore(words, TRAIT_MARKERS.extraversion),
    agreeableness: calculateTraitScore(words, TRAIT_MARKERS.agreeableness),
    neuroticism: calculateTraitScore(words, TRAIT_MARKERS.neuroticism),
  };

  // Adjust based on pronoun usage
  const singularCount = words.filter(w => FIRST_PERSON_SINGULAR.includes(w)).length;
  const pluralCount = words.filter(w => FIRST_PERSON_PLURAL.includes(w)).length;
  const pronounRatio = singularCount / (pluralCount + 1);

  // High first-person singular correlates with lower agreeableness and higher neuroticism
  if (pronounRatio > 2) {
    scores.agreeableness -= 10;
    scores.neuroticism += 10;
  } else if (pronounRatio < 0.5) {
    scores.agreeableness += 10;
    scores.extraversion += 5;
  }

  // Certainty markers correlate with conscientiousness
  const certaintyCount = words.filter(w => CERTAINTY_MARKERS.includes(w)).length;
  const uncertaintyCount = words.filter(w => UNCERTAINTY_MARKERS.includes(w)).length;
  if (certaintyCount > uncertaintyCount) {
    scores.conscientiousness += 10;
    scores.openness -= 5;
  } else if (uncertaintyCount > certaintyCount) {
    scores.openness += 5;
    scores.conscientiousness -= 5;
  }

  // Calculate confidence based on word count
  const confidence = Math.min(100, Math.floor(wordCount / 5));

  return {
    openness: clamp(scores.openness),
    conscientiousness: clamp(scores.conscientiousness),
    extraversion: clamp(scores.extraversion),
    agreeableness: clamp(scores.agreeableness),
    neuroticism: clamp(scores.neuroticism),
    confidence,
  };
}

/**
 * Analyze multiple texts and aggregate the profile
 */
export function analyzePersonality(texts: string[]): BigFiveProfile {
  if (texts.length === 0) {
    return getDefaultProfile(0);
  }

  const profiles = texts.map(analyzeText);

  // Weight by confidence
  const totalWeight = profiles.reduce((sum, p) => sum + p.confidence, 0);

  if (totalWeight === 0) {
    return getDefaultProfile(0);
  }

  const aggregated = {
    openness: 0,
    conscientiousness: 0,
    extraversion: 0,
    agreeableness: 0,
    neuroticism: 0,
  };

  for (const profile of profiles) {
    const weight = profile.confidence / totalWeight;
    aggregated.openness += profile.openness * weight;
    aggregated.conscientiousness += profile.conscientiousness * weight;
    aggregated.extraversion += profile.extraversion * weight;
    aggregated.agreeableness += profile.agreeableness * weight;
    aggregated.neuroticism += profile.neuroticism * weight;
  }

  return {
    openness: Math.round(aggregated.openness),
    conscientiousness: Math.round(aggregated.conscientiousness),
    extraversion: Math.round(aggregated.extraversion),
    agreeableness: Math.round(aggregated.agreeableness),
    neuroticism: Math.round(aggregated.neuroticism),
    confidence: Math.min(100, Math.floor(totalWeight / profiles.length)),
  };
}

/**
 * Calculate trait score based on word markers
 */
function calculateTraitScore(
  words: string[],
  markers: { high: string[]; low: string[] }
): number {
  let score = 50; // Start at neutral

  const highSet = new Set(markers.high);
  const lowSet = new Set(markers.low);

  for (const word of words) {
    if (highSet.has(word)) {
      score += 3;
    } else if (lowSet.has(word)) {
      score -= 3;
    }
  }

  return score;
}

/**
 * Clamp value to 0-100 range
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Get default/neutral profile
 */
function getDefaultProfile(confidence: number): BigFiveProfile {
  return {
    openness: 50,
    conscientiousness: 50,
    extraversion: 50,
    agreeableness: 50,
    neuroticism: 50,
    confidence,
  };
}

/**
 * Describe a trait level in human terms
 */
export function describeOpenness(score: number): string {
  if (score >= 80) return 'highly creative and curious';
  if (score >= 60) return 'open to new ideas';
  if (score >= 40) return 'balanced between tradition and novelty';
  if (score >= 20) return 'prefers familiar approaches';
  return 'values tradition and practicality';
}

export function describeConscientiousness(score: number): string {
  if (score >= 80) return 'highly organized and disciplined';
  if (score >= 60) return 'goal-oriented and reliable';
  if (score >= 40) return 'flexible with structure';
  if (score >= 20) return 'spontaneous and adaptable';
  return 'free-spirited and casual';
}

export function describeExtraversion(score: number): string {
  if (score >= 80) return 'highly social and energetic';
  if (score >= 60) return 'outgoing and talkative';
  if (score >= 40) return 'ambivert - balanced';
  if (score >= 20) return 'reserved but not shy';
  return 'introverted and reflective';
}

export function describeAgreeableness(score: number): string {
  if (score >= 80) return 'highly cooperative and trusting';
  if (score >= 60) return 'friendly and considerate';
  if (score >= 40) return 'balanced in cooperation';
  if (score >= 20) return 'independent-minded';
  return 'competitive and challenging';
}

export function describeNeuroticism(score: number): string {
  if (score >= 80) return 'emotionally sensitive';
  if (score >= 60) return 'experiences strong emotions';
  if (score >= 40) return 'emotionally balanced';
  if (score >= 20) return 'emotionally stable';
  return 'very calm and resilient';
}

/**
 * Get full personality description
 */
export function getPersonalityDescription(profile: BigFiveProfile): string {
  const descriptions = [
    `Openness: ${profile.openness}% - ${describeOpenness(profile.openness)}`,
    `Conscientiousness: ${profile.conscientiousness}% - ${describeConscientiousness(profile.conscientiousness)}`,
    `Extraversion: ${profile.extraversion}% - ${describeExtraversion(profile.extraversion)}`,
    `Agreeableness: ${profile.agreeableness}% - ${describeAgreeableness(profile.agreeableness)}`,
    `Emotional Stability: ${100 - profile.neuroticism}% - ${describeNeuroticism(profile.neuroticism)}`,
  ];

  return descriptions.join('\n');
}
