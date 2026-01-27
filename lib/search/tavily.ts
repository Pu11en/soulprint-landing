/**
 * Tavily Web Search Integration
 * Provides real-time web search capabilities for the chat AI
 */

import { tavily } from '@tavily/core';

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  answer?: string;
}

/**
 * Search the web using Tavily
 */
export async function searchWeb(
  query: string,
  options: {
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
    includeAnswer?: boolean;
  } = {}
): Promise<SearchResponse> {
  const { maxResults = 5, searchDepth = 'basic', includeAnswer = true } = options;

  try {
    const response = await client.search(query, {
      maxResults,
      searchDepth,
      includeAnswer,
    });

    return {
      results: response.results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score || 0,
      })),
      query,
      answer: response.answer,
    };
  } catch (error) {
    console.error('[Tavily] Search error:', error);
    throw error;
  }
}

/**
 * Determine if a message likely needs web search
 * Simple heuristic - can be improved with AI classification
 */
export function shouldSearchWeb(message: string): boolean {
  const searchIndicators = [
    'search for',
    'look up',
    'find out',
    'what is the latest',
    'current',
    'today',
    'recent',
    'news about',
    'who is',
    'what happened',
    'how do i',
    'where can i',
    'best way to',
    'latest on',
    '2024',
    '2025',
    '2026',
  ];

  const lowerMessage = message.toLowerCase();
  return searchIndicators.some((indicator) => lowerMessage.includes(indicator));
}

/**
 * Format search results for AI context
 */
export function formatSearchContext(response: SearchResponse): string {
  if (!response.results.length) {
    return '';
  }

  const lines = ['[Web Search Results]'];
  
  if (response.answer) {
    lines.push(`Quick Answer: ${response.answer}`);
    lines.push('');
  }

  for (const result of response.results.slice(0, 3)) {
    lines.push(`• ${result.title}`);
    lines.push(`  ${result.content.slice(0, 200)}...`);
    lines.push(`  Source: ${result.url}`);
    lines.push('');
  }

  return lines.join('\n');
}
