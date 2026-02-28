import {
  MemorySection,
  DEFAULT_MEMORY_BUDGET,
  type MemoryBudget,
  type MemoryDocument,
  type OverflowAction,
} from '../models/index.js';

export interface BudgetResult {
  trimmedDoc: MemoryDocument;
  overflowActions: OverflowAction[];
}

export function enforceBudget(
  doc: MemoryDocument,
  budget: MemoryBudget = DEFAULT_MEMORY_BUDGET,
): BudgetResult {
  const overflowActions: OverflowAction[] = [];

  const trimmedSections = { ...doc.sections };

  for (const section of Object.values(MemorySection)) {
    const data = trimmedSections[section];
    const limit = budget.sectionLimits[section];

    if (data.lineCount <= limit) continue;

    // Keep the first `limit` lines, overflow the rest
    const keptLines = data.lines.slice(0, limit);
    const overflowLines = data.lines.slice(limit);

    const overflowContent = overflowLines.join('\n');
    const dateStr = new Date().toISOString().split('T')[0]!;

    overflowActions.push({
      section,
      summaryBullet: `- See overflow: ${section}-${dateStr}.md`,
      topicFileLink: `${section}-${dateStr}.md`,
      originalContent: overflowContent,
    });

    trimmedSections[section] = {
      ...data,
      lines: [...keptLines, `- See overflow: ${section}-${dateStr}.md`],
      lineCount: keptLines.length + 1,
    };
  }

  const totalLines = Object.values(trimmedSections).reduce((sum, s) => sum + s.lineCount, 0);

  return {
    trimmedDoc: { ...doc, sections: trimmedSections, totalLines },
    overflowActions,
  };
}
