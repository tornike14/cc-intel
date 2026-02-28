import { MemorySection, type MemoryDocument } from '../models/index.js';

const SECTION_ORDER = [
  MemorySection.PinnedEssentials,
  MemorySection.IndexLinks,
  MemorySection.RecentDecisions,
];

export function serializeMemoryDocument(doc: MemoryDocument): string {
  const parts: string[] = [];

  for (const section of SECTION_ORDER) {
    const data = doc.sections[section];
    parts.push(data.header);
    if (data.lines.length > 0) {
      parts.push('');
      parts.push(...data.lines);
    }
    parts.push('');
  }

  return parts.join('\n').trimEnd() + '\n';
}
