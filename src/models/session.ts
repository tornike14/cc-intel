export enum SessionPhase {
  Goal = 'goal',
  Exploration = 'exploration',
  Implementation = 'implementation',
  WrapUp = 'wrapup',
}

export interface SessionMessage {
  role: 'human' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface SessionData {
  messages: SessionMessage[];
  metadata?: {
    sessionId?: string;
    project?: string;
    startedAt?: string;
  };
}
