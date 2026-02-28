# Contributing to cc-intel

## Development Setup

```bash
git clone https://github.com/tornike14/cc-intel.git
cd cc-intel
npm install
npm run build
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build with tsup |
| `npm run dev` | Build in watch mode |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run typecheck` | TypeScript type checking |

## Branch Naming

| Prefix | Use |
|--------|-----|
| `setup/` | Infrastructure, tooling, CI |
| `feat/` | New module or feature |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `release/` | Version bumps |
| `chore/` | Maintenance, dependency updates |

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(signals): add weighted scoring for decision patterns
fix(memory): handle empty section during budget enforcement
test(dedup): add idempotency verification
docs(readme): add installation guide
chore(deps): update proper-lockfile to 4.x
ci: add Node 22 to test matrix
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all checks pass: `npm run typecheck && npm run lint && npm run format:check && npm test`
4. Open a PR against `main`
5. Wait for CI and code review
