# cc-intel

```
                _       _       _
   ___ ___     (_)_ __ | |_ ___| |
  / __/ __|____| | '_ \| __/ _ \ |
 | (_| (_|_____| | | | | ||  __/ |
  \___\___|    |_|_| |_|\__\___|_|
```

[![CI](https://github.com/tornike14/cc-intel/actions/workflows/ci.yml/badge.svg)](https://github.com/tornike14/cc-intel/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/cc-intel.svg)](https://www.npmjs.com/package/cc-intel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

**Context Guardian for Claude Code** — Stop losing critical decisions to context compaction.

Claude Code sessions accumulate architectural decisions, constraints, and implementation artifacts — then lose them when the context window compacts. cc-intel guards that knowledge by extracting, scoring, and preserving it into MEMORY.md before it vanishes.

---

## The Problem

Long Claude Code sessions build up critical project context: what was decided, what constraints exist, which files were created. When the context window fills up and compacts, that knowledge disappears silently. The next session starts from scratch, repeating decisions or contradicting earlier ones.

## The Solution

cc-intel monitors your sessions and extracts the signals that matter — decisions, constraints, artifacts, and open tasks. It scores each message using heuristic signal detection, segments the session into phases, and preserves the highest-value knowledge into Claude's MEMORY.md with strict budget enforcement and deduplication.

---

## Quick Start

```bash
npm install -g cc-intel
```

Run from inside any project with Claude Code sessions:

```bash
cc-intel snapshot        # extract knowledge from latest session
cc-intel risk            # assess compaction risk
cc-intel preserve        # save knowledge to MEMORY.md
cc-intel status          # check MEMORY.md health
cc-intel projects        # pick a project interactively
```

No flags needed — cc-intel auto-discovers the latest session from `~/.claude/projects/`.

## Commands

### `cc-intel snapshot`

Extract structured knowledge from a session transcript.

```bash
cc-intel snapshot                          # auto-discover latest session
cc-intel snapshot path/to/session.jsonl    # explicit file
cc-intel snapshot --json                   # JSON output
cc-intel snapshot -o snapshot.md           # write to file
```

| Option | Description |
|--------|-------------|
| `[file]` | Session file path (default: auto-discover latest) |
| `-f, --format <fmt>` | Input format: `auto`, `jsonl`, `markdown` (default: `auto`) |
| `-o, --output <path>` | Output file path (default: stdout) |
| `--json` | Output as JSON instead of markdown |

### `cc-intel risk`

Assess context window usage and compaction risk. Exits with code 1 for High/Critical risk — useful in CI.

```bash
cc-intel risk                              # auto-discover latest session
cc-intel risk path/to/session.jsonl        # explicit file
cc-intel risk --json --threshold 150000    # custom threshold
```

| Option | Description |
|--------|-------------|
| `[file]` | Session file path (default: auto-discover latest) |
| `-f, --format <fmt>` | Input format: `auto`, `jsonl`, `markdown` (default: `auto`) |
| `--json` | Output as JSON |
| `--threshold <n>` | Max context tokens (default: `200000`) |

### `cc-intel preserve`

Merge session knowledge into MEMORY.md with deduplication and budget enforcement.

```bash
cc-intel preserve                          # auto-discover, write to MEMORY.md
cc-intel preserve --dry-run                # preview without writing
cc-intel preserve path/to/session.jsonl    # explicit file
cc-intel preserve -m ./MEMORY.md           # custom MEMORY.md path
```

| Option | Description |
|--------|-------------|
| `[file]` | Session file path (default: auto-discover latest) |
| `-f, --format <fmt>` | Input format: `auto`, `jsonl`, `markdown` (default: `auto`) |
| `-m, --memory <path>` | MEMORY.md path (default: `~/.claude/MEMORY.md`) |
| `--dry-run` | Preview changes without writing |
| `--max-lines <n>` | Max MEMORY.md lines (default: `200`) |

### `cc-intel projects`

Browse all Claude Code projects and run a command on one interactively. Useful when you're not inside a project directory.

```bash
cc-intel projects                # interactive arrow-key picker
cc-intel projects --json         # list all projects as JSON
```

In interactive mode, you select a project and then choose a command (snapshot, risk, or preserve) to run on it. The `--json` flag outputs a machine-readable project list for scripting.

| Option | Description |
|--------|-------------|
| `--json` | Output project list as JSON (non-interactive) |

### `cc-intel status`

Show MEMORY.md health, budget utilization, and section breakdown.

```bash
cc-intel status
cc-intel status --memory ./MEMORY.md --json
```

| Option | Description |
|--------|-------------|
| `-m, --memory <path>` | MEMORY.md path (default: `~/.claude/MEMORY.md`) |
| `--json` | Output as JSON |

---

## Session Auto-Discovery

When no file is specified, cc-intel automatically finds the latest session:

1. Resolves the git root of the current directory
2. Looks in `~/.claude/projects/<project-dir>/` for `.jsonl` files
3. Uses the most recently modified session

This works with native Claude Code session files — the internal JSONL format that Claude Code writes during conversations. The parser handles user messages, assistant responses with mixed text/tool-use blocks, and gracefully skips tool results and operational entries.

---

## Session Input Formats

### Native Claude Code (auto-detected)

Session files written by Claude Code at `~/.claude/projects/`. Detected automatically — no configuration needed.

### Simple JSONL

One JSON object per line with `role` and `content` fields:

```jsonl
{"role":"human","content":"Build a REST API with Express"}
{"role":"assistant","content":"I'll set up Express with TypeScript."}
```

### Markdown

Alternating `Human:` and `Assistant:` prefixes:

```
Human: Build a REST API with Express
Assistant: I'll set up Express with TypeScript.
```

---

## How It Works

### Signal Detection

Messages are scored by detecting four signal categories with weighted importance:

| Category | Weight | What it catches |
|----------|--------|-----------------|
| Decision | 2 | "we decided to", "will use", "switched to" |
| Constraint | 2 | "must not", "required", "not allowed" |
| Artifact | 3 | File paths, API endpoints, code blocks |
| Todo | 1.5 | "TODO:", "FIXME:", "next step" |

### Session Segmentation

Sessions are divided into four phases based on message position:

| Phase | Range | Purpose |
|-------|-------|---------|
| Goal | 0-15% | Initial requirements and objectives |
| Exploration | 15-50% | Research and design discussion |
| Implementation | 50-85% | Code writing and iteration |
| WrapUp | 85-100% | Summary and next steps |

### Deduplication

New entries are compared against existing MEMORY.md content using Dice coefficient similarity on character bigrams. Entries above the 0.85 similarity threshold are merged, keeping the most recent version.

---

## MEMORY.md Budget

MEMORY.md is managed with strict line limits to stay within Claude's system prompt constraints:

| Section | Default Limit |
|---------|---------------|
| Pinned Essentials | 80 lines |
| Index Links | 40 lines |
| Recent Decisions | 60 lines |
| **Total** | **200 lines** |

When a section exceeds its limit, overflow content is written to topic files and linked from the Index section.

---

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

---

## Library API

cc-intel exports its core functions for programmatic use:

```typescript
import {
  parseSession,
  discoverLatestSession,
  segmentSession,
  extractSnapshot,
  parseMemoryDocument,
  mergeIntoMemory,
  assessRisk,
  loadConfig,
} from 'cc-intel';
```

See [docs/api.md](docs/api.md) for the full API reference.

---

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
