import type { MemoryDocument, MemorySectionData } from '../models/index.js';

/**
 * Convert a markdown header to a camelCase section key.
 *
 * Examples:
 *   "## Pinned Essentials" → "pinnedEssentials"
 *   "## User Preferences"  → "userPreferences"
 *   "## Project Structure"  → "projectStructure"
 *   "## CI/CD Pipeline"    → "ci/cdPipeline"
 */
export function toSectionKey(header: string): string {
  const words = header
    .replace(/^#+\s*/, '')
    .trim()
    .split(/\s+/);

  return words
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');
}

function emptySectionData(header: string): MemorySectionData {
  return { header, lines: [], lineCount: 0 };
}

export function parseMemoryDocument(content: string): MemoryDocument {
  const sections: Record<string, MemorySectionData> = {};
  const sectionOrder: string[] = [];
  let title: string | undefined;
  const preamble: string[] = [];

  const lines = content.split('\n');
  let currentKey: string | null = null;
  let seenFirstSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect H1 title (only before any ## section)
    if (!seenFirstSection && /^#\s+/.test(trimmed) && !trimmed.startsWith('##')) {
      title = trimmed;
      continue;
    }

    // Detect H2 section header
    if (trimmed.startsWith('## ')) {
      seenFirstSection = true;
      const key = toSectionKey(trimmed);

      if (sections[key]) {
        // Duplicate header normalizing to same key — append to existing
        currentKey = key;
      } else {
        sections[key] = emptySectionData(trimmed);
        sectionOrder.push(key);
        currentKey = key;
      }
      continue;
    }

    // Lines before first section go into preamble (if title was found)
    if (!seenFirstSection && title !== undefined) {
      preamble.push(line);
      continue;
    }

    // Content lines within a section
    if (currentKey !== null) {
      sections[currentKey]!.lines.push(line);
    }
  }

  // Trim leading/trailing empty lines from each section and compute lineCount
  for (const key of sectionOrder) {
    const data = sections[key]!;
    while (data.lines.length > 0 && data.lines[0]!.trim() === '') {
      data.lines.shift();
    }
    while (data.lines.length > 0 && data.lines[data.lines.length - 1]!.trim() === '') {
      data.lines.pop();
    }
    data.lineCount = data.lines.length;
  }

  // Trim preamble
  while (preamble.length > 0 && preamble[0]!.trim() === '') {
    preamble.shift();
  }
  while (preamble.length > 0 && preamble[preamble.length - 1]!.trim() === '') {
    preamble.pop();
  }

  const totalLines = Object.values(sections).reduce((sum, s) => sum + s.lineCount, 0);

  return {
    sections,
    sectionOrder,
    title,
    preamble: preamble.length > 0 ? preamble : undefined,
    totalLines,
    raw: content,
  };
}
