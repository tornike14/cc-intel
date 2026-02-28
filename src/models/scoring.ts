export enum SignalCategory {
  Decision = 'decision',
  Constraint = 'constraint',
  Artifact = 'artifact',
  Todo = 'todo',
}

export type SignalWeights = Record<SignalCategory, number>;

export const DEFAULT_SIGNAL_WEIGHTS: SignalWeights = {
  [SignalCategory.Decision]: 2,
  [SignalCategory.Constraint]: 2,
  [SignalCategory.Artifact]: 3,
  [SignalCategory.Todo]: 1.5,
};

export interface SignalMatch {
  category: SignalCategory;
  weight: number;
  pattern: string;
  matchedText: string;
}

export interface ScoredMessage {
  content: string;
  role: 'human' | 'assistant';
  signals: SignalMatch[];
  importanceScore: number;
  timestamp?: string;
}
