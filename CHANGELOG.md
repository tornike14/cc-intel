# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-02-28

### Added

- ASCII art branding in CLI help output (`cc-intel --help`)
- Post-install banner displayed after `npm install`
- Expanded npm keywords for better discoverability

### Changed

- Improved command descriptions for clarity
- Overhauled README with marketing copy and structured documentation
- Updated help text with documentation and issue links

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
