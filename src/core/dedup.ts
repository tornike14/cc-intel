import { normalizeWhitespace } from '../utils/text.js';

export interface DedupEntry {
  text: string;
  timestamp?: string;
}

/**
 * Dice coefficient on character bigrams.
 * Returns similarity between 0 and 1.
 */
export function computeSimilarity(a: string, b: string): number {
  const normA = normalizeWhitespace(a).toLowerCase();
  const normB = normalizeWhitespace(b).toLowerCase();

  if (normA === normB) return 1;
  if (normA.length < 2 || normB.length < 2) return 0;

  const bigramsA = getBigrams(normA);
  const bigramsB = getBigrams(normB);

  let intersection = 0;
  const countB = new Map(bigramsB);

  for (const [bigram, countA] of bigramsA) {
    const cB = countB.get(bigram) ?? 0;
    intersection += Math.min(countA, cB);
  }

  const totalA = sumValues(bigramsA);
  const totalB = sumValues(bigramsB);

  return (2 * intersection) / (totalA + totalB);
}

function getBigrams(s: string): Map<string, number> {
  const bigrams = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const pair = s.substring(i, i + 2);
    bigrams.set(pair, (bigrams.get(pair) ?? 0) + 1);
  }
  return bigrams;
}

function sumValues(map: Map<string, number>): number {
  let sum = 0;
  for (const v of map.values()) sum += v;
  return sum;
}

/**
 * Check if one entry is a truncated prefix of another.
 * Handles dedup across truncation limit changes (e.g., 150→500 chars).
 *
 * Strips leading bullet markers (`- `) and trailing ellipsis (`...`) before
 * comparing, so `- Decided to use React...` matches `- Decided to use React for SSR`.
 */
export function isPrefixMatch(a: string, b: string): boolean {
  const normA = normalizeForPrefix(a);
  const normB = normalizeForPrefix(b);

  if (normA.length < 20 || normB.length < 20) return false;

  const [shorter, longer] =
    normA.length <= normB.length ? [normA, normB] : [normB, normA];

  return longer.startsWith(shorter);
}

function normalizeForPrefix(text: string): string {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/^-\s*/, '')
    .replace(/\.{3}$/, '');
}

/**
 * Deduplicate entries. Entries with similarity >= threshold are grouped,
 * and the most recent (by timestamp or last in array) is kept.
 *
 * Also detects prefix matches (one entry is a truncated prefix of another)
 * and keeps the longer entry to preserve context.
 */
export function deduplicate(entries: DedupEntry[], threshold = 0.85): DedupEntry[] {
  if (entries.length <= 1) return [...entries];

  const kept: DedupEntry[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < entries.length; i++) {
    if (consumed.has(i)) continue;

    let best = entries[i]!;
    consumed.add(i);

    for (let j = i + 1; j < entries.length; j++) {
      if (consumed.has(j)) continue;

      const similarity = computeSimilarity(best.text, entries[j]!.text);
      if (similarity >= threshold) {
        consumed.add(j);
        // Keep the more recent one (later in array, or by timestamp)
        best = pickMoreRecent(best, entries[j]!);
      } else if (isPrefixMatch(best.text, entries[j]!.text)) {
        consumed.add(j);
        // Keep the longer entry (more context preserved)
        best = best.text.length >= entries[j]!.text.length ? best : entries[j]!;
      }
    }

    kept.push(best);
  }

  return kept;
}

function pickMoreRecent(a: DedupEntry, b: DedupEntry): DedupEntry {
  if (a.timestamp && b.timestamp) {
    return a.timestamp >= b.timestamp ? a : b;
  }
  // If no timestamps, prefer the later one (b) since it appeared later in the array
  return b;
}
