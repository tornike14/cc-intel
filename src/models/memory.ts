export enum MemorySection {
  PinnedEssentials = 'pinnedEssentials',
  IndexLinks = 'indexLinks',
  RecentDecisions = 'recentDecisions',
}

export interface MemoryBudget {
  maxLines: number;
  sectionLimits: Record<MemorySection, number>;
}

export const DEFAULT_MEMORY_BUDGET: MemoryBudget = {
  maxLines: 200,
  sectionLimits: {
    [MemorySection.PinnedEssentials]: 80,
    [MemorySection.IndexLinks]: 40,
    [MemorySection.RecentDecisions]: 60,
  },
};

export interface MemorySectionData {
  header: string;
  lines: string[];
  lineCount: number;
}

export interface MemoryDocument {
  sections: Record<MemorySection, MemorySectionData>;
  totalLines: number;
  raw: string;
}

export interface OverflowAction {
  section: MemorySection;
  summaryBullet: string;
  topicFileLink: string;
  originalContent: string;
}
