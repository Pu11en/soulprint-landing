/**
 * Prompt Helpers for SoulPrint Section Processing
 *
 * Pure functions for validating and formatting section data for prompts.
 * These helpers ensure:
 * 1. No "not enough data" placeholders in prompts (MEM-02)
 * 2. Consistent markdown formatting (PROMPT-02)
 * 3. Deterministic output (same input always produces same output)
 *
 * Used by both Next.js and RLM prompt builders.
 */

const PLACEHOLDER_PATTERN = /^not enough data$/i;

/**
 * Check if a string is empty, whitespace-only, or "not enough data"
 */
function isEmptyOrPlaceholder(value: string): boolean {
  return !value || value.trim() === '' || PLACEHOLDER_PATTERN.test(value.trim());
}

/**
 * Clean a section object by removing placeholder/empty values
 *
 * Filters out:
 * - Strings that are empty, whitespace-only, or "not enough data" (case-insensitive)
 * - Arrays that are empty or contain only "not enough data" items
 *
 * Returns null if ALL values are removed (fully empty section)
 *
 * @param data - Section data object
 * @returns Cleaned object or null if all values were placeholders/empty
 */
export function cleanSection(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) {
    return null;
  }

  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Handle string values
    if (typeof value === 'string') {
      if (!isEmptyOrPlaceholder(value)) {
        cleaned[key] = value;
      }
      continue;
    }

    // Handle array values
    if (Array.isArray(value)) {
      const filteredArray = value.filter((item) => {
        if (typeof item === 'string') {
          return !isEmptyOrPlaceholder(item);
        }
        return true; // Keep non-string items
      });

      if (filteredArray.length > 0) {
        cleaned[key] = filteredArray;
      }
      continue;
    }

    // Preserve other value types (numbers, booleans, objects)
    if (value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  }

  // Return null if no valid data remains
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

/**
 * Convert snake_case to Title Case
 * Example: "communication_style" → "Communication Style"
 */
function snakeToTitleCase(snakeCase: string): string {
  return snakeCase
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format a section object into markdown
 *
 * Formatting rules (PROMPT-02 consistency):
 * - Section heading: `## ${sectionName}`
 * - String fields: `**${TitleCase Label}:** ${value}`
 * - Array fields: `**${TitleCase Label}:**\n- item1\n- item2`
 * - Empty/placeholder values are skipped (no line generated)
 * - Defensive filtering: removes "not enough data" even if cleanSection wasn't called
 *
 * @param sectionName - Display name for the section heading
 * @param data - Section data object
 * @returns Markdown-formatted string, or empty string if no valid data
 */
export function formatSection(sectionName: string, data: Record<string, unknown> | null): string {
  if (!data || Object.keys(data).length === 0) {
    return '';
  }

  const lines: string[] = [`## ${sectionName}`];

  // Sort keys for deterministic output
  const sortedKeys = Object.keys(data).sort();

  for (const key of sortedKeys) {
    const value = data[key];
    const label = snakeToTitleCase(key);

    // Handle string values
    if (typeof value === 'string') {
      // Defensive: skip empty/placeholder even if cleanSection wasn't called
      if (isEmptyOrPlaceholder(value)) {
        continue;
      }
      lines.push(`**${label}:** ${value}`);
      continue;
    }

    // Handle array values
    if (Array.isArray(value)) {
      // Defensive: filter out "not enough data" items
      const validItems = value.filter((item) => {
        if (typeof item === 'string') {
          return !isEmptyOrPlaceholder(item);
        }
        return true;
      });

      if (validItems.length === 0) {
        continue;
      }

      lines.push(`**${label}:**`);
      validItems.forEach((item) => {
        lines.push(`- ${item}`);
      });
      continue;
    }

    // Handle other types (numbers, booleans, etc.)
    if (value !== null && value !== undefined) {
      lines.push(`**${label}:** ${value}`);
    }
  }

  // If only heading remains (all values filtered out), return empty string
  return lines.length > 1 ? lines.join('\n') : '';
}
