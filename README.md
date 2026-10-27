# Prompt Library

Prompt Library is a personal, single-user browser library for storing, organizing, finding, and copying reusable AI instructions. Prompts, folders, tags, versions, bundles, settings, and usage counters stay in the browser’s IndexedDB; there is no account, backend, cloud sync, analytics, or model integration.

Personal V1 supports prompt CRUD, full-content reading, folders, tags, favorites, ranked search, metadata, deterministic variables, version history with diff/restore, ordered bundles, keyboard shortcuts, responsive layout, theme settings, and verified JSON backup/replace restore.

## Hosted app

[Open Prompt Library](https://masterzoidberg.github.io/prompt-library/). This static version saves your library in this browser's IndexedDB; it does not upload or sync prompts to a server. Use the JSON export/import flow in Settings to back up or move your library to another browser or device.

## Commands

```bash
npm ci --include=dev  # Install the lockfile, including verification tools
npm run dev           # Start the Vite development server
npm run build         # Type-check and create a production bundle
npm run preview       # Serve the production bundle locally
npm run lint          # Run oxlint against src/
npm run test          # Run unit/component tests once
npm run test:watch    # Run Vitest in watch mode
npm run test:e2e      # Run Playwright browser workflows
npm run perf          # Run the scale performance envelope
docker compose up --build  # Build and serve the production image at localhost:8080
```

`npm run test` intentionally excludes the Playwright files under `tests/e2e/` and the timing-sensitive benchmark under `src/performance/`; run those through their dedicated commands.

## Stack

- React 19 + TypeScript 6 in strict mode
- Vite 8
- Tailwind CSS 3
- IndexedDB via `idb`
- lucide-react icons and sonner toasts
- Vitest + Testing Library + fake-indexeddb for tests
- Playwright for isolated browser workflows

## Documentation

- [Product scope](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Backup and recovery](docs/BACKUP_AND_RECOVERY.md)
- [Development and verification](docs/DEVELOPMENT.md)
- [Current state](docs/CURRENT_STATE.md)
- [Roadmap](docs/ROADMAP.md)
- [Current task ledger](plan/completion/TASKS.md)
- [Recommended next task](plan/completion/NEXT.md)
- [Personal V1 release gate](plan/completion/V1_GATE.md)

[`Design.md`](./Design.md) is retained as a historical specification. The linked documentation and [`plan/completion/`](./plan/completion/) describe the current implementation.

## Docker

```bash
docker compose up --build
```

Open `http://localhost:8080`. Docker serves the production SPA; prompts and settings still live in the browser's IndexedDB for that origin. The image does not contain or persist a browser library. Use the app's verified JSON export/import flow to move library data between browser profiles.
