# cc-intel

[![CI](https://github.com/tornike14/cc-intel/actions/workflows/ci.yml/badge.svg)](https://github.com/tornike14/cc-intel/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/cc-intel.svg)](https://www.npmjs.com/package/cc-intel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Claude Context Guardian** — a local-first CLI tool that strengthens Claude Code's reliability by monitoring context usage, extracting architectural knowledge from sessions, and preserving critical decisions into MEMORY.md with strict budget enforcement.

## Why

Claude Code sessions lose critical project context on compaction. Architectural decisions, constraints, and artifacts vanish. cc-intel solves this by:

- Scoring session messages using heuristic signal detection (decisions, constraints, artifacts, TODOs)
- Segmenting sessions into phases (goal, exploration, implementation, wrap-up)
- Extracting high-value knowledge into structured snapshots
- Merging snapshots into MEMORY.md with deduplication and line-budget enforcement
- Monitoring context utilization to warn before compaction

## Install

```bash
npm install -g cc-intel
```

Requires Node.js >= 18.

## Commands

### `cc-intel snapshot`

Extract a structured snapshot from a session transcript.

```bash
# From file
cc-intel snapshot --input session.jsonl

# From stdin
cat session.jsonl | cc-intel snapshot

# JSON output
cc-intel snapshot --input session.jsonl --json

# Save to file
cc-intel snapshot --input session.jsonl --output snapshot.md
```

**Options:**

- `-i, --input <path>` — Session file path (default: stdin)
- `-f, --format <fmt>` — Input format: `auto`, `jsonl`, `markdown` (default: `auto`)
- `-o, --output <path>` — Output file path (default: stdout)
- `--json` — Output as JSON instead of markdown

### `cc-intel risk`

Assess context usage and compaction risk.

```bash
cc-intel risk --input session.jsonl
cc-intel risk --input session.jsonl --json --threshold 150000
```

Exits with code 1 for High/Critical risk (useful in CI).

**Options:**

- `-i, --input <path>` — Session file path (default: stdin)
- `-f, --format <fmt>` — Input format: `auto`, `jsonl`, `markdown` (default: `auto`)
- `--json` — Output as JSON
- `--threshold <n>` — Max context tokens (default: `200000`)

### `cc-intel preserve`

Extract session knowledge and merge into MEMORY.md.

```bash
# Preview changes
cc-intel preserve --input session.jsonl --dry-run

# Write to default MEMORY.md
cc-intel preserve --input session.jsonl

# Custom memory path
cc-intel preserve --input session.jsonl --memory ./MEMORY.md
```

**Options:**

- `-i, --input <path>` — Session file path (default: stdin)
- `-f, --format <fmt>` — Input format: `auto`, `jsonl`, `markdown` (default: `auto`)
- `-m, --memory <path>` — MEMORY.md path (default: `~/.claude/MEMORY.md`)
- `--dry-run` — Preview changes without writing
- `--max-lines <n>` — Max MEMORY.md lines (default: `200`)

### `cc-intel status`

Show MEMORY.md health and budget utilization.

```bash
cc-intel status
cc-intel status --memory ./MEMORY.md --json
```

**Options:**

- `-m, --memory <path>` — MEMORY.md path (default: `~/.claude/MEMORY.md`)
- `--json` — Output as JSON

## Session Input Formats

### JSONL

One JSON object per line with `role` and `content` fields:

```jsonl
{"role":"human","content":"Build a REST API with Express"}
{"role":"assistant","content":"I'll set up Express with TypeScript. We decided to use Knex for migrations."}
```

### Markdown

Alternating `Human:` and `Assistant:` prefixes:

```
Human: Build a REST API with Express
Assistant: I'll set up Express with TypeScript. We decided to use Knex for migrations.
```

## Configuration

Create `.cc-intelrc.json` in your project root or home directory:

```json
{
  "maxContext": 150000,
  "logLevel": "debug",
  "riskThresholds": {
    "medium": 0.5,
    "high": 0.75,
    "critical": 0.9
  },
  "memoryBudget": {
    "maxLines": 200,
    "sectionLimits": {
      "pinnedEssentials": 80,
      "indexLinks": 40,
      "recentDecisions": 60
    }
  }
}
```

Environment variable overrides:

- `CC_INTEL_LOG_LEVEL` — `debug`, `info`, `warn`, `error`
- `CC_INTEL_MAX_CONTEXT` — Max context token count

## Signal Detection

Messages are scored by detecting four signal categories:

| Category   | Weight | Examples                                   |
| ---------- | ------ | ------------------------------------------ |
| Decision   | 2      | "we decided to", "will use", "switched to" |
| Constraint | 2      | "must not", "required", "not allowed"      |
| Artifact   | 3      | File paths, API endpoints, code blocks     |
| Todo       | 1.5    | "TODO:", "FIXME:", "next step"             |

## MEMORY.md Budget

MEMORY.md is managed with strict line limits:

| Section           | Default Limit |
| ----------------- | ------------- |
| Pinned Essentials | 80 lines      |
| Index Links       | 40 lines      |
| Recent Decisions  | 60 lines      |
| **Total**         | **200 lines** |

When a section exceeds its limit, overflow content is written to topic files and linked from the Index section.

## Library API

cc-intel exports its core functions for programmatic use:

```typescript
import {
  parseSession,
  segmentSession,
  extractSnapshot,
  parseMemoryDocument,
  mergeIntoMemory,
  assessRisk,
  loadConfig,
} from 'cc-intel';
```

See [docs/api.md](docs/api.md) for the full API reference.

## Development

```bash
git clone https://github.com/tornike14/cc-intel.git
cd cc-intel
npm install
npm run build
npm run test
npm run lint
npm run typecheck
```

## License

MIT
