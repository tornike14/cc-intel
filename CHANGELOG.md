# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-02-28

### Added

- ASCII art branding in CLI help output (`cc-intel --help`)
- Post-install banner displayed after `npm install`
- Expanded npm keywords for better discoverability
- Native Claude Code session parser — reads real session files from `~/.claude/projects/`
- Session auto-discovery: commands find the latest session automatically when no file is specified
- Positional `[file]` argument on `snapshot`, `risk`, and `preserve` commands

### Changed

- Improved command descriptions for clarity
- Overhauled README with marketing copy and structured documentation
- Updated help text with documentation and issue links
- Zero-argument usage is now the primary CLI pattern (`cc-intel snapshot` instead of `cc-intel snapshot --input session.jsonl`)
- Simplified README command examples to lead with auto-discovery

### Fixed

- Budget enforcement infinite loop when `totalLines - maxLines = 1`
- Duplicate overflow filenames when same section overflows multiple times on same date

## [0.1.0] - 2026-02-28

### Added

- CLI commands: `snapshot`, `risk`, `preserve`, `status`
- Heuristic signal detection with weighted scoring (Decision, Constraint, Artifact, Todo)
- Session segmentation into 4 phases (Goal, Exploration, Implementation, WrapUp)
- Snapshot extraction with 5 structured sections
- Deduplication engine using Dice coefficient similarity
- MEMORY.md parser, serializer, budget enforcement, and merger
- Context risk assessment with token estimation
- Atomic file operations with advisory locking
- Configuration file support (`.cc-intelrc.json`) with env var overrides
- JSONL and markdown session input formats with auto-detection
- End-to-end integration tests
- CI/CD with GitHub Actions (Node 18/20/22 matrix)
- Full documentation (README, architecture, API reference)
