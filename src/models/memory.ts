/**
 * Well-known section keys that cc-intel uses when creating new sections.
 * Kept as an enum for backward compatibility — existing code that accesses
 * `doc.sections[MemorySection.PinnedEssentials]` still compiles.
 *
 * The memory system now supports arbitrary section names (e.g., Claude Code's
 * "User Preferences", "Project Structure"). These well-known keys are only
 * used when cc-intel creates sections that don't already exist.
 */
export enum MemorySection {
  PinnedEssentials = 'pinnedEssentials',
  IndexLinks = 'indexLinks',
  RecentDecisions = 'recentDecisions',
}

export interface MemoryBudget {
  maxLines: number;
  /** Per-section line limits keyed by section key (camelCase). */
  sectionLimits: Record<string, number>;
  /** Fallback limit for sections not listed in sectionLimits. */
  defaultSectionLimit: number;
}

export const DEFAULT_MEMORY_BUDGET: MemoryBudget = {
  maxLines: 200,
  defaultSectionLimit: 50,
  sectionLimits: {
    [MemorySection.PinnedEssentials]: 80,
    [MemorySection.IndexLinks]: 40,
    [MemorySection.RecentDecisions]: 60,
  },
};

export interface MemorySectionData {
  /** The original markdown header line (e.g., "## User Preferences"). */
  header: string;
  lines: string[];
  lineCount: number;
}

export interface MemoryDocument {
  /** Sections keyed by camelCase key derived from header. */
  sections: Record<string, MemorySectionData>;
  /** Section keys in the order they appeared in the source file. */
  sectionOrder: string[];
  /** Optional H1 title line (e.g., "# Project Memory"). */
  title?: string;
  /** Lines between the title and the first ## section header. */
  preamble?: string[];
  totalLines: number;
  raw: string;
}

export interface OverflowAction {
  section: string;
  summaryBullet: string;
  topicFileLink: string;
  originalContent: string;
}
