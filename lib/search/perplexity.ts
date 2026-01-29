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

  // Add timeout to prevent hanging - 10s for normal, 30s for deep research
  const timeoutMs = isDeepSearch ? 30000 : 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

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
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[Perplexity] Request timed out after ${timeoutMs}ms`);
      throw new Error(`Perplexity request timed out after ${timeoutMs / 1000}s`);
    }
    console.error('[Perplexity] Query error:', error);
    throw error;
  }
}

/**
 * Determine if a message should SKIP Perplexity (memory/personal questions)
 * AGGRESSIVE MODE: Default to using Perplexity for everything except personal/memory questions
 */
export function needsRealtimeInfo(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // ONLY skip for clearly personal/memory-based questions
  const skipIndicators = [
    // Memory questions
    'remember when',
    'do you remember',
    'we talked about',
    'i told you',
    'you said',
    'last time we',
    'our conversation',
    'our last chat',
    
    // Personal profile questions
    'my name is',
    'my favorite',
    'about me',
    'my profile',
    'what do you know about me',
    'what\'s my',
    'who am i',
    
    // Simple greetings/chitchat (no research needed)
    'hello',
    'hi there',
    'hey',
    'good morning',
    'good night',
    'how are you',
    'thank you',
    'thanks',
    'bye',
    'goodbye',
  ];
  
  // Skip Perplexity ONLY if it matches a skip indicator
  if (skipIndicators.some(indicator => lowerMessage.includes(indicator))) {
    console.log('[Perplexity] Skipping - personal/memory question detected');
    return false;
  }

  // Also skip very short messages (likely greetings)
  if (lowerMessage.length < 10) {
    console.log('[Perplexity] Skipping - message too short');
    return false;
  }

  // DEFAULT: Use Perplexity for everything else
  // The LLM will combine its knowledge with real-time data
  console.log('[Perplexity] Will query - aggressive mode enabled');
  return true;
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
