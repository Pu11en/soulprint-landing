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
 * Determine if a message needs real-time data from Perplexity
 * SMART MODE: Use Perplexity only when the question likely needs CURRENT information
 * LLM handles everything else (it already knows a lot)
 */
export function needsRealtimeInfo(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // SKIP: Personal/memory questions - LLM + memory handles these
  const memoryIndicators = [
    'remember when', 'do you remember', 'we talked about', 'i told you',
    'you said', 'last time we', 'our conversation', 'my name', 'my favorite',
    'about me', 'my profile', 'what do you know about me', 'who am i',
  ];
  
  if (memoryIndicators.some(ind => lowerMessage.includes(ind))) {
    console.log('[Perplexity] Skip - memory/personal question');
    return false;
  }

  // SKIP: Simple greetings and short messages
  const greetings = ['hello', 'hi there', 'hey', 'good morning', 'good night', 
    'how are you', 'thank you', 'thanks', 'bye', 'goodbye', 'ok', 'okay'];
  if (greetings.some(g => lowerMessage === g || lowerMessage.startsWith(g + ' ')) || lowerMessage.length < 15) {
    console.log('[Perplexity] Skip - greeting or short message');
    return false;
  }

  // SKIP: Timeless knowledge questions - LLM knows these
  const timelessIndicators = [
    'how to ', 'how do i ', 'what is a ', 'what are ', 'explain ', 'define ',
    'tutorial', 'example of', 'difference between', 'why does', 'why do',
    'help me with', 'can you help', 'write a ', 'write me', 'create a',
    'code for', 'function that', 'script to', 'program that',
  ];
  
  if (timelessIndicators.some(ind => lowerMessage.includes(ind))) {
    // But check if it's asking about something current
    const currentModifiers = ['latest', 'newest', 'recent', '2024', '2025', '2026', 'today', 'this week'];
    if (!currentModifiers.some(mod => lowerMessage.includes(mod))) {
      console.log('[Perplexity] Skip - timeless knowledge question');
      return false;
    }
  }

  // USE PERPLEXITY: Questions about things that change
  const realtimeIndicators = [
    // News and current events
    'news', 'headlines', 'breaking', 'happening', 'update on', 'latest',
    'today', 'yesterday', 'this week', 'this month', 'right now', 'currently',
    'recent', 'just happened', 'current', 'live', 'real-time',
    // Data that changes
    'stock', 'price', 'weather', 'score', 'election', 'results', 'worth',
    'cost', 'rate', 'forecast', 'prediction',
    // Current state questions  
    'what\'s happening', 'what is happening', 'what happened', 'who won',
    'who is winning', 'is it true', 'did they', 'has ', 'have they',
    // Specific entities that might have recent news
    'company', 'ceo', 'president', 'released', 'announced', 'launched',
  ];

  if (realtimeIndicators.some(ind => lowerMessage.includes(ind))) {
    console.log('[Perplexity] Use - realtime indicator found');
    return true;
  }

  // Check for recent year references
  if (/20(2[4-9]|[3-9]\d)/.test(lowerMessage)) {
    console.log('[Perplexity] Use - recent year mentioned');
    return true;
  }

  // Check if it's a factual question that MIGHT need current data
  const factualPatterns = [
    /^(what|who|where|when|how much|how many|is |are |does |do |did |has |have |will )/,
  ];
  
  if (factualPatterns.some(pattern => pattern.test(lowerMessage))) {
    // For factual questions, use Perplexity to be safe
    console.log('[Perplexity] Use - factual question detected');
    return true;
  }

  // DEFAULT: Skip - let LLM handle it
  console.log('[Perplexity] Skip - LLM can handle this');
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
