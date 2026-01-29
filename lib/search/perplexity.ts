/**
 * Perplexity API Integration
 * Provides real-time information for news, current events, and time-sensitive queries
 */

export interface PerplexityResponse {
  answer: string;
  query: string;
  citations: string[];
  isDeepSearch?: boolean;
}

export type PerplexityModel = 'sonar' | 'sonar-deep-research';

/**
 * Query Perplexity's sonar model for real-time information
 * @param query - The search query
 * @param options.model - 'sonar' for quick search, 'sonar-deep-research' for comprehensive research
 * @param options.maxTokens - Maximum tokens for response
 */
export async function queryPerplexity(
  query: string,
  options: {
    model?: PerplexityModel;
    maxTokens?: number;
  } = {}
): Promise<PerplexityResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const { model = 'sonar', maxTokens = model === 'sonar-deep-research' ? 4096 : 1024 } = options;
  const isDeepSearch = model === 'sonar-deep-research';

  // Deep research gets a more thorough system prompt
  const systemPrompt = isDeepSearch
    ? 'You are a comprehensive research assistant. Provide thorough, well-researched information with multiple sources. Cover all aspects of the topic, include relevant context, and cite your sources clearly.'
    : 'You are a helpful assistant. Provide accurate, up-to-date information with sources. Be concise but comprehensive.';

  console.log(`[Perplexity] Using model: ${model}, isDeepSearch: ${isDeepSearch}`);

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
            content: systemPrompt,
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
      isDeepSearch,
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

  const header = response.isDeepSearch 
    ? '[🔍 Deep Research Results from Perplexity]'
    : '[Real-Time Information from Perplexity]';

  const lines = [header];
  lines.push(response.answer);
  
  if (response.citations.length > 0) {
    lines.push('');
    lines.push('Sources:');
    // Deep search gets more citations displayed
    const citationLimit = response.isDeepSearch ? 8 : 5;
    response.citations.slice(0, citationLimit).forEach((citation, i) => {
      lines.push(`${i + 1}. ${citation}`);
    });
  }

  return lines.join('\n');
}

/**
 * Format sources/citations for display in chat messages
 * Returns a formatted string with clickable source links
 */
export function formatSourcesForDisplay(citations: string[]): string {
  if (!citations || citations.length === 0) {
    return '';
  }

  const sources = citations.slice(0, 6).map((url, i) => {
    // Extract domain name for cleaner display
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return `[${i + 1}] ${domain}`;
    } catch {
      return `[${i + 1}] ${url}`;
    }
  });

  return `\n\n📚 **Sources:**\n${sources.join(' • ')}`;
}
