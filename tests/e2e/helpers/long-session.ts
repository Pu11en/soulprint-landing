import { Page } from '@playwright/test';

/**
 * Long-Session Test Helpers
 *
 * Helper functions for testing multi-turn conversations (10+ messages)
 * to detect personality drift and validate conversation consistency.
 */

/**
 * Send a message in the chat UI and wait for assistant response
 */
export async function sendMessage(page: Page, message: string): Promise<string> {
  // Fill chat input - use resilient selector that works with different UI implementations
  const inputSelector = 'textarea, [data-testid="chat-input"]';
  await page.locator(inputSelector).first().fill(message);

  // Click send button
  const sendButtonSelector = 'button[type="submit"], [data-testid="send-button"]';
  await page.locator(sendButtonSelector).first().click();

  // Wait for assistant response to appear
  const assistantMessageSelector = '[data-testid="assistant-message"], .assistant-message';
  await page.locator(assistantMessageSelector).last().waitFor({ state: 'visible' });

  // Wait for streaming to complete - assistant messages may be streaming
  await page.waitForTimeout(3000);

  // Get the last assistant message text
  const responseText = await page.locator(assistantMessageSelector).last().textContent();
  return responseText || '';
}

/**
 * Run a long session with multiple messages, simulating human pace
 */
export async function runLongSession(
  page: Page,
  messages: string[]
): Promise<string[]> {
  const responses: string[] = [];

  for (const message of messages) {
    const response = await sendMessage(page, message);
    responses.push(response);

    // Add small delay between messages to simulate human typing pace
    await page.waitForTimeout(500);
  }

  return responses;
}

/**
 * Detect personality drift by checking for chatbot patterns in responses
 *
 * Returns drift detection results with violation counts for early vs late messages
 */
export function detectPersonalityDrift(responses: string[]): {
  drifted: boolean;
  earlyViolations: number;
  lateViolations: number;
  details: string[];
} {
  // Patterns that indicate chatbot-like behavior (loss of personalization)
  const chatbotPatterns = [
    { name: 'Generic greetings', regex: /^(Hey there|Great question|I'm just an AI)/i },
    { name: 'AI disclaimers', regex: /(as an AI|I don't have personal|I can't actually)/i },
    { name: 'Generic affirmations', regex: /^(Sure|Absolutely|Of course)[\s!,]/i },
  ];

  const details: string[] = [];

  // Check early messages (first 3)
  const earlyResponses = responses.slice(0, 3);
  let earlyViolations = 0;

  earlyResponses.forEach((response, idx) => {
    chatbotPatterns.forEach((pattern) => {
      if (pattern.regex.test(response)) {
        earlyViolations++;
        details.push(`Early message ${idx + 1}: ${pattern.name}`);
      }
    });
  });

  // Check late messages (last 3)
  const lateResponses = responses.slice(-3);
  let lateViolations = 0;

  lateResponses.forEach((response, idx) => {
    chatbotPatterns.forEach((pattern) => {
      if (pattern.regex.test(response)) {
        lateViolations++;
        details.push(`Late message ${responses.length - 3 + idx + 1}: ${pattern.name}`);
      }
    });
  });

  // Drift detected if:
  // 1. Late messages have MORE violations than early ones (degradation over time)
  // 2. OR late messages have 2+ violations (significant chatbot behavior)
  const drifted = lateViolations > earlyViolations || lateViolations >= 2;

  return {
    drifted,
    earlyViolations,
    lateViolations,
    details,
  };
}
