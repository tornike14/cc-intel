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
- `cc-intel projects` command — interactive project picker with arrow-key selection
- `cc-intel projects --json` for CI-friendly project listing
- Filesystem-assisted path decoding for project names with hyphens (e.g., `cc-intel`)

### Changed

- Improved command descriptions for clarity
- Overhauled README with marketing copy and structured documentation
- Updated help text with documentation and issue links
- Zero-argument usage is now the primary CLI pattern (`cc-intel snapshot` instead of `cc-intel snapshot --input session.jsonl`)
- Simplified README command examples to lead with auto-discovery
- Improved error messages when no session is found — suggests `cc-intel projects` as alternative

### Fixed

- `preserve --input <file>` now derives MEMORY.md path from the session file location when the file is under `~/.claude/projects/`, instead of falling back to cwd or global
- Deduplication now detects prefix matches across truncation limit changes (e.g., upgrading from 150-char to 500-char entries), keeping the longer entry
- Budget enforcement infinite loop when `totalLines - maxLines = 1`
- Duplicate overflow filenames when same section overflows multiple times on same date
- Overflow filename collision between section-limit and global trimming passes
- Overflow files now use timestamps (not just dates) so multiple preserve runs per day don't overwrite each other
- Snapshot command continuing to emit output after session discovery failure
- Risk assessment now reserves 5,000 tokens for system prompt and MEMORY.md overhead, giving more accurate utilization
- MEMORY.md path now defaults to project-specific location (`~/.claude/projects/<dir>/memory/MEMORY.md`) instead of non-existent global `~/.claude/MEMORY.md`
- `projects` command preserve case now writes to the selected project's memory directory
- Standardized home directory resolution on `os.homedir()` across all CLI commands
- Entry truncation increased from 150 to 500 characters with ellipsis indicator
- Claude Code session parser now logs warnings for skipped lines and includes line count in error messages
- `listProjects()` now scans projects in parallel for better performance with many projects
- Windows path encoding for drive letters (e.g., `C:\Users\foo` encodes correctly)

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
