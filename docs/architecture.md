# Architecture

## Pipeline

```
Session Input (JSONL from ~/.claude/projects/)
  |
  +-- session-parser      -> SessionData (messages array)
  |
  +-- signals             -> ScoredMessage[] (weighted signal detection)
  |
  +-- llm-extractor       -> pre-filter top ~60 messages, send to Claude Haiku
  |                          -> Snapshot (5 sections)
  |
  +-- dedup               -> deduplicated entries (Dice coefficient)
  |
  +-- memory-merger       -> merged MemoryDocument
  |
  +-- memory-budget       -> enforced line limits + overflow files
  |
  +-- memory-serializer   -> MEMORY.md output
```

## Module layout

```
src/
+-- models/          Type definitions and defaults
|   +-- session.ts   SessionPhase, SessionMessage, SessionData
|   +-- scoring.ts   SignalCategory, SignalMatch, ScoredMessage
|   +-- snapshot.ts  SnapshotSection, Snapshot, SnapshotConfig
|   +-- memory.ts    MemorySection, MemoryBudget, MemoryDocument
|   +-- risk.ts      RiskLevel, RiskThresholds, ContextMetrics
|   +-- config.ts    CcIntelConfig with all defaults
|
+-- core/            Processing engines
|   +-- session-parser.ts     JSONL + markdown parsing
|   +-- signal-patterns.ts    Regex patterns per category
|   +-- signals.ts            Signal detection + message scoring
|   +-- segmenter.ts          Phase-based session segmentation
|   +-- snapshot.ts           Heuristic snapshot extraction (used by projects command)
|   +-- llm-extractor.ts      LLM-powered extraction via Claude Haiku
|   +-- dedup.ts              Dice coefficient deduplication
|   +-- risk.ts               Token estimation + risk classification
|   +-- memory-parser.ts      MEMORY.md -> MemoryDocument
|   +-- memory-serializer.ts  MemoryDocument -> markdown string
|   +-- memory-budget.ts      Section limit enforcement
|   +-- memory-merger.ts      Snapshot -> existing MEMORY.md merge
|   +-- config-loader.ts      .cc-intelrc.json loading
|
+-- cli/             CLI layer
|   +-- index.ts               Entry point (commander)
|   +-- api-key-help.ts        Platform-aware API key setup instructions
|   +-- spinner.ts             Animated progress indicator
|   +-- branding.ts            ASCII logo and tagline
|   +-- commands/
|   |   +-- snapshot.ts        cc-intel snapshot
|   |   +-- risk.ts            cc-intel risk
|   |   +-- preserve.ts        cc-intel preserve
|   |   +-- status.ts          cc-intel status
|   |   +-- projects.ts        cc-intel projects
|   +-- formatters/
|       +-- snapshot-formatter.ts
|       +-- risk-formatter.ts
|
+-- utils/           Shared utilities
    +-- errors.ts    Custom error types
    +-- logger.ts    Structured stderr logger
    +-- text.ts      Text normalization helpers
    +-- safe-fs.ts   Atomic file operations with locking
```

## Key design decisions

### LLM extraction with heuristic pre-filtering

Extraction uses a two-stage approach:

1. **Heuristic pre-filter** -- scores all messages using regex signal detection (decisions, constraints, artifacts, TODOs) and selects the top ~60 most important messages. This runs locally and costs nothing.
2. **LLM extraction** -- sends the filtered messages to Claude Haiku with a structured prompt. The LLM identifies which messages contain actual knowledge worth preserving and categorizes them into 5 sections.

This keeps cost under $0.001 per extraction while producing significantly better results than pure heuristics.

### BYOK API key model

The user provides their own Anthropic API key via the `ANTHROPIC_API_KEY` environment variable. The key is:
- Read from the environment at runtime
- Never stored to disk or logged
- Only sent to the Anthropic API

### Session segmentation

Messages are divided into 4 phases by position:

- **Goal** (0-15%): initial project setup, requirements
- **Exploration** (15-50%): research, alternatives evaluation
- **Implementation** (50-85%): active coding, file creation
- **Wrap-up** (85-100%): summary, remaining TODOs

### Atomic file safety

All MEMORY.md writes go through `safeWriteFile` which acquires an advisory lock (via `proper-lockfile`), checks the file hasn't changed since it was read (stale write protection), writes to a temp file, and atomically renames it to the target path.

### Deduplication

Uses Dice coefficient on character bigrams with a default threshold of 0.85. When duplicates are found, the most recent entry is kept.

### Budget enforcement

MEMORY.md has strict line limits per section. When a section overflows, excess content is written to a topic file and a summary link replaces it in the main document.
