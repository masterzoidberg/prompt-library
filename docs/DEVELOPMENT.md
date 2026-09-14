# Development and verification

## Setup

Use the lockfile with a current Node.js version compatible with the package dependencies. The release evidence was recorded on Node v22.19.0, Windows x64.

```bash
npm ci --include=dev
npm run dev
```

The development server is the default Vite server. Playwright starts its own isolated server on `127.0.0.1:4173` when running browser tests.

For a production-like local container:

```bash
docker compose up --build
```

This serves the static bundle at `http://localhost:8080`. IndexedDB remains browser-local and is not stored in the container; use the verified JSON backup/restore flow for library portability.

## Checks

```bash
npm run lint
npm run test
npm run test:e2e
npm run perf
npm run build
npm run preview
```

`npm run test` runs Vitest unit/component/hook/repository tests and excludes `tests/e2e/**` and `src/performance/**`. `npm run test:e2e` creates a fresh browser context per test, which isolates IndexedDB. `npm run perf` measures production repository/service paths against deterministic 100, 1,000, and 5,000-prompt fixtures; results are recorded in [PERFORMANCE.md](../plan/completion/PERFORMANCE.md).

## Source map

- `src/App.tsx`: startup, recovery, and provider composition.
- `src/components/`: layout, prompt, bundle, settings, and common UI.
- `src/hooks/`: shared settings/library state and transient app state.
- `src/data/`: IndexedDB schema, repositories, migrations, and backup/restore.
- `src/services/`: pure template and diff services.
- `src/utils/`: pure search, sorting, date, ID, normalization, and clipboard helpers.
- `src/test/`: setup, deterministic fixtures, and builders.
- `tests/e2e/`: maintained Playwright workflows.

## Implementation boundaries

Use repositories for all database access and preserve exact prompt content. Additive IndexedDB schema changes require a migration and fixture coverage. Backup JSON changes require compatibility tests. Do not add dependencies, services, network access, or product features outside the current scope without an explicit decision.
