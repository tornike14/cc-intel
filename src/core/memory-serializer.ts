import type { MemoryDocument } from '../models/index.js';

export function serializeMemoryDocument(doc: MemoryDocument): string {
  const parts: string[] = [];

  if (doc.title) {
    parts.push(doc.title);
    if (doc.preamble && doc.preamble.length > 0) {
      parts.push('');
      parts.push(...doc.preamble);
    }
    parts.push('');
  }

  for (const key of doc.sectionOrder) {
    const data = doc.sections[key];
    if (!data) continue;

    parts.push(data.header);
    if (data.lines.length > 0) {
      parts.push('');
      parts.push(...data.lines);
    }
    parts.push('');
  }

  return parts.join('\n').trimEnd() + '\n';
}
