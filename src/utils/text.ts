export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function countLines(s: string): number {
  if (s.length === 0) return 0;
  return s.split('\n').length;
}

export function truncateToLines(s: string, maxLines: number): string {
  const lines = s.split('\n');
  if (lines.length <= maxLines) return s;
  return lines.slice(0, maxLines).join('\n');
}

/**
 * Patterns that match auto-generated boilerplate messages, not real project content.
 * These are filtered from snapshot extraction to avoid polluting knowledge capture
 * with context-restoration artifacts.
 */
const BOILERPLATE_PATTERNS: RegExp[] = [
  /^this session is being continued from a previous conversation/i,
];

/**
 * Check if a message is auto-generated boilerplate that should be excluded
 * from snapshot extraction. Boilerplate includes session continuation summaries
 * and other context-restoration artifacts that contain signal keywords but
 * no real project knowledge.
 */
export function isBoilerplate(content: string): boolean {
  const trimmed = content.trimStart();
  return BOILERPLATE_PATTERNS.some((p) => p.test(trimmed));
}
