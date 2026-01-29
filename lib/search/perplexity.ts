/**
 * Perplexity API Integration
 * Provides real-time information for news, current events, and time-sensitive queries
 */

export interface PerplexityResponse {
  answer: string;
  query: string;
  citations: string[];
}

/**
 * Query Perplexity's sonar model for real-time information
 */
export async function queryPerplexity(
  query: string,
  options: {
    model?: string;
    maxTokens?: number;
  } = {}
): Promise<PerplexityResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const { model = 'sonar', maxTokens = 1024 } = options;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Provide accurate, up-to-date information with sources. Be concise but comprehensive.',
          },
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens: maxTokens,
        return_citations: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Perplexity] API error:', response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract citations from the response
    const citations: string[] = data.citations || [];
    const answer = data.choices?.[0]?.message?.content || '';

    return {
      answer,
      query,
      citations,
    };
  } catch (error) {
    console.error('[Perplexity] Query error:', error);
    throw error;
  }
}

/**
 * Determine if a message needs real-time/news information from Perplexity
 * More specific than general web search - focused on current events and news
 */
export function needsRealtimeInfo(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Skip memory-based questions
  const memoryIndicators = [
    'remember when',
    'do you remember',
    'we talked about',
    'i told you',
    'you said',
    'last time',
    'my favorite',
    'my name',
    'about me',
    'our conversation',
    'my profile',
  ];
  
  if (memoryIndicators.some(indicator => lowerMessage.includes(indicator))) {
    return false;
  }

  // Time-sensitive indicators
  const realtimeIndicators = [
    // News and events
    'news',
    'headlines',
    'breaking',
    'happening',
    'update on',
    'latest',
    
    // Time references
    'today',
    'yesterday',
    'this week',
    'this month',
    'right now',
    'currently',
    'recent',
    'just happened',
    
    // Current information
    'current',
    'live',
    'real-time',
    'realtime',
    
    // Specific queries that need fresh data
    'stock price',
    'weather',
    'score',
    'election',
    'results',
    
    // Question patterns about current state
    'what\'s happening',
    'what is happening',
    'what happened',
    'who won',
    'who is winning',
    'is it true that',
    'did they',
  ];

  // Check for realtime indicators
  if (realtimeIndicators.some(indicator => lowerMessage.includes(indicator))) {
    return true;
  }

  // Check for recent year references (2024, 2025, 2026)
  const yearMatch = lowerMessage.match(/20(2[4-9]|[3-9]\d)/);
  if (yearMatch) {
    return true;
  }

  return false;
}

/**
 * Format Perplexity response for AI context
 */
export function formatPerplexityContext(response: PerplexityResponse): string {
  if (!response.answer) {
    return '';
  }

  const lines = ['[Real-Time Information from Perplexity]'];
  lines.push(response.answer);
  
  if (response.citations.length > 0) {
    lines.push('');
    lines.push('Sources:');
    response.citations.slice(0, 5).forEach((citation, i) => {
      lines.push(`${i + 1}. ${citation}`);
    });
  }

  return lines.join('\n');
}
