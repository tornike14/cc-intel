import { SignalCategory } from '../models/index.js';

export const DEFAULT_SIGNAL_PATTERNS: Record<SignalCategory, RegExp[]> = {
  [SignalCategory.Decision]: [
    /\b(we decided to|switched to|changed from|will use|prefer|should use)\b/gi,
    /\b(must|should|will)\b(?=\s+(?:use|implement|adopt|choose|go with|stick with|keep))/gi,
  ],

  [SignalCategory.Constraint]: [
    /\b(cannot|must not|must never|required|is required)\b/gi,
    /\b(breaking change|backward compatibility|backwards compatible)\b/gi,
    /\b(not allowed|forbidden|prohibited|restricted)\b/gi,
  ],

  [SignalCategory.Artifact]: [
    /(?:^|\s)((?:\.\/|\/|src\/|lib\/)[\w./-]+\.\w{1,5})\b/gm,
    /(?:^|\s)((?:GET|POST|PUT|DELETE|PATCH)\s+\/[\w/:-]+)/gm,
    /```[\s\S]*?```/gm,
    /`[^`]{3,}`/gm,
    /\$\s+.+$/gm,
  ],

  [SignalCategory.Todo]: [
    /\bTODO\b[:\s].*/gi,
    /\bFIXME\b[:\s].*/gi,
    /\b(next step|follow[- ]up|remaining work)\b/gi,
  ],
};
