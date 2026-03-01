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

**Your Claude Code sessions are losing memory. cc-intel fixes that.**

You spend an hour making architectural decisions with Claude Code. Then the context window fills up, compaction kicks in, and those decisions vanish. Next session? Claude starts from scratch, contradicts itself, and you repeat the same conversations.

cc-intel reads your session transcripts, uses Claude to extract what matters, and writes it to MEMORY.md so nothing gets lost.

---

## What it does

| Command | What it does |
|---------|-------------|
| `cc-intel snapshot` | Reads your latest session, extracts decisions, constraints, artifacts, and tasks |
| `cc-intel preserve` | Same as snapshot, but writes the results directly into MEMORY.md |
| `cc-intel risk` | Shows how full your context window is and warns before compaction hits |
| `cc-intel status` | Shows MEMORY.md health: how full each section is, what's near its limit |
| `cc-intel projects` | Browse all your Claude Code projects and pick one to analyze |

Every command auto-discovers your latest session from `~/.claude/projects/`. No flags needed.

---

## Install

```bash
npm install -g cc-intel
```

### API key setup

cc-intel uses Claude Haiku to extract knowledge from your sessions. You need an Anthropic API key.

1. Get one at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Add it to your shell:

```bash
echo 'export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here' >> ~/.zshrc
source ~/.zshrc
```

(On bash, use `~/.bashrc` instead. On Windows, see the instructions shown when you run any command without a key set.)

Cost is roughly $0.001 per extraction.

> **Your key stays on your machine.** cc-intel reads it from the environment variable at runtime and sends it only to the Anthropic API. It is never stored to disk, logged, or transmitted anywhere else. This is the same BYOK (bring your own key) pattern used by every major CLI tool.

---

## Usage

### Extract a snapshot

```bash
cc-intel snapshot
```

Reads the latest session from your current project and prints a structured breakdown:

```
  # Session Snapshot
  --------------------------------------------------

  ## Project Goal (2)
    - Build a REST API with Express and TypeScript
    - Add JWT authentication for all protected routes

  ## Key Decisions (5)
    - Use PostgreSQL with Drizzle ORM instead of Prisma
    - Store sessions in Redis for horizontal scaling
    ...

  ## Constraints (3)
    - API must return responses under 200ms at p99
    ...

  ## Implementation Artifacts (4)
    - Created src/routes/auth.ts with login/register endpoints
    ...

  ## Open Tasks (2)
    - Add rate limiting middleware
    - Write integration tests for auth flow

  --------------------------------------------------
  Extracted 16 entries from 85 messages
```

### Preserve to MEMORY.md

```bash
cc-intel preserve            # write to MEMORY.md
cc-intel preserve --dry-run  # preview without writing
```

Extracts knowledge and merges it into your project's MEMORY.md with deduplication. Existing entries are preserved; duplicates are skipped. Budget limits keep the file from growing unbounded.

### Check compaction risk

```bash
cc-intel risk
```

Estimates how full your context window is and classifies the risk:

```
# Context Risk Assessment

Risk Level: **HIGH**

Utilization: 72.3% [##############......]
Estimated tokens: 144,600 / 200,000
Messages: 127
```

Exits with code 1 when risk is High or Critical -- useful in CI or git hooks.

### Check MEMORY.md health

```bash
cc-intel status
```

Shows budget utilization per section:

```
  MEMORY.md Status
  --------------------------------------------------
  Path: /Users/you/.claude/projects/.../memory/MEMORY.md
  Total: 142/200 lines (71%)

    Pinned Essentials: 45/80 [########.......] 56%
    Index Links: 12/40 [####...........] 30%
    Recent Decisions: 52/60 [#############..] 87%
```

### Browse projects

```bash
cc-intel projects        # interactive picker
cc-intel projects --json # machine-readable list
```

Shows all Claude Code projects, lets you pick one, then runs snapshot/risk/preserve on it.

---

## How it works

1. **Parse** -- reads native Claude Code session files (JSONL) from `~/.claude/projects/`
2. **Pre-filter** -- scores messages by signal patterns (decisions, constraints, artifacts, TODOs) and picks the top ~60 messages
3. **Extract** -- sends the filtered messages to Claude Haiku, which identifies the actual knowledge worth preserving
4. **Deduplicate** -- compares new entries against existing MEMORY.md using Dice coefficient similarity
5. **Write** -- merges into MEMORY.md with atomic file writes and advisory locking

The pre-filtering step uses heuristic signal detection to reduce what gets sent to the LLM. This keeps cost under $0.001 per extraction while preserving extraction quality.

---

## Session auto-discovery

When you run any command without specifying a file, cc-intel:

1. Finds the git root of your current directory
2. Looks in `~/.claude/projects/<project>/` for session files
3. Uses the most recently modified one

You can also pass a file explicitly:

```bash
cc-intel snapshot path/to/session.jsonl
cc-intel snapshot --json -o snapshot.json
```

Supported formats: native Claude Code JSONL (auto-detected), simple JSONL (`{"role":"human","content":"..."}` per line), and markdown (`Human:` / `Assistant:` prefixes).

---

## MEMORY.md budget

MEMORY.md has strict line limits to stay useful inside Claude's system prompt:

| Section | Default limit |
|---------|--------------|
| Pinned Essentials | 80 lines |
| Index Links | 40 lines |
| Recent Decisions | 60 lines |
| **Total** | **200 lines** |

When a section overflows, excess content moves to a topic file and a link replaces it in MEMORY.md.

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

- `CC_INTEL_LOG_LEVEL` -- `debug`, `info`, `warn`, `error`
- `CC_INTEL_MAX_CONTEXT` -- max context token count

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

---

## Privacy and security

- **BYOK model** -- you provide your own Anthropic API key. cc-intel never stores, logs, or transmits it anywhere except the Anthropic API
- **Local processing** -- session parsing, scoring, deduplication, and memory management all run locally on your machine
- **No telemetry** -- cc-intel sends nothing home. No analytics, no tracking, no phone calls
- **Open source** -- every line of code is auditable. MIT licensed

## License

MIT
