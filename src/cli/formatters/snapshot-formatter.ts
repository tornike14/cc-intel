import { SnapshotSection, type Snapshot } from '../../models/index.js';

const SECTION_TITLES: Record<SnapshotSection, string> = {
  [SnapshotSection.ProjectGoal]: 'Project Goal',
  [SnapshotSection.KeyDecisions]: 'Key Decisions',
  [SnapshotSection.Constraints]: 'Constraints',
  [SnapshotSection.ImplementationArtifacts]: 'Implementation Artifacts',
  [SnapshotSection.OpenTasks]: 'Open Tasks',
};

export function formatSnapshotAsMarkdown(snapshot: Snapshot): string {
  const parts: string[] = ['# Session Snapshot', ''];

  for (const section of Object.values(SnapshotSection)) {
    const entries = snapshot.sections[section];
    parts.push(`## ${SECTION_TITLES[section]}`);
    parts.push('');

    if (entries.length === 0) {
      parts.push('_No entries_');
    } else {
      for (const entry of entries) {
        parts.push(`- ${entry.text.substring(0, 200)}`);
      }
    }
    parts.push('');
  }

  parts.push(`---`);
  parts.push(
    `_Extracted at ${snapshot.metadata.extractedAt} from ${snapshot.metadata.messageCount} messages_`,
  );
  parts.push('');

  return parts.join('\n');
}

export function formatSnapshotAsJson(snapshot: Snapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
