import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QuickPassResult, ParsedConversation } from '@/lib/soulprint/types';

// Mock bedrockChatJSON before importing the module under test
vi.mock('@/lib/bedrock', () => ({
  bedrockChatJSON: vi.fn(),
}));

// Import after mock registration so the mock is in place
import { generateQuickPass, sectionsToSoulprintText } from '@/lib/soulprint/quick-pass';
import { bedrockChatJSON } from '@/lib/bedrock';

const mockedBedrockChatJSON = vi.mocked(bedrockChatJSON);

/**
 * Realistic mock QuickPassResult that satisfies the full interface.
 */
const MOCK_QUICK_PASS_RESULT: QuickPassResult = {
  soul: {
    communication_style: 'Direct and concise, prefers bullet points over paragraphs',
    personality_traits: ['analytical', 'curious', 'pragmatic', 'witty'],
    tone_preferences: 'Casual but informed, appreciates dry humor',
    boundaries: 'Dislikes unsolicited motivational platitudes',
    humor_style: 'Dry and sarcastic, enjoys wordplay',
    formality_level: 'casual',
    emotional_patterns: 'Reserved in text but occasionally passionate about tech topics',
  },
  identity: {
    ai_name: 'Axle',
    archetype: 'Pragmatic Tinkerer',
    vibe: 'A sharp-witted collaborator who skips the fluff and gets to the point',
    emoji_style: 'minimal',
    signature_greeting: "Hey -- what are we building today?",
  },
  user: {
    name: 'Drew',
    location: 'Austin, TX',
    occupation: 'Software engineer at a startup',
    relationships: ['partner named Alex', 'dog named Biscuit'],
    interests: ['TypeScript', 'AI tooling', 'mechanical keyboards', 'espresso'],
    life_context: 'Building a SaaS product while navigating startup life',
    preferred_address: 'Drew',
  },
  agents: {
    response_style: 'Concise with code examples when relevant',
    behavioral_rules: [
      'Skip unnecessary disclaimers',
      'Always show code before explaining it',
      'Use TypeScript in examples',
    ],
    context_adaptation: 'More detailed for architecture discussions, brief for quick questions',
    memory_directives: 'Remember project names, tech stack preferences, and past decisions',
    do_not: ['Use corporate jargon', 'Add motivational quotes'],
  },
  tools: {
    likely_usage: ['code review', 'architecture design', 'debugging'],
    capabilities_emphasis: ['coding', 'analysis', 'technical writing'],
    output_preferences: 'Code blocks with TypeScript, bullet points for explanations',
    depth_preference: 'Detailed for technical topics, brief for general questions',
  },
};

/**
 * Helper to create a minimal conversation array with enough messages
 * to pass sampling (>= 4 messages per conversation).
 */
function makeTestConversations(count = 5): ParsedConversation[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `conv-${i}`,
    title: `Test Conversation ${i}`,
    createdAt: '2025-06-15T12:00:00Z',
    messages: [
      { role: 'user', content: 'Hello, I need help with TypeScript.' },
      { role: 'assistant', content: 'Sure! What would you like to know?' },
      { role: 'user', content: 'How do generics work?' },
      { role: 'assistant', content: 'Generics allow you to write reusable type-safe code...' },
      { role: 'user', content: 'Can you show me an example?' },
      { role: 'assistant', content: 'Here is an example: function identity<T>(arg: T): T { return arg; }' },
    ],
  }));
}

// ---------------------------------------------------------------------------
// generateQuickPass
// ---------------------------------------------------------------------------

describe('generateQuickPass', () => {
  beforeEach(() => {
    mockedBedrockChatJSON.mockReset();
  });

  it('returns parsed QuickPassResult when Bedrock returns valid JSON', async () => {
    mockedBedrockChatJSON.mockResolvedValue(MOCK_QUICK_PASS_RESULT);

    const result = await generateQuickPass(makeTestConversations());

    expect(result).not.toBeNull();
    expect(result!.soul.communication_style).toBe(MOCK_QUICK_PASS_RESULT.soul.communication_style);
    expect(result!.identity.ai_name).toBe('Axle');
    expect(result!.user.name).toBe('Drew');
    expect(result!.agents.behavioral_rules).toHaveLength(3);
    expect(result!.tools.likely_usage).toContain('code review');
  });

  it('returns null when Bedrock returns data that fails Zod validation (non-object)', async () => {
    // Return a string instead of an object -- Zod should reject this
    mockedBedrockChatJSON.mockResolvedValue('not a valid object');

    const result = await generateQuickPass(makeTestConversations());
    expect(result).toBeNull();
  });

  it('returns null when Bedrock throws an error (never throws)', async () => {
    mockedBedrockChatJSON.mockRejectedValue(new Error('Bedrock service unavailable'));

    const result = await generateQuickPass(makeTestConversations());
    expect(result).toBeNull();
  });

  it('returns null when given empty conversations array', async () => {
    // With empty conversations, formatConversationsForPrompt returns ''
    // which triggers the early return null path
    const result = await generateQuickPass([]);
    expect(result).toBeNull();

    // Should not have called Bedrock at all
    expect(mockedBedrockChatJSON).not.toHaveBeenCalled();
  });

  it('calls bedrockChatJSON with model HAIKU_45', async () => {
    mockedBedrockChatJSON.mockResolvedValue(MOCK_QUICK_PASS_RESULT);

    await generateQuickPass(makeTestConversations());

    expect(mockedBedrockChatJSON).toHaveBeenCalledTimes(1);
    const callArgs = mockedBedrockChatJSON.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.model).toBe('HAIKU_45');
  });

  it('fills missing fields with defaults via Zod preprocess when Bedrock returns partial data', async () => {
    // Return a partial response -- Zod schema should fill defaults
    mockedBedrockChatJSON.mockResolvedValue({
      soul: { communication_style: 'Direct' },
      identity: { ai_name: 'Spark' },
      // user, agents, tools missing -- preprocess should default them to {}
      // and then field defaults kick in
    });

    const result = await generateQuickPass(makeTestConversations());

    expect(result).not.toBeNull();
    expect(result!.soul.communication_style).toBe('Direct');
    expect(result!.soul.personality_traits).toEqual([]); // default
    expect(result!.identity.ai_name).toBe('Spark');
    expect(result!.user.name).toBe(''); // default
    expect(result!.agents.behavioral_rules).toEqual([]); // default
    expect(result!.tools.likely_usage).toEqual([]); // default
  });
});

// ---------------------------------------------------------------------------
// sectionsToSoulprintText
// ---------------------------------------------------------------------------

describe('sectionsToSoulprintText', () => {
  it('returns a string containing all section headers', () => {
    const text = sectionsToSoulprintText(MOCK_QUICK_PASS_RESULT);

    expect(text).toContain('## Communication Style & Personality');
    expect(text).toContain('## Your AI Identity');
    expect(text).toContain('## About You');
    expect(text).toContain('## How I Operate');
    expect(text).toContain('## My Capabilities');
  });

  it('includes field values from each section', () => {
    const text = sectionsToSoulprintText(MOCK_QUICK_PASS_RESULT);

    expect(text).toContain('Direct and concise');
    expect(text).toContain('Axle');
    expect(text).toContain('Drew');
    expect(text).toContain('Concise with code examples');
    expect(text).toContain('code review');
  });

  it('formats array fields as bullet lists', () => {
    const text = sectionsToSoulprintText(MOCK_QUICK_PASS_RESULT);

    // personality_traits should be rendered as bullet list
    expect(text).toContain('- analytical');
    expect(text).toContain('- curious');
    expect(text).toContain('- pragmatic');

    // behavioral_rules should be rendered as bullet list
    expect(text).toContain('- Skip unnecessary disclaimers');
    expect(text).toContain('- Always show code before explaining it');
  });

  it('returns non-empty string for a valid QuickPassResult', () => {
    const text = sectionsToSoulprintText(MOCK_QUICK_PASS_RESULT);

    expect(text.length).toBeGreaterThan(0);
    // Reasonable length: at least 200 chars for a full result
    expect(text.length).toBeGreaterThan(200);
    // Should not be absurdly long (e.g., under 10KB for a profile)
    expect(text.length).toBeLessThan(10000);
  });
});
