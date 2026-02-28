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
