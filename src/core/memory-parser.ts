import type { MemoryDocument, MemorySectionData } from '../models/index.js';

/** Convert a markdown header to a camelCase section key. */
export function toSectionKey(header: string): string {
  const words = header
    .replace(/^#+\s*/, '')
    .trim()
    .split(/\s+/);

  return words
    .map((word, i) =>
      i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
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

    if (!seenFirstSection && /^#\s+/.test(trimmed) && !trimmed.startsWith('##')) {
      title = trimmed;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      seenFirstSection = true;
      const key = toSectionKey(trimmed);

      if (sections[key]) {
        currentKey = key;
      } else {
        sections[key] = emptySectionData(trimmed);
        sectionOrder.push(key);
        currentKey = key;
      }
      continue;
    }

    if (!seenFirstSection && title !== undefined) {
      preamble.push(line);
      continue;
    }

    if (currentKey !== null) {
      sections[currentKey]!.lines.push(line);
    }
  }

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
