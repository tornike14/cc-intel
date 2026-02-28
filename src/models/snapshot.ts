export enum SnapshotSection {
  ProjectGoal = 'projectGoal',
  KeyDecisions = 'keyDecisions',
  Constraints = 'constraints',
  ImplementationArtifacts = 'implementationArtifacts',
  OpenTasks = 'openTasks',
}

export interface SnapshotEntry {
  text: string;
  score: number;
  source?: string;
}

export interface Snapshot {
  sections: Record<SnapshotSection, SnapshotEntry[]>;
  metadata: {
    messageCount: number;
    extractedAt: string;
    phaseDistribution: Record<string, number>;
  };
}

export interface SnapshotConfig {
  phaseThresholds: [number, number, number];
  maxItemsPerSection: number;
}

export const DEFAULT_SNAPSHOT_CONFIG: SnapshotConfig = {
  phaseThresholds: [0.15, 0.5, 0.85],
  maxItemsPerSection: 10,
};
