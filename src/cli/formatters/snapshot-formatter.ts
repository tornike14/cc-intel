import { SnapshotSection, type Snapshot } from '../../models/index.js';

const SECTION_TITLES: Record<SnapshotSection, string> = {
  [SnapshotSection.ProjectGoal]: 'Project Goal',
  [SnapshotSection.KeyDecisions]: 'Key Decisions',
  [SnapshotSection.Constraints]: 'Constraints',
  [SnapshotSection.ImplementationArtifacts]: 'Implementation Artifacts',
  [SnapshotSection.OpenTasks]: 'Open Tasks',
};

/** Truncate to first line only, capped at maxLen chars */
function truncateEntry(text: string, maxLen: number): string {
  const firstLine = text.split('\n')[0] ?? text;
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.substring(0, maxLen) + '...';
}

export function formatSnapshotAsMarkdown(snapshot: Snapshot): string {
  const parts: string[] = [];
  parts.push('');
  parts.push('  # Session Snapshot');
  parts.push('  ' + '-'.repeat(50));
  parts.push('');

  for (const section of Object.values(SnapshotSection)) {
    const entries = snapshot.sections[section];
    parts.push(`  ## ${SECTION_TITLES[section]}`);
    parts.push('');

    if (entries.length === 0) {
      parts.push('    (no entries)');
    } else {
      for (const entry of entries) {
        parts.push(`    - ${truncateEntry(entry.text, 120)}`);
      }
    }
    parts.push('');
  }

  parts.push('  ' + '-'.repeat(50));
  parts.push(
    `  Extracted at ${snapshot.metadata.extractedAt} from ${snapshot.metadata.messageCount} messages`,
  );
  parts.push('');

  return parts.join('\n');
}

export function formatSnapshotAsJson(snapshot: Snapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
