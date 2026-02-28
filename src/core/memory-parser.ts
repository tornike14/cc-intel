import { MemorySection, type MemoryDocument, type MemorySectionData } from '../models/index.js';

const SECTION_HEADERS: Record<string, MemorySection> = {
  '## pinned essentials': MemorySection.PinnedEssentials,
  '## index links': MemorySection.IndexLinks,
  '## recent decisions': MemorySection.RecentDecisions,
};

function emptySectionData(header: string): MemorySectionData {
  return { header, lines: [], lineCount: 0 };
}

export function parseMemoryDocument(content: string): MemoryDocument {
  const sections: Record<MemorySection, MemorySectionData> = {
    [MemorySection.PinnedEssentials]: emptySectionData('## Pinned Essentials'),
    [MemorySection.IndexLinks]: emptySectionData('## Index Links'),
    [MemorySection.RecentDecisions]: emptySectionData('## Recent Decisions'),
  };

  const lines = content.split('\n');
  let currentSection: MemorySection | null = null;

  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    const matchedSection = SECTION_HEADERS[normalized];

    if (matchedSection !== undefined) {
      currentSection = matchedSection;
      sections[currentSection].header = line.trim();
      continue;
    }

    if (currentSection !== null) {
      sections[currentSection].lines.push(line);
    }
  }

  // Remove leading and trailing empty lines from each section
  for (const section of Object.values(MemorySection)) {
    const data = sections[section];
    while (data.lines.length > 0 && data.lines[0]!.trim() === '') {
      data.lines.shift();
    }
    while (data.lines.length > 0 && data.lines[data.lines.length - 1]!.trim() === '') {
      data.lines.pop();
    }
    data.lineCount = data.lines.length;
  }

  const totalLines = Object.values(sections).reduce((sum, s) => sum + s.lineCount, 0);

  return { sections, totalLines, raw: content };
}
