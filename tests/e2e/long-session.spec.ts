import { test, expect } from '@playwright/test';
import { runLongSession, detectPersonalityDrift } from './helpers/long-session';

/**
 * Long-Session E2E Tests
 *
 * These tests validate personality consistency across 10+ message conversations
 * to detect attention decay, personality drift, and uncanny valley effects.
 *
 * Tests are marked as .skip because they require an authenticated user with a
 * completed soulprint. Run manually with:
 *   npx playwright test long-session --headed
 */
test.describe('Long Session Tests', () => {
  // Long sessions need extended timeout for LLM response times
  test.setTimeout(180_000); // 3 minutes

  test.skip('10-message conversation maintains personality consistency', async ({ page }) => {
    // Requires authenticated user with completed soulprint. Run manually: npx playwright test long-session --headed

    // Navigate to chat page (assumes user is already authenticated)
    await page.goto('/chat');

    // Wait for chat interface to be ready
    await page.waitForSelector('textarea, [data-testid="chat-input"]', { timeout: 10000 });

    // Define 10 diverse messages that test different personality aspects
    const messages = [
      'Tell me about my career goals',
      'What projects did I mention working on?',
      'How do I usually handle stress?',
      'What are my communication preferences?',
      'Remind me about my leadership style',
      'What hobbies do I enjoy?',
      'How do I typically approach learning new things?',
      'What are my relationship priorities?',
      'Describe my work-life balance approach',
      'What are my long-term aspirations?',
    ];

    // Run long session and collect all responses
    const responses = await runLongSession(page, messages);

    // Validate all responses are non-empty
    for (let i = 0; i < responses.length; i++) {
      expect(responses[i].length, `Response ${i + 1} should not be empty`).toBeGreaterThan(20);
    }

    // Run personality drift detection
    const driftResult = detectPersonalityDrift(responses);

    // Log drift detection results for debugging
    console.log('Drift detection results:', driftResult);

    // Validate no personality drift detected
    expect(driftResult.drifted,
      `Personality drift detected: ${driftResult.details.join(', ')}`
    ).toBe(false);

    // Additional check: no response should start with generic chatbot patterns
    const genericChatbotPattern = /^(Hey there|Great question|I'm just an AI)/i;
    for (let i = 0; i < responses.length; i++) {
      expect(responses[i], `Response ${i + 1} should not use generic chatbot opener`).not.toMatch(genericChatbotPattern);
    }
  });

  test('personality drift detection catches degradation', () => {
    // Unit-style test of detectPersonalityDrift function
    // Mock responses where late messages have chatbot patterns

    const mockResponses = [
      // Early messages: personalized, no chatbot patterns
      'Based on our previous conversations about your career in software engineering, your goals focus on...',
      'You mentioned working on the SoulPrint project, which involves building a privacy-first AI personalization platform...',
      'From what you told me, you handle stress by taking structured breaks and breaking down problems systematically...',

      // Middle messages: still personalized
      'Your communication style tends to be direct and concise, you prefer getting straight to the point...',
      'You described yourself as having a collaborative leadership style that empowers team members...',
      'Your hobbies include hiking, reading sci-fi novels, and experimenting with new programming languages...',

      // Late messages: degraded to chatbot patterns (drift)
      'Great question! When it comes to learning new things, there are several approaches you could consider...',
      'As an AI, I don\'t have personal knowledge about your specific relationship priorities, but...',
      'Hey there! Work-life balance is important for everyone. Generally speaking, you might want to...',
      'Sure! Long-term aspirations can vary widely depending on individual circumstances and goals...',
    ];

    const result = detectPersonalityDrift(mockResponses);

    // Should detect drift
    expect(result.drifted).toBe(true);

    // Late messages should have more violations than early ones
    expect(result.lateViolations).toBeGreaterThan(result.earlyViolations);

    // Should provide details about violations
    expect(result.details.length).toBeGreaterThan(0);

    // Log details for debugging
    console.log('Drift detection test details:', result.details);
  });

  test('personality drift detection passes for consistent responses', () => {
    // Unit-style test with consistently personalized responses

    const mockResponses = [
      // All messages consistently personalized, no chatbot patterns
      'Based on our previous conversations about your career in software engineering...',
      'You mentioned working on the SoulPrint project, which involves building...',
      'From what you told me, you handle stress by taking structured breaks...',
      'Your communication style tends to be direct and concise...',
      'You described yourself as having a collaborative leadership style...',
      'Your hobbies include hiking, reading sci-fi novels, and experimenting...',
      'You approach learning new things methodically, preferring hands-on experimentation...',
      'You prioritize authenticity and deep connection in your relationships...',
      'You maintain work-life balance through clear boundaries and scheduled downtime...',
      'Your long-term aspirations center around building impactful technology products...',
    ];

    const result = detectPersonalityDrift(mockResponses);

    // Should NOT detect drift
    expect(result.drifted).toBe(false);

    // Both early and late violations should be zero
    expect(result.earlyViolations).toBe(0);
    expect(result.lateViolations).toBe(0);
  });
});
