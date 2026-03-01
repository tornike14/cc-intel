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

const BOILERPLATE_PATTERNS: RegExp[] = [
  /^this session is being continued from a previous conversation/i,
];

export function isBoilerplate(content: string): boolean {
  const trimmed = content.trimStart();
  return BOILERPLATE_PATTERNS.some((p) => p.test(trimmed));
}

const FILLER_LINE_PATTERNS: RegExp[] = [
  /^(yes|no|good|great|sure|okay|ok|alright|understood|got it|done|right|exactly|absolutely|correct|perfect)\b[^a-z]*$/i,
  /^(yes|no|good|great|sure|okay|ok|alright|understood|got it|done|right|exactly|absolutely|correct|perfect)\b\s*[,—–-]/i,
  /^(let me|i'll|i will|i can|i need to|i should)\s+(check|look|examine|review|investigate|read|search|find|verify|see|help|fix|update|start)/i,
  /^(here's|here is)\s+(what|the|a|my|an)\s/i,
  /^(good|great|honest)\s+(question|analysis|point|catch|observation|call)\b/i,
  /^now\s+(let me|i'll|i need to|i should)\s/i,
];

function isFillerLine(line: string): boolean {
  return FILLER_LINE_PATTERNS.some((p) => p.test(line));
}

/** Extract the first substantive line, skipping filler openings. */
export function extractSubstantiveLine(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 10) continue;
    if (isFillerLine(trimmed)) continue;
    return trimmed;
  }
  // Fallback: return first non-empty line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return content.trim();
}
