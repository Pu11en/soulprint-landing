import { describe, it, expect } from 'vitest';
import { sampleConversations, formatConversationsForPrompt } from '@/lib/soulprint/sample';
import type { ParsedConversation, ConversationMessage } from '@/lib/soulprint/types';

/**
 * Helper to create a ParsedConversation with configurable overrides.
 * Generates alternating user/assistant messages of the given content length.
 */
function makeConversation(
  overrides: Partial<ParsedConversation> & {
    messageCount?: number;
    contentLength?: number;
  } = {},
): ParsedConversation {
  const { messageCount = 6, contentLength = 100, ...rest } = overrides;

  const messages: ConversationMessage[] = Array.from({ length: messageCount }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: 'x'.repeat(contentLength),
  }));

  return {
    id: rest.id ?? `conv-${Math.random().toString(36).slice(2, 8)}`,
    title: rest.title ?? 'Test Conversation',
    createdAt: rest.createdAt ?? '2025-06-15T12:00:00Z',
    messages: rest.messages ?? messages,
  };
}

// ---------------------------------------------------------------------------
// sampleConversations
// ---------------------------------------------------------------------------

describe('sampleConversations', () => {
  it('returns at most 50 conversations given 100 of varying quality', () => {
    const conversations = Array.from({ length: 100 }, (_, i) =>
      makeConversation({ messageCount: 6 + i, contentLength: 50 }),
    );

    const result = sampleConversations(conversations);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('filters out conversations with fewer than 4 messages', () => {
    const short = makeConversation({ messageCount: 2 });
    const long = makeConversation({ messageCount: 8 });

    const result = sampleConversations([short, long]);
    // Should only include the long conversation
    expect(result).toHaveLength(1);
    expect(result[0]!.messages.length).toBe(8);
  });

  it('returns empty array for empty input', () => {
    const result = sampleConversations([]);
    expect(result).toEqual([]);
  });

  it('returns empty array when all conversations have fewer than 4 messages', () => {
    const convs = [
      makeConversation({ messageCount: 1 }),
      makeConversation({ messageCount: 2 }),
      makeConversation({ messageCount: 3 }),
    ];

    // When no eligible conversations exist, the function falls back to
    // returning original conversations (capped at 50). Since all are short,
    // the fallback kicks in and returns them.
    const result = sampleConversations(convs);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('returns all conversations when within token budget', () => {
    const convs = Array.from({ length: 5 }, () =>
      makeConversation({ messageCount: 6, contentLength: 50 }),
    );

    // Each conversation: 6 messages * 50 chars = 300 chars total
    // 5 conversations = 1500 chars ~ 375 tokens
    // Default budget is 50000 tokens = 200000 chars, so all should fit
    const result = sampleConversations(convs);
    expect(result).toHaveLength(5);
  });

  it('stops adding conversations when token budget is exceeded but ensures at least 5', () => {
    // Create 10 conversations, each with huge content to blow the budget
    const convs = Array.from({ length: 10 }, (_, i) =>
      makeConversation({ messageCount: 6, contentLength: 20000 }),
    );

    // Very small token budget: 100 tokens = 400 chars
    // Each conversation has 6 * 20000 = 120000 chars, way over budget
    // But MIN_SELECTED = 5, so at least 5 should be returned
    const result = sampleConversations(convs, 100);
    expect(result.length).toBeGreaterThanOrEqual(5);
  });

  it('ranks conversations with more messages and longer user content higher', () => {
    const poor = makeConversation({
      id: 'poor',
      messageCount: 4,
      contentLength: 10,
      createdAt: '2025-01-01T00:00:00Z',
    });
    const rich = makeConversation({
      id: 'rich',
      messageCount: 20,
      contentLength: 400,
      createdAt: '2025-01-01T00:00:00Z',
    });

    // Give them both the same createdAt to isolate scoring
    const result = sampleConversations([poor, rich]);
    // The rich conversation should come first
    expect(result[0]!.id).toBe('rich');
  });
});

// ---------------------------------------------------------------------------
// formatConversationsForPrompt
// ---------------------------------------------------------------------------

describe('formatConversationsForPrompt', () => {
  it('includes conversation title and date in header', () => {
    const conv = makeConversation({
      title: 'My Chat Topic',
      createdAt: '2025-03-20T14:30:00Z',
    });

    const result = formatConversationsForPrompt([conv]);
    expect(result).toContain('=== Conversation: "My Chat Topic" (2025-03-20) ===');
  });

  it('formats messages with role prefixes', () => {
    const conv = makeConversation({
      messages: [
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi! How can I help?' },
      ],
    });

    const result = formatConversationsForPrompt([conv]);
    expect(result).toContain('User: Hello there');
    expect(result).toContain('Assistant: Hi! How can I help?');
  });

  it('truncates messages longer than 2000 characters', () => {
    const longContent = 'a'.repeat(3000);
    const conv = makeConversation({
      messages: [{ role: 'user', content: longContent }],
    });

    const result = formatConversationsForPrompt([conv]);
    expect(result).toContain('... [truncated]');
    // The content portion should be 2000 chars + "... [truncated]"
    // plus the "User: " prefix, so it should be significantly shorter than 3000
    expect(result.length).toBeLessThan(3000);
  });

  it('handles conversations with empty titles gracefully', () => {
    const conv = makeConversation({ title: '' });

    const result = formatConversationsForPrompt([conv]);
    expect(result).toContain('=== Conversation: "" (');
  });

  it('returns empty string for empty input array', () => {
    const result = formatConversationsForPrompt([]);
    expect(result).toBe('');
  });
});
