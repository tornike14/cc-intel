import {
  MemorySection,
  SnapshotSection,
  DEFAULT_MEMORY_BUDGET,
  type MemoryBudget,
  type MemoryDocument,
  type Snapshot,
  type OverflowAction,
} from '../models/index.js';
import { deduplicate } from './dedup.js';
import { enforceBudget } from './memory-budget.js';

export interface MergeResult {
  updatedDoc: MemoryDocument;
  overflowActions: OverflowAction[];
  entriesAdded: number;
  entriesDeduplicated: number;
}

export function mergeIntoMemory(
  existingDoc: MemoryDocument,
  snapshot: Snapshot,
  budget: MemoryBudget = DEFAULT_MEMORY_BUDGET,
): MergeResult {
  const updatedSections = { ...existingDoc.sections };
  let totalAdded = 0;
  let totalDeduped = 0;

  // Map snapshot sections to memory sections
  const mapping: [SnapshotSection, MemorySection][] = [
    [SnapshotSection.ProjectGoal, MemorySection.PinnedEssentials],
    [SnapshotSection.KeyDecisions, MemorySection.RecentDecisions],
    [SnapshotSection.Constraints, MemorySection.PinnedEssentials],
    [SnapshotSection.ImplementationArtifacts, MemorySection.IndexLinks],
    [SnapshotSection.OpenTasks, MemorySection.RecentDecisions],
  ];

  for (const [snapshotSection, memorySection] of mapping) {
    const newEntries = snapshot.sections[snapshotSection];
    if (newEntries.length === 0) continue;

    const existingLines = updatedSections[memorySection].lines;
    const existingEntries = existingLines
      .filter((l) => l.trim().length > 0)
      .map((l) => ({ text: l }));
    const newDedupEntries = newEntries.map((e) => ({ text: `- ${e.text.substring(0, 150)}` }));

    const combined = [...existingEntries, ...newDedupEntries];
    const beforeCount = combined.length;
    const deduped = deduplicate(combined);
    const afterCount = deduped.length;

    totalDeduped += beforeCount - afterCount;
    totalAdded += newDedupEntries.length - (beforeCount - afterCount);

    updatedSections[memorySection] = {
      ...updatedSections[memorySection],
      lines: deduped.map((e) => e.text),
      lineCount: deduped.length,
    };
  }

  const totalLines = Object.values(updatedSections).reduce((sum, s) => sum + s.lineCount, 0);
  const mergedDoc: MemoryDocument = {
    ...existingDoc,
    sections: updatedSections,
    totalLines,
  };

  const { trimmedDoc, overflowActions } = enforceBudget(mergedDoc, budget);

  return {
    updatedDoc: trimmedDoc,
    overflowActions,
    entriesAdded: totalAdded,
    entriesDeduplicated: totalDeduped,
  };
}
