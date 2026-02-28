# Architecture

## Overview

cc-intel is a local-first, deterministic pipeline that processes Claude Code session transcripts into structured memory. It runs entirely offline with no API calls or telemetry.

## Pipeline

```
Session Input (JSONL/Markdown)
  │
  ├─ session-parser     → SessionData (messages array)
  │
  ├─ signals            → ScoredMessage[] (weighted signal detection)
  │
  ├─ segmenter          → SegmentedSession (4 phases)
  │
  ├─ snapshot           → Snapshot (5 sections)
  │
  ├─ dedup              → deduplicated entries (Dice coefficient)
  │
  ├─ memory-merger      → merged MemoryDocument
  │
  ├─ memory-budget      → enforced line limits + overflow
  │
  └─ memory-serializer  → MEMORY.md output
```

## Module Layout

```
src/
├── models/          Type definitions and defaults
│   ├── session.ts   SessionPhase, SessionMessage, SessionData
│   ├── scoring.ts   SignalCategory, SignalMatch, ScoredMessage
│   ├── snapshot.ts  SnapshotSection, Snapshot, SnapshotConfig
│   ├── memory.ts    MemorySection, MemoryBudget, MemoryDocument
│   ├── risk.ts      RiskLevel, RiskThresholds, ContextMetrics
│   └── config.ts    CcIntelConfig with all defaults
│
├── core/            Processing engines
│   ├── session-parser.ts     JSONL + markdown parsing
│   ├── signal-patterns.ts    Regex patterns per category
│   ├── signals.ts            Signal detection + message scoring
│   ├── segmenter.ts          Phase-based session segmentation
│   ├── snapshot.ts           Snapshot extraction from segments
│   ├── dedup.ts              Dice coefficient deduplication
│   ├── risk.ts               Token estimation + risk classification
│   ├── memory-parser.ts      MEMORY.md → MemoryDocument
│   ├── memory-serializer.ts  MemoryDocument → markdown string
│   ├── memory-budget.ts      Section limit enforcement
│   ├── memory-merger.ts      Snapshot → existing MEMORY.md merge
│   └── config-loader.ts      .cc-intelrc.json loading
│
├── cli/             CLI layer
│   ├── index.ts               Entry point (commander)
│   ├── commands/
│   │   ├── snapshot.ts        cc-intel snapshot
│   │   ├── risk.ts            cc-intel risk
│   │   ├── preserve.ts        cc-intel preserve
│   │   └── status.ts          cc-intel status
│   └── formatters/
│       ├── snapshot-formatter.ts
│       └── risk-formatter.ts
│
└── utils/           Shared utilities
    ├── errors.ts    Custom error types
    ├── logger.ts    Structured stderr logger
    ├── text.ts      Text normalization helpers
    └── safe-fs.ts   Atomic file operations with locking
```

## Key Design Decisions

### Heuristic Scoring (Not ML)

Signal detection uses regex patterns rather than ML models. This keeps the tool:

- Deterministic (same input always produces same output)
- Fast (no model loading or inference)
- Offline (no API calls)
- Auditable (patterns are visible and editable)

### Session Segmentation

Messages are divided into 4 phases by position:

- **Goal** (0-15%): Initial project setup, requirements
- **Exploration** (15-50%): Research, alternatives evaluation
- **Implementation** (50-85%): Active coding, file creation
- **Wrap-up** (85-100%): Summary, remaining TODOs

### Atomic File Safety

All MEMORY.md writes go through `safeWriteFile` which:

1. Creates a backup of the existing file
2. Acquires an advisory lock (via `proper-lockfile`)
3. Checks mtime hasn't changed (stale write protection)
4. Writes to a temp file
5. Atomically renames temp → target
6. Releases the lock

### Deduplication

Uses Dice coefficient on character bigrams with a default threshold of 0.85. When duplicates are found, the most recent entry is kept.

### Budget Enforcement

MEMORY.md has strict line limits per section. When a section overflows:

1. Excess content is extracted
2. A summary bullet replaces it in MEMORY.md
3. Original content is written to a topic file
4. An index link is added pointing to the topic file
