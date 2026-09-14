# Prompt Library completion audit — historical baseline

Audit date: 2026-09-09

This file records the pre-V1 implementation audit and is retained for traceability. For current status and release evidence, use [`docs/CURRENT_STATE.md`](../../docs/CURRENT_STATE.md), [`TASKS.md`](./TASKS.md), and [`V1_GATE.md`](./V1_GATE.md). `Design.md` remains historical input, not current truth.

## Executive verdict

Prompt Library is a small, local-only React application with a coherent IndexedDB repository layer and a usable CRUD shell. It builds cleanly and its 54 tests pass. Prompt create/edit/duplicate/favorite/move/delete, flat folders, tags, literal substring search, sorting, theme settings, copy counters, and replace-style JSON import/export all exist.

It is an early functional prototype, not safe for long-term daily use. The strongest code is the simple repository layer and transactional folder/tag cleanup. The largest weaknesses are silent persistence failures, unsafe restore UX, no real migration system, split settings state, weak search, thin UI/E2E coverage, and the complete absence of variables, history, diff/restore, and bundles. Runtime checks also proved that sorting does not update the list, dropdown selections remain open and block interaction, copy writes twice, and delete confirmation is shown even when disabled.

Architecture condition: fundamentally suitable and worth retaining. Do not replace IndexedDB, React, or the repositories. Centralize shared settings, add explicit data-version/migration/backup services, and keep feature logic in small pure services. Do not rename `Prompt` to `InstructionAsset` during Personal V1; add a lightweight `type` discriminator and use “asset” only where the broader term materially helps.

Recommended Personal V1: repair current workflow defects; make backup, staged restore, and migrations trustworthy; add lightweight asset metadata, deterministic variables, version history with diff/restore, ordered bundles, ranked search, an in-app command palette, and keyboard/E2E coverage. Arbitrary relationships, live reusable blocks, composer, section reordering, a true global launcher, browser extension, and AI utilities are post-V1.

## Repository inventory

| Area | Actual owners | Finding |
| --- | --- | --- |
| Entry | `index.html`, `src/main.tsx`, `src/App.tsx` | One SPA entry; no router. Startup suppresses seed failures and proceeds. |
| UI shell | `src/components/layout/*` | Sidebar, top bar, responsive drawer, list-only main view. |
| Prompt UI | `src/components/prompts/*` | Card grid and modal CRUD; no detail view, history, variables, or bundle UI. |
| Settings/backup UI | `src/components/settings/*` | Settings plus destructive replace import/export. |
| State | `src/hooks/LibraryDataProvider.tsx`, `src/hooks/AppStateProvider.tsx`, feature hooks | Library data is shared; settings are not. Every mutation reloads all stores. |
| Persistence | `src/data/db.ts`, `src/data/*Repository.ts` | IndexedDB v1 via `idb`; four stores: prompts, folders, tags, settings. |
| Import/export | `src/data/importExport.ts` | JSON envelope v1; validates some shapes/references, then clears and replaces in one transaction. |
| Search/sort | `src/utils/search.ts`, `src/utils/sort.ts` | Case-insensitive substring filter and four basic sorts; no ranking/highlights/fuzzy tolerance. |
| Cross-cutting utilities | `src/utils/*` | Clipboard fallback, UUID, dates, normalization, redacting logger. Several exports are unused. |
| Tests | adjacent `*.test.*`, `src/test/*` | 54 passing unit/component tests; no maintained browser/E2E suite, migration, recovery, keyboard, or performance tests. |
| Styling/build | `src/styles/globals.css`, Tailwind/Vite/TypeScript configs | Simple and healthy; production bundle is 364.70 kB JS (113.69 kB gzip). |
| Docs | `README.md`, `Design.md` | README is brief; Design is stale and contradicts both code and requested direction. `docs/plan.md` and `docs/roadmap.md` do not exist. |
| Non-product material | `.kilo/`, `prompt-library.zip`, `dist/`, `node_modules/` | `.kilo` is local agent tooling. ZIP is a 15,032-entry, 61 MB full snapshot including dependencies, not an app backup. Generated/vendor trees are not product source. |

There is no `.git` directory in the audited workspace, so history, tracked/untracked status, and provenance are UNKNOWN.

## Repository reality map

```text
src/main.tsx
  -> src/App.tsx
     -> ensureSeeded()                         src/data/db.ts
     -> LibraryDataProvider                    src/hooks/LibraryDataProvider.tsx
        -> prompt/folder/tag repositories      src/data/*Repository.ts
        -> IndexedDB "prompt-library" v1       prompts | folders | tags | settings
     -> AppStateProvider                       src/hooks/AppStateProvider.tsx
        -> transient view/dialog/tag-filter state
     -> AppShell + PromptList + DialogRouter   src/components/**

Separate, competing settings state:
AppShell -> useSettings()
TopBar -> useSettings()
PromptList -> useSettings()
SettingsDialog -> useSettings()
Each instance reads/writes the same DB record but does not notify the others.
```

No routing, service worker, desktop wrapper, extension, backend, cloud service, telemetry, or AI/model integration is present.

## Current workflow findings

| Workflow | Actual behavior | Reliability/polish issue |
| --- | --- | --- |
| Open | Seeds `Unfiled` and settings, then loads all records. | Seed/load errors are swallowed; an empty-looking library can mask inaccessible data. |
| Find/browse | All, Favorites, folder, tag, search; card grid only. | Search loses previous context when cleared; empty search/filter claims there are no prompts; tag multi-filter state has no UI path. |
| View | Card shows truncated content/description. Clicking copies. | No full read view; long content must be opened in edit mode. Interactive buttons are nested inside an element with `role="button"`. |
| Create/edit | Modal form for title/content/description/folder/tags. | Cannot create tags/folders inline; dirty comparison is order-sensitive; repository references are not validated. |
| Copy/use | Card or copy icon copies content and records usage. | Browser test recorded two clipboard writes per action. Success indicator can diverge from counter persistence; failures can be silent. |
| Duplicate | Creates `Copy of ...`, resets usage. | No collision strategy or immediate edit/open affordance. |
| Move | Single prompt moved via dialog. | Unused bulk repository method exists; no error state/busy guard. |
| Tag/favorite | CRUD tags; single tag view; favorite toggle. | Multi-tag filtering is unreachable. Tag deletion does not update affected prompt timestamps. |
| Sort/settings | UI exposes four sorts and theme/delete settings. | Sort selection did not reorder the list at runtime; theme changes are not propagated live; delete preference is ignored. |
| Delete | Always opens confirmation; permanent delete. | No trash/undo/version recovery. Async failures are not handled in confirmation dialog. |
| Export | Downloads one readable JSON file. | “Backup downloaded” is reported after initiating a browser download, without round-trip verification or storage confirmation. |
| Import/restore | Validates then replaces all four stores transactionally after confirmation. | No preview, pre-restore backup, merge mode, supported-version gate, migration, duplicate report, or recovery path. |
| Return later | IndexedDB retains data in the same browser profile. | Browser/site-data deletion loses everything; no reminders or automatic/user-selected backup target. |

## Capability matrix

| Capability | Status | Owner files | Evidence | V1? |
| --- | --- | --- | --- | --- |
| SPA startup | PARTIAL | `src/App.tsx`, `src/data/db.ts` | Works in browser; persistence errors are swallowed. | Yes |
| Prompt CRUD | PARTIAL | `src/data/promptRepository.ts`, `src/components/prompts/*` | CRUD tests pass; no reference integrity, recovery, or robust async errors. | Yes |
| Full prompt viewing | PLACEHOLDER | `src/components/prompts/PromptCard.tsx`, `PromptFormDialog.tsx` | Only truncated card or edit modal. | Yes |
| Folders | PARTIAL | `folderRepository.ts`, `Sidebar.tsx`, `DialogRouter.tsx` | CRUD/transaction tests pass; counts are never computed/rendered and context array is sorted in place. | Yes |
| Tags | PARTIAL | `tagRepository.ts`, `Sidebar.tsx`, `PromptFormDialog.tsx` | CRUD works; selected multi-tag state is unreachable. | Yes |
| Favorites | COMPLETE | `PromptList.tsx`, `PromptCard.tsx`, `AppStateProvider.tsx` | Integrated toggle/view; covered indirectly, not end-to-end. | Yes |
| Copy tracking | PARTIAL | `PromptCard.tsx`, `PromptList.tsx`, `promptRepository.ts` | Repository test passes; runtime shows duplicate clipboard writes. | Yes |
| Recent/most-used views | PARTIAL | `sort.ts`, settings sort UI | Sorting exists; no dedicated Recent view and shared-state bug prevents live list update. | Yes |
| Search | PARTIAL | `utils/search.ts`, `PromptList.tsx`, `TopBar.tsx` | Literal substring across five fields; tests pass; no ranking, highlights, fuzzy tolerance, keyboard results. | Yes |
| Sorting | PARTIAL | `utils/sort.ts`, `TopBar.tsx`, `PromptList.tsx` | Pure tests pass; runtime selection does not change list. | Yes |
| Settings persistence | PARTIAL / DUPLICATED | `useSettings.ts` used independently in four components | DB update works; consumers diverge until remount/reload. | Yes |
| Theme | PARTIAL | `useTheme.ts`, `AppShell.tsx`, `SettingsDialog.tsx` | Persists but does not reliably apply immediately after dialog save. | Yes |
| Delete preference | PLACEHOLDER | `types/settings.ts`, `SettingsDialog.tsx`, `DialogRouter.tsx` | Stored setting is never consulted; runtime confirms dialog still appears when disabled. | Yes |
| Keyboard shortcuts | PARTIAL | `useKeyboardShortcuts.ts`, `PromptFormDialog.tsx`, Radix dialogs | `/`, Enter/Space card copy, Ctrl/Cmd+Enter, Escape via Radix; no palette/navigation/new/save/copy/favorite system. | Yes |
| Responsive layout | PARTIAL | `AppShell.tsx`, `MobileSidebar.tsx`, CSS | Breakpoints exist; mobile drawer is custom and lacks focus trap/Escape handling. | Yes |
| Accessibility | PARTIAL | common primitives and components | Labels/Radix help; card has nested controls inside button role; drawer and tag selection semantics are weak. | Yes |
| JSON export | PARTIAL | `importExport.ts`, `ImportExportPanel.tsx` | Round-trip test for v1 records passes; success is not verified and future entities absent. | Yes |
| JSON import/restore | PARTIAL | same | Pre-validation and atomic transaction exist; version/migration/preview/pre-backup absent. | Yes |
| Merge import | PLANNED ONLY | none | Requested direction only. | No; replace is enough if safe |
| Data migrations | PLACEHOLDER | `db.ts`, `Settings.schemaVersion` | Generic create-if-missing upgrade only; no old-version cases/fixtures/rollback. | Yes |
| Variables/templates | PLANNED ONLY | none | No parser, renderer, model, or UI. | Yes |
| Asset types/target tools/notes | PLANNED ONLY | none | Current model is only `Prompt`. | Yes |
| Version history | PLANNED ONLY | none | Absent. | Yes |
| Diff/restore | PLANNED ONLY | none | Absent. | Yes |
| Bundles/workflows | PLANNED ONLY | none | Absent. | Yes |
| Related assets | PLANNED ONLY | none | Absent. | Post-V1 |
| Reusable blocks | PLANNED ONLY | none | Absent. | Post-V1 |
| Composer | PLANNED ONLY | none | Absent. | Post-V1 |
| Markdown outline | PLANNED ONLY | none | Content is plain textarea/pre. | Post-V1 (outline only) |
| In-app command palette | PLANNED ONLY | none | Only `/` focuses search. | Yes |
| True global launcher | PLANNED ONLY | none | Browser SPA cannot own an OS-global shortcut. | Post-V1 |
| Browser extension | PLANNED ONLY | none | No extension manifest/bridge. | Post-V1 |
| Automatic backup | PLANNED ONLY | none | Browser download only. | Post-V1; reminder in V1 |
| Optional AI utilities | PLANNED ONLY | none | No model integration. | No |
| Golden fixture/performance | PLANNED ONLY | ad hoc small test objects only | No representative fixture or scale measurements. | Yes |
| Logger | DEAD / UNUSED | `src/utils/log.ts` | Imported only by its test. | Remove or integrate only if a real caller appears |
| Bulk move helper | DEAD / UNUSED | `promptRepository.ts` | No UI/hook caller. | Remove unless bulk UI is explicitly added later |
| Multi-tag selection state | PLACEHOLDER / DEAD | `AppStateProvider.tsx`, `PromptList.tsx` | Filter logic exists, but no control calls `toggleTagFilter`. | Simplify now; re-add with search filters |

## Discrepancy ledger

| ID | Area | Claimed | Actual | Impact | Resolution |
| --- | --- | --- | --- | --- | --- |
| DISC-001 | Orientation docs | Skill expects `docs/plan.md` and `docs/roadmap.md`. | Both are missing. | No durable execution source. | Use this directory only. |
| DISC-002 | Tooling | `Design.md` specifies ESLint, Prettier, and `npm run format`. | Oxlint is used; no format script/config. | Misleading setup and completion checks. | Document actual scripts; decide formatting once, without tool churn. |
| DISC-003 | Versions | Design says React 18/Vite 5. | Package uses React 19/Vite 8/TypeScript 6. | Stale technical guidance. | Update authoritative docs after V1 contracts settle. |
| DISC-004 | File map | Design lists `promptRepo.ts`, folder/tag/search component trees, debounce, and a different date utility. | Those paths do not exist; ownership is consolidated elsewhere. | Fresh sessions search for phantom architecture. | Preserve current compact layout and correct docs. |
| DISC-005 | Search | Design calls it “filter+rank.” | It is unranked substring filtering. | Poor recall/order at scale. | Implement deterministic scoring in `SEARCH-01`. |
| DISC-006 | Keyboard | Design says prompt CRUD is available “via UI and keyboard.” | Only a few shortcuts exist; card nested-control semantics are invalid. | Power-user goal and accessibility are unmet. | `KEY-01`, `PALETTE-01`, `A11Y-01`. |
| DISC-007 | Settings | UI implies sort/theme/preferences apply immediately. | Separate hook instances do not share updates; confirmation is ignored. | Observable wrong behavior. | `STATE-01` then focused UI fixes. |
| DISC-008 | Copy | Design promises one-click copy and consistent confirmation. | One action writes clipboard twice; error/success ownership is split. | Duplicate side effect and misleading feedback. | `COPY-01`. |
| DISC-009 | Import version | Export has `version`; validation accepts any number. | Unsupported future/backward formats can reach replacement logic. | Compatibility and data-loss risk. | Reject/migrate explicitly in `BACKUP-01`. |
| DISC-010 | Import safety | Design says full validation and lossless round-trip. | Structural checks are incomplete; no pre-backup/preview; only current entities round-trip. | Not safe as recovery. | `BACKUP-01` and `BACKUP-02`. |
| DISC-011 | Migrations | DB/settings expose version numbers. | No explicit migration path or migration test exists. | Model evolution is unsafe. | `MIG-01`. |
| DISC-012 | Folder uniqueness | Design forbids user folder name equal to `Unfiled`. | Unique normalized-name index enforces it while system folder exists, but import can fail late on duplicate normalized names. | Rule is incidental and validator incomplete. | Make invariant explicit in validators/tests. |
| DISC-013 | Empty state | UI says “No prompts yet.” | Same message appears for empty search/folder/favorites. | Misleading navigation and recovery action. | `UX-03`. |
| DISC-014 | Dropdowns | Menu actions imply selection closes the menu. | Shared item calls `preventDefault`; runtime menu remained open and intercepted clicks. | Core navigation stalls until Escape. | `UX-01`. |
| DISC-015 | Test confidence | All checks pass. | Browser-verifiable regressions above have no failing automated test. | Green suite overstates completeness. | Add workflow E2E and regression tests before feature expansion. |
| DISC-016 | Original non-goals | Design explicitly excludes variables/history. | Current product direction requires both for Personal V1. | Historical spec is no longer authoritative. | Record new boundary in `PRODUCT_DECISIONS.md`. |
| DISC-017 | Repository | Project is described like a normal source repository. | `.git` is absent; a 61 MB ZIP snapshots dependencies and source. | No change history; archive may be mistaken for user backup. | Establish source control separately; never treat ZIP as library data. |

## Existing test classification

Valid: repository CRUD/transaction tests, import/export happy-path validation, search/sort pure tests, shared library context tests, settings hook storage tests, PromptCard unit tests, and small utility tests.

Weak/brittle: test DB reset reuses a cached open connection rather than deleting/reopening versions; fixtures use empty timestamps and `Math.random`; PromptCard tests assert only one of the two copy layers; date tests depend on wall time/locale; import tests do not exercise duplicate IDs/names, unsupported versions, corrupt timestamps, negative counters, transaction aborts, or settings fidelity.

Redundant: `src/test/smoke.test.ts` proves only that Vitest runs after 53 meaningful tests already do.

Missing: startup failure, settings propagation, dropdown closure, copy failure/counter consistency, delete preference, forms/dirty guard, keyboard behavior, mobile focus, full workflow E2E, migration, variables, versions, diff/restore, bundles, golden fixture, backup recovery, and 100/1,000/5,000-asset performance.

## Verification baseline

- `npm run test`: PASS, 12 files / 54 tests.
- `npm run lint`: PASS.
- `npm run build`: PASS; Vite 8.1.5, 364.70 kB JS / 113.69 kB gzip.
- Isolated Chromium workflow: app opened with no console/page errors; folder/tag/prompt creation worked.
- Isolated Chromium regressions: alphabetical selection left order unchanged; dropdown remained open; one copy produced two clipboard writes; delete confirmation still appeared when disabled.

## Unknowns

- The size and schema quality of the real personal library are UNKNOWN; it was not accessed.
- Browser/device support targets beyond “modern browser” are UNKNOWN.
- Whether the 61 MB ZIP is intentionally retained as a source snapshot is UNKNOWN.
- Whether true automatic backups are acceptable only after a user grants File System Access permission is UNKNOWN; V1 must not depend on that API.
