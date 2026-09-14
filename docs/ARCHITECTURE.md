# Architecture

## Runtime flow

`src/main.tsx` mounts the React app. `src/App.tsx` seeds the protected system folder and default settings, runs migrations, and shows a blocking retry state if local storage cannot be prepared or loaded.

After startup, the provider tree is:

```text
SettingsProvider
└── LibraryDataProvider
    └── AppStateProvider
        ├── AppShell (sidebar, top bar, responsive drawer)
        ├── PromptList / bundle views
        ├── CommandPalette
        └── DialogRouter
```

`SettingsProvider` owns the single in-memory settings record. `LibraryDataProvider` owns loaded prompts, folders, tags, and bundles plus explicit load errors. `AppStateProvider` owns transient navigation, dialog, palette, and filter state.

## Persistence boundaries

React components call hooks. Hooks call repositories. Repositories own all IndexedDB access, validation, and transaction boundaries. Components never access `indexedDB` directly.

Pure services have no React or database dependency:

- `src/utils/search.ts` builds normalized documents and deterministic ranked results.
- `src/services/templateService.ts` detects and renders the supported variable grammar.
- `src/services/diffService.ts` produces readable version comparisons.
- `src/data/importExport.ts` validates, checksums, exports, and restores detached data.
- `src/data/migrations.ts` runs guarded additive migrations and verifies counts/content hashes.

The current IndexedDB structure is version 2. The stores are `prompts`, `folders`, `tags`, `settings`, `promptVersions`, and `bundles`; their indexes and invariants are documented in [DATA_MODEL.md](DATA_MODEL.md).

## Cross-record invariants

- Folder and tag normalized names are unique.
- The `unfiled` folder always exists and cannot be renamed or deleted.
- Prompt folder and tag references are checked before writes.
- Version creation and an authored prompt update share one transaction.
- Deleting a folder moves its prompts to `Unfiled` atomically.
- Deleting a tag removes its ID from affected prompts atomically.
- Deleting a prompt removes it from bundles in the same transaction.
- Backup restore validates and verifies all data before a replacement transaction and re-reads the result before reporting success.

## Deliberate constraints

This is a client-only SPA with no router, backend, service worker, telemetry, or model API. Search remains in memory through the tested 5,000-asset envelope. See [PERFORMANCE.md](../plan/completion/PERFORMANCE.md) for the repeatable baseline and [ROADMAP.md](ROADMAP.md) for deferred capabilities.
