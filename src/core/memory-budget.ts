import {
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

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  for (const section of Object.keys(trimmedSections)) {
    const data = trimmedSections[section]!;
    const limit = budget.sectionLimits[section] ?? budget.defaultSectionLimit;

    if (data.lineCount <= limit) continue;

    const keptLines = data.lines.slice(0, limit);
    const overflowLines = data.lines.slice(limit);

    const overflowContent = overflowLines.join('\n');
    const filename = `${section}-${timestamp}.md`;

    overflowActions.push({
      section,
      summaryBullet: `- See overflow: ${filename}`,
      topicFileLink: filename,
      originalContent: overflowContent,
    });

    trimmedSections[section] = {
      ...data,
      lines: [...keptLines, `- See overflow: ${filename}`],
      lineCount: keptLines.length + 1,
    };
  }

  let totalLines = Object.values(trimmedSections).reduce((sum, s) => sum + s.lineCount, 0);

  const overflowCounter: Record<string, number> = {};
  for (const action of overflowActions) {
    const key = action.topicFileLink.replace(/\.md$/, '');
    overflowCounter[key] = (overflowCounter[key] ?? 0) + 1;
  }
  while (totalLines > budget.maxLines) {
    const sectionKeys = Object.keys(trimmedSections);
    if (sectionKeys.length === 0) break;

    const largest = sectionKeys.reduce((max, s) =>
      trimmedSections[s]!.lineCount > trimmedSections[max]!.lineCount ? s : max,
    );

    const data = trimmedSections[largest]!;
    if (data.lineCount <= 1) break;

    const excess = totalLines - budget.maxLines;
    const newLimit = Math.max(1, data.lineCount - excess - 1);

    if (newLimit >= data.lineCount - 1) break;

    const keptLines = data.lines.slice(0, newLimit);
    const overflowLines = data.lines.slice(newLimit);

    if (overflowLines.length > 0) {
      const countKey = `${largest}-${timestamp}`;
      overflowCounter[countKey] = (overflowCounter[countKey] ?? 0) + 1;
      const suffix = overflowCounter[countKey]! > 1 ? `-${overflowCounter[countKey]}` : '';
      const filename = `${largest}-${timestamp}${suffix}.md`;

      overflowActions.push({
        section: largest,
        summaryBullet: `- See overflow: ${filename}`,
        topicFileLink: filename,
        originalContent: overflowLines.join('\n'),
      });

      trimmedSections[largest] = {
        ...data,
        lines: [...keptLines, `- See overflow: ${filename}`],
        lineCount: keptLines.length + 1,
      };
    }

    totalLines = Object.values(trimmedSections).reduce((sum, s) => sum + s.lineCount, 0);
  }

  return {
    trimmedDoc: { ...doc, sections: trimmedSections, totalLines },
    overflowActions,
  };
}
