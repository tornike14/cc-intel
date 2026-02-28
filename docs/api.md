# API Reference

cc-intel exports its core functions and types for programmatic use.

## Session Parsing

### `parseSession(input, format?)`

Parse a session transcript into structured data.

```typescript
import { parseSession } from 'cc-intel';

const session = parseSession(rawText, 'auto'); // 'auto' | 'jsonl' | 'markdown'
// session.messages: SessionMessage[]
```

**Parameters:**

- `input: string` — Raw session text
- `format: 'auto' | 'jsonl' | 'markdown'` — Input format (default: `'auto'`)

**Returns:** `SessionData`

## Signal Detection

### `detectSignals(text, weights?)`

Detect heuristic signals in text.

```typescript
import { detectSignals } from 'cc-intel';

const signals = detectSignals('We decided to use TypeScript');
// signals: SignalMatch[] — [{ category: 'decision', weight: 2, ... }]
```

### `scoreMessage(message, weights?)`

Score a message by its detected signals.

```typescript
import { scoreMessage } from 'cc-intel';

const scored = scoreMessage({ role: 'assistant', content: 'We decided to use Express' });
// scored.importanceScore: number
// scored.signals: SignalMatch[]
```

## Session Segmentation

### `segmentSession(messages, scorer?, config?)`

Divide messages into 4 phases sorted by importance.

```typescript
import { segmentSession } from 'cc-intel';

const segmented = segmentSession(session.messages);
// segmented.goal: ScoredMessage[]
// segmented.exploration: ScoredMessage[]
// segmented.implementation: ScoredMessage[]
// segmented.wrapup: ScoredMessage[]
```

## Snapshot Extraction

### `extractSnapshot(segmented, config?)`

Extract a structured snapshot from segmented messages.

```typescript
import { extractSnapshot } from 'cc-intel';

const snapshot = extractSnapshot(segmented);
// snapshot.sections.projectGoal: SnapshotEntry[]
// snapshot.sections.keyDecisions: SnapshotEntry[]
// snapshot.sections.constraints: SnapshotEntry[]
// snapshot.sections.implementationArtifacts: SnapshotEntry[]
// snapshot.sections.openTasks: SnapshotEntry[]
```

## Deduplication

### `deduplicate(entries, threshold?)`

Remove near-duplicate entries using Dice coefficient similarity.

```typescript
import { deduplicate } from 'cc-intel';

const unique = deduplicate(entries, 0.85);
```

### `computeSimilarity(a, b)`

Compute Dice coefficient between two strings.

```typescript
import { computeSimilarity } from 'cc-intel';

const similarity = computeSimilarity('hello world', 'hello world!');
// 0.0 to 1.0
```

## Risk Assessment

### `assessRisk(messages, maxContext?, thresholds?)`

Estimate token usage and classify compaction risk.

```typescript
import { assessRisk } from 'cc-intel';

const metrics = assessRisk(session.messages, 200_000);
// metrics.tokenEstimate: number
// metrics.riskLevel: 'low' | 'medium' | 'high' | 'critical'
// metrics.utilizationPercent: number
```

### `estimateTokens(text)`

Estimate token count using chars/4 heuristic.

```typescript
import { estimateTokens } from 'cc-intel';

const tokens = estimateTokens('some text content');
```

## Memory Management

### `parseMemoryDocument(content)`

Parse MEMORY.md content into a structured document.

```typescript
import { parseMemoryDocument } from 'cc-intel';

const doc = parseMemoryDocument(memoryContent);
// doc.sections.pinnedEssentials: MemorySectionData
// doc.sections.indexLinks: MemorySectionData
// doc.sections.recentDecisions: MemorySectionData
// doc.totalLines: number
```

### `serializeMemoryDocument(doc)`

Serialize a MemoryDocument back to markdown.

```typescript
import { serializeMemoryDocument } from 'cc-intel';

const markdown = serializeMemoryDocument(doc);
```

### `mergeIntoMemory(existingDoc, snapshot, budget?)`

Merge a snapshot into an existing memory document with deduplication.

```typescript
import { mergeIntoMemory } from 'cc-intel';

const { updatedDoc, overflowActions, entriesAdded, entriesDeduplicated } = mergeIntoMemory(
  existingDoc,
  snapshot,
);
```

### `enforceBudget(doc, budget?)`

Enforce section line limits on a memory document.

```typescript
import { enforceBudget } from 'cc-intel';

const { doc: trimmed, overflowActions } = enforceBudget(doc);
```

## Configuration

### `loadConfig(cwd?)`

Load configuration from `.cc-intelrc.json` with env var overrides.

```typescript
import { loadConfig } from 'cc-intel';

const config = await loadConfig();
// config.maxContext: number
// config.signalWeights: SignalWeights
// config.memoryBudget: MemoryBudget
```

## Types

All types are exported from the main package:

```typescript
import type {
  SessionMessage,
  SessionData,
  SignalCategory,
  SignalMatch,
  ScoredMessage,
  Snapshot,
  SnapshotEntry,
  MemoryDocument,
  MemoryBudget,
  OverflowAction,
  ContextMetrics,
  RiskLevel,
  CcIntelConfig,
} from 'cc-intel';
```

## Enums

```typescript
import {
  SessionPhase, // goal, exploration, implementation, wrapup
  SignalCategory, // decision, constraint, artifact, todo
  SnapshotSection, // projectGoal, keyDecisions, constraints, implementationArtifacts, openTasks
  MemorySection, // pinnedEssentials, indexLinks, recentDecisions
  RiskLevel, // low, medium, high, critical
} from 'cc-intel';
```

## Constants

```typescript
import {
  DEFAULT_CONFIG,
  DEFAULT_SIGNAL_WEIGHTS,
  DEFAULT_SNAPSHOT_CONFIG,
  DEFAULT_MEMORY_BUDGET,
  DEFAULT_RISK_THRESHOLDS,
} from 'cc-intel';
```
