# cc-intel

**Claude Context Guardian** — a local-first CLI tool that strengthens Claude Code's reliability by monitoring context usage, extracting architectural knowledge, and preserving critical decisions into memory.

## Features

- Monitor context usage and compaction risk
- Extract high-value decisions from sessions using heuristic scoring
- Preserve knowledge into Claude's MEMORY.md with budget enforcement
- Deduplicate entries across sessions
- Safe atomic file operations with locking

## Installation

```bash
npm install -g cc-intel
```

## Usage

```bash
cc-intel --help
```

## Development

```bash
npm install
npm run build
npm run test
npm run lint
npm run typecheck
```

## License

MIT
