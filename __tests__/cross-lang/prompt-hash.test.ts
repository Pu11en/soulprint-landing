/**
 * Cross-language prompt consistency test (PROMPT-02)
 *
 * Verifies that Python format_section() and TypeScript formatSection()
 * produce IDENTICAL output for the same inputs.
 *
 * This ensures RLM primary path and Next.js Bedrock fallback deliver
 * the same personality experience.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { formatSection, cleanSection } from '@/lib/soulprint/prompt-helpers';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

function hashString(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * Call Python format_section via subprocess
 * Uses temp file approach to avoid shell escaping issues
 */
function pythonFormatSection(sectionName: string, data: Record<string, unknown>): string {
  const tempDir = '/tmp';
  const scriptPath = path.join(tempDir, `test-format-${Date.now()}.py`);

  const script = `
import json
import sys
sys.path.insert(0, 'rlm-service')
from prompt_helpers import format_section

data = ${JSON.stringify(data)}
result = format_section("${sectionName}", data)
print(result, end='')
`;

  try {
    fs.writeFileSync(scriptPath, script);
    const result = execSync(`python3 ${scriptPath}`, {
      encoding: 'utf8',
      cwd: process.cwd(),
    });
    return result;
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(scriptPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Call Python clean_section via subprocess
 */
function pythonCleanSection(data: Record<string, unknown>): Record<string, unknown> | null {
  const tempDir = '/tmp';
  const scriptPath = path.join(tempDir, `test-clean-${Date.now()}.py`);

  const script = `
import json
import sys
sys.path.insert(0, 'rlm-service')
from prompt_helpers import clean_section

data = ${JSON.stringify(data)}
result = clean_section(data)
print(json.dumps(result), end='')
`;

  try {
    fs.writeFileSync(scriptPath, script);
    const result = execSync(`python3 ${scriptPath}`, {
      encoding: 'utf8',
      cwd: process.cwd(),
    });
    return JSON.parse(result);
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(scriptPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

describe('Cross-language prompt consistency (PROMPT-02)', () => {
  const testCases = [
    {
      name: 'string values only',
      sectionName: 'Communication Style & Personality',
      data: { communication_style: 'Direct and casual', tone: 'Friendly' },
    },
    {
      name: 'array values',
      sectionName: 'About This Person',
      data: { interests: ['AI', 'crypto', 'privacy'], name: 'Drew' },
    },
    {
      name: 'mixed strings and arrays',
      sectionName: 'How You Operate',
      data: { response_style: 'Concise', capabilities: ['coding', 'research', 'writing'] },
    },
    {
      name: 'with not enough data values (should be filtered)',
      sectionName: 'Your AI Identity',
      data: {
        persona: 'Helpful engineer',
        catchphrase: 'not enough data',
        traits: ['smart', 'not enough data', 'curious'],
      },
    },
    {
      name: 'empty section (all filtered)',
      sectionName: 'Empty Section',
      data: { empty: 'not enough data', also_empty: ['not enough data'] },
    },
    {
      name: 'snake_case to Title Case',
      sectionName: 'Test Section',
      data: { user_full_name: 'Drew Pullen', preferred_communication_style: 'Direct' },
    },
  ];

  testCases.forEach(({ name, sectionName, data }) => {
    it(`formatSection produces identical output for: ${name}`, () => {
      const tsOutput = formatSection(sectionName, data);
      const pyOutput = pythonFormatSection(sectionName, data);

      // Character-by-character comparison (primary check)
      expect(tsOutput).toBe(pyOutput);

      // Hash comparison for extra certainty
      expect(hashString(tsOutput)).toBe(hashString(pyOutput));
    });
  });

  it('cleanSection produces identical results', () => {
    const input = {
      name: 'Drew',
      location: 'not enough data',
      traits: ['curious', 'not enough data', 'thoughtful'],
      empty_array: [],
      skills: ['coding', 'writing'],
    };

    const tsResult = cleanSection(input);
    const pyResult = pythonCleanSection(input);

    // Compare JSON representations (order-independent)
    expect(JSON.stringify(tsResult, Object.keys(tsResult || {}).sort())).toBe(
      JSON.stringify(pyResult, Object.keys(pyResult || {}).sort())
    );
  });

  it('formatSection handles empty data', () => {
    const tsOutput = formatSection('Empty', null);
    const pyOutput = pythonFormatSection('Empty', {});

    expect(tsOutput).toBe('');
    expect(pyOutput).toBe('');
  });

  it('formatSection handles complex nested case', () => {
    const data = {
      user_name: 'Drew Pullen',
      user_interests: ['AI research', 'privacy tech', 'not enough data', 'crypto'],
      user_location: 'not enough data',
      preferred_ai_style: 'Direct and concise',
    };

    const tsOutput = formatSection('Complex Test', data);
    const pyOutput = pythonFormatSection('Complex Test', data);

    // Should filter "not enough data" and "user_location" entirely
    expect(tsOutput).not.toContain('not enough data');
    expect(pyOutput).not.toContain('not enough data');

    // Should have same hash
    expect(hashString(tsOutput)).toBe(hashString(pyOutput));
  });
});
