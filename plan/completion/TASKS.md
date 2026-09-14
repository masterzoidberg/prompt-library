# Execution phases and task ledger

Status meanings: `READY` has no unmet implementation dependency; `BLOCKED` must wait for listed task IDs; `DEFERRED` is outside Personal V1. A task becomes `DONE` only after its acceptance criteria and commands are recorded as passing. Keep each task to one focused session and normally five or fewer product files.

## Phase 0 — Make the current app truthful

### Objective

Remove proven workflow regressions and surface persistence failures before expanding the schema.

### Why now

The green unit suite currently masks broken runtime behavior. New features built on split state and ambiguous async ownership will multiply failures.

### Exact scope

Shared settings ownership; single copy path; dropdown closure; delete preference/error handling; contextual empty states/counts; startup load errors; regression browser tests; confirmed dead code/dependencies.

### Files likely affected

`src/hooks/*Settings*`, `src/components/layout/*`, `src/components/prompts/*`, `src/components/common/Dropdown.tsx`, `src/App.tsx`, `src/hooks/LibraryDataProvider.tsx`, tests, `package.json`.

### Required behavior

Settings update every consumer immediately; one user copy causes one clipboard write and one usage update; menus close; preference and errors are honored; database failure is explicit.

### Tests

Focused component/integration tests plus maintained Playwright workflows. Run full lint/test/build at checkpoint.

### Acceptance criteria

- The four browser regressions in `CURRENT_STATE.md` are covered and fixed.
- Persistence failures cannot render as an empty successful library.
- Existing CRUD/repository tests remain green.

### Dependencies

None.

### Explicit non-goals

No schema change, visual redesign, new asset feature, trash system, or state-management library.

### Completion evidence

Saved command outputs and E2E results for settings, copy, dropdown, delete, startup failure, and core CRUD.

### STATE-01 — Centralize settings state

- **Status:** DONE
- **Dependencies:** none
- **Objective:** Add one provider/context so theme, sort, and preferences update all consumers immediately.
- **Files likely affected:** `src/hooks/useSettings.ts`, new context/provider files under `src/hooks/`, `src/App.tsx`, focused tests.
- **Acceptance criteria:** one DB read at provider load; an update changes TopBar, PromptList, AppShell, and SettingsDialog state without reload; save failure retains prior state and surfaces an error.
- **Verification:** `npm run test -- src/hooks/useSettings.test.ts`; `npm run build`.
- **Non-goals:** new settings, caching library, general state rewrite.

### COPY-01 — Establish one copy action owner

- **Status:** DONE
- **Dependencies:** none
- **Objective:** Make the container/action layer own clipboard write, usage persistence, and feedback.
- **Files likely affected:** `src/components/prompts/PromptCard.tsx`, `PromptList.tsx`, their tests, `src/utils/copy.ts`.
- **Acceptance criteria:** one click/Enter produces exactly one clipboard write; counter updates only after successful copy; either clipboard or persistence failure produces truthful feedback and no false checkmark.
- **Verification:** `npm run test -- src/components/prompts/PromptCard.test.tsx` plus new list/action test.
- **Non-goals:** variables, palette, clipboard history.

### UX-01 — Correct dropdown selection behavior

- **Status:** DONE
- **Dependencies:** none
- **Objective:** Allow Radix to close after actions while preserving async callbacks.
- **Files likely affected:** `src/components/common/Dropdown.tsx`, focused tests.
- **Acceptance criteria:** sort/action selection closes the menu; focus returns correctly; disabled/destructive styling remains.
- **Verification:** focused component test and browser workflow; `npm run lint`.
- **Non-goals:** menu redesign or new primitives.

### UX-02 — Honor destructive-action policy

- **Status:** DONE
- **Dependencies:** STATE-01
- **Objective:** Consult `confirmBeforeDelete`, handle busy/error states, and prevent repeat submissions.
- **Files likely affected:** `DialogRouter.tsx`, `ConfirmDeleteDialog.tsx`, prompt/settings integration tests.
- **Acceptance criteria:** disabled confirmation deletes only from an explicit delete action without opening a second dialog; enabled confirmation works; rejection leaves data intact and displays an error.
- **Verification:** focused tests plus E2E delete preference flow.
- **Non-goals:** trash/undo or bulk delete.

### START-01 — Surface load and seed failures

- **Status:** DONE
- **Dependencies:** none
- **Objective:** Replace swallowed startup/reload errors with a blocking, retryable recovery state.
- **Files likely affected:** `src/App.tsx`, `LibraryDataProvider.tsx`, `libraryDataContext.ts`, new focused tests.
- **Acceptance criteria:** seed/load failure never displays “No prompts yet”; error includes retry and backup/recovery guidance; retry can reach the normal app.
- **Verification:** component tests with rejected repositories; `npm run build`.
- **Non-goals:** database repair automation.

### UX-03 — Make browse states accurate

- **Status:** DONE
- **Dependencies:** none
- **Objective:** Compute folder counts without mutating shared arrays and show context-specific empty states.
- **Files likely affected:** `Sidebar.tsx`, `PromptList.tsx`, `EmptyState.tsx`, tests.
- **Acceptance criteria:** counts reflect prompts; source arrays are not mutated; search/favorites/folder/tag emptiness names the active context and offers a relevant recovery action.
- **Verification:** focused component tests; `npm run lint`.
- **Non-goals:** nested folders, virtualized lists.

### TEST-01 — Add maintained browser workflow coverage

- **Status:** DONE
- **Dependencies:** none
- **Objective:** Add a minimal Playwright test harness for open/create/edit/copy/sort/settings/delete/export-import smoke paths.
- **Files likely affected:** `package.json`, Playwright config, `tests/e2e/core.spec.ts`.
- **Acceptance criteria:** tests use an isolated browser database; capture console/page errors; reproduce current regressions before their fixes and pass afterward.
- **Verification:** new `npm run test:e2e`; `npm run build`.
- **Non-goals:** cross-browser matrix or screenshot-diff suite.

### CLEAN-01 — Remove confirmed dead surface

- **Status:** DONE
- **Dependencies:** TEST-01, UX-03
- **Objective:** Remove `log.ts`, `normalizeForCompare`, unused bulk move, redundant smoke test, and unused popover/tooltip packages if a final import scan confirms no caller.
- **Files likely affected:** named utilities/tests, `promptRepository.ts`, `package.json`, lockfile.
- **Acceptance criteria:** import/dependency scan is clean; no behavior loss; full checks pass.
- **Verification:** `rg` caller scan; `npm run lint && npm run test && npm run build`.
- **Non-goals:** aesthetic refactor or `.kilo`/ZIP deletion.

## Phase 1 — Freeze recovery before changing data

### Objective

Make current v1 data portable, deterministic, and testable; create the migration safety harness.

### Why now

Every desired V1 feature changes persisted data. A verified v1 escape hatch must exist first.

### Exact scope

Golden fixtures, immutable backup-v1 reader, strict validation, backup verification/status, migration journal and failure screen. No new product entities yet.

### Files likely affected

`src/data/importExport.ts`, `src/data/db.ts`, settings/types, fixture/test files, backup UI.

### Required behavior

Every current record round-trips; unsupported/corrupt input is rejected before mutation; a future upgrade can fail without clearing v1 data.

### Tests

Fixture round-trip, adversarial validator cases, transaction abort, and simulated upgrade failure.

### Acceptance criteria

- Current v1 export contract is frozen by a committed fixture.
- Backup verification compares counts, IDs, references, and content.
- Migration state has explicit pending/running/completed/failed handling.

### Dependencies

Phase 0 checkpoint.

### Explicit non-goals

No new data fields/stores, merge import, automated backup directory, or real-library fixtures.

### Completion evidence

Golden fixture results and failure-injection tests; manual export/re-import in an isolated browser profile.

### BACKUP-01 — Freeze and harden backup v1

- **Status:** DONE
- **Dependencies:** none
- **Objective:** Preserve the current format as an immutable reader with strict supported-version and invariant validation.
- **Files likely affected:** `src/data/importExport.ts`, `importExport.test.ts`, new `src/test/fixtures/library-v1.json`.
- **Acceptance criteria:** representative v1 fixture round-trips losslessly; future/invalid versions and duplicate IDs/names, bad dates/counters/references are rejected; active DB is unchanged after every rejection.
- **Verification:** `npm run test -- src/data/importExport.test.ts`.
- **Non-goals:** v2 entities, merge, UI redesign.

### TEST-02 — Add golden and scale fixture builders

- **Status:** DONE
- **Dependencies:** BACKUP-01
- **Objective:** Provide deterministic 100/1,000/5,000-asset libraries with long Markdown, Unicode, duplicate titles, tags, folders, and later-extension hooks.
- **Files likely affected:** `src/test/fixtures/*`, `src/test/builders/*`, fixture tests.
- **Acceptance criteria:** fixed IDs/timestamps and reproducible output; no personal data; builders validate against the v1 reader and can be extended for v2.
- **Verification:** focused fixture test.
- **Non-goals:** seeding the production DB.

### BACKUP-02 — Verify export completion and backup status

- **Status:** DONE
- **Dependencies:** STATE-01, BACKUP-01
- **Objective:** Validate serialized output before download and record only truthful last-backup status.
- **Files likely affected:** `importExport.ts`, `ImportExportPanel.tsx`, settings types/repository, tests.
- **Acceptance criteria:** payload self-validates before download; serialization/download initiation errors are reported; status distinguishes “prepared/download initiated” from guaranteed filesystem save.
- **Verification:** focused unit/component test plus isolated-browser download assertion.
- **Non-goals:** automatic directory write.
- **Completion evidence:** `ImportExportPanel` persists `lastBackupPreparedAt` only after validated download initiation, shows a 30-day reminder without claiming filesystem durability, and the settings/backup tests pass. Fresh-profile file restore is covered in `tests/e2e/core.spec.ts`.

### MIG-01 — Add guarded migration runner

- **Status:** DONE
- **Dependencies:** BACKUP-01, START-01
- **Objective:** Introduce explicit from/to migration steps, journal state, verification, and failure recovery without changing v1 records yet.
- **Files likely affected:** `src/data/db.ts`, new `src/data/migrations.ts`, settings/meta types, migration tests, recovery UI.
- **Acceptance criteria:** no-op v1 migration is idempotent; injected failure aborts and retains records; app blocks normal use with actionable recovery instead of empty state.
- **Verification:** focused fake-indexeddb migration tests; E2E failure simulation.
- **Non-goals:** v2 feature stores or downgrade support.

## Phase 2 — Add the minimal broader asset model

### Objective

Add type, target tools, notes, variable defaults, version and bundle stores through one additive v2 migration.

### Why now

The safety harness is complete, and all later vertical slices need stable contracts.

### Exact scope

Types, defaults, repository validation, additive stores/indexes, v1-to-v2 migration, and v2 backup envelope foundations.

### Files likely affected

`src/types/*`, `src/config/constants.ts`, `src/data/db.ts`, migrations/repositories/import-export, fixture tests.

### Required behavior

All old prompts retain IDs/content/organization/usage and receive deterministic defaults. New references remain valid transactionally.

### Tests

Golden v1 migration, retry/failure tests, exact count/hash checks, and v2 round-trip.

### Acceptance criteria

- Golden v1 migrates to v2 with zero old-field loss.
- New stores/indexes and invariants are typed and tested.
- v1 reader remains supported.

### Dependencies

BACKUP-02, MIG-01, TEST-02.

### Explicit non-goals

No `InstructionAsset` rename, relationships, reusable blocks, or feature UI beyond basic metadata editing/filtering.

### Completion evidence

Before/after fixture manifest and deterministic content/ID comparison.

### DATA-01 — Define additive v2 contracts

- **Status:** DONE
- **Dependencies:** MIG-01
- **Objective:** Add exact V1 model types and repository validation without changing UI.
- **Files likely affected:** `src/types/prompt.ts`, new version/bundle types, `types/index.ts`, repository tests.
- **Acceptance criteria:** enums/defaults match `ARCHITECTURE.md`; malformed references/enums cannot be persisted through repositories; existing callers compile via explicit defaults/adapters.
- **Verification:** typecheck through `npm run build`; focused repository tests.
- **Non-goals:** entity rename or UI.

### MIG-02 — Execute additive IndexedDB v2 migration

- **Status:** DONE
- **Dependencies:** DATA-01, BACKUP-02, TEST-02
- **Objective:** Create version/bundle stores and add prompt defaults with guarded verification.
- **Files likely affected:** `db.ts`, `migrations.ts`, constants, migration tests, golden fixtures.
- **Acceptance criteria:** all v1 IDs/content/metadata survive; repeated startup is idempotent; injected failure leaves recoverable original data and verified backup.
- **Verification:** migration tests at 0/100/5,000 prompts; `npm run build`.
- **Non-goals:** version generation for historical pre-v2 edits.

### META-01 — Expose type, targets, and notes

- **Status:** DONE
- **Dependencies:** MIG-02, STATE-01
- **Objective:** Edit/display/filter lightweight metadata without cluttering copy-first flow.
- **Files likely affected:** `PromptFormDialog.tsx`, prompt read/card UI, app state/search filter UI, tests.
- **Acceptance criteria:** type required/defaulted; targets multi-select and notes optional; metadata persists and is accessible by keyboard.
- **Verification:** component/E2E create-edit-filter test.
- **Non-goals:** provider compatibility rules.

## Phase 3 — Variables as a complete vertical slice

### Objective

Detect, fill, preview, and copy simple placeholders without mutating masters.

### Why now

The field contract exists and variables are the highest-value new use workflow with low model complexity.

### Exact scope

Pure parser/renderer, defaults, missing-value handling, fill dialog/read view integration, remembered values opt-in.

### Files likely affected

New `src/services/templateService.ts`, prompt form/read UI, settings, tests.

### Required behavior

Exact uppercase grammar; deterministic occurrence order/deduplication; multiline literal substitution; preview; master never changes.

### Tests

Parser/render table tests, Unicode/multiline/duplicate/malformed token cases, UI and E2E copy flow.

### Acceptance criteria

- No recursion/evaluation is possible.
- Missing values are visible and copy policy is explicit.
- Filled copy leaves persisted content byte-for-byte unchanged.

### Dependencies

MIG-02, META-01.

### Explicit non-goals

Conditions, loops, filters, lowercase tokens, blocks, secrets manager, or prompt execution.

### Completion evidence

Golden template cases and E2E proof of unchanged master after fill/copy/reload.

### VAR-01 — Implement pure detection and rendering

- **Status:** DONE
- **Dependencies:** DATA-01
- **Objective:** Add the exact token grammar and non-recursive renderer.
- **Files likely affected:** new `src/services/templateService.ts` and test.
- **Acceptance criteria:** deterministic unique variable list; literal one-pass replacement; missing/malformed tokens reported without mutation.
- **Verification:** focused table-driven tests.
- **Non-goals:** React or persistence.

### VAR-02 — Add defaults and fill-preview-copy UI

- **Status:** DONE
- **Dependencies:** VAR-01, META-01, COPY-01
- **Objective:** Add per-prompt defaults, optional remembered values, preview, and rendered copy.
- **Files likely affected:** form/read dialog, settings context/types, prompt actions, E2E test.
- **Acceptance criteria:** multiline values/default precedence works; missing values block normal rendered copy; persisted master is unchanged across fill/copy/reload.
- **Verification:** component tests and `npm run test:e2e` variable flow.
- **Non-goals:** live blocks or programmable templates.

## Phase 4 — Never lose authored work

### Objective

Create atomic version history, readable comparisons, and reversible restoration.

### Why now

Editing templates becomes materially safer before bundles and heavier daily use.

### Exact scope

Meaningful-change detection, version repository/transactions, list, compare, restore, duplicate, copy old version, storage information.

### Files likely affected

Prompt/version repositories, version service/UI, prompt detail, optional diff dependency, tests.

### Required behavior

Prior authored snapshot is stored atomically; identical/organizational changes do not version; restore is reversible.

### Tests

Transaction failure, version sequencing, meaningful equality, restore round-trip, diff rendering, UI/E2E.

### Acceptance criteria

- No successful authored edit lacks its prior snapshot.
- Failed version or prompt write commits neither side.
- Any version can be viewed, copied, duplicated, compared, and restored.

### Dependencies

MIG-02, VAR-02.

### Explicit non-goals

Branches, merge, Git semantics, collaborative authorship, automatic pruning.

### Completion evidence

Repository transaction tests and E2E edit-compare-restore-undo-restore workflow.

### VER-01 — Add atomic version creation

- **Status:** DONE
- **Dependencies:** MIG-02, VAR-02
- **Objective:** Snapshot prior authored fields in the same transaction as meaningful edits/restores.
- **Files likely affected:** `promptRepository.ts`, new `versionRepository.ts`, equality helper, tests.
- **Acceptance criteria:** exact rules in `ARCHITECTURE.md`; monotonic sequence per prompt; injected failure leaves prompt/history unchanged.
- **Verification:** focused fake-indexeddb transaction tests.
- **Non-goals:** UI or pruning.

### VER-02 — Add history, diff, and restore UI

- **Status:** DONE
- **Dependencies:** VER-01, COPY-01
- **Objective:** Show versions and support compare/restore/duplicate/copy.
- **Files likely affected:** prompt detail/history components, diff adapter/service, `package.json` only if approved package is used, tests.
- **Acceptance criteria:** readable added/removed lines; restore confirmation previews outcome and remains reversible; keyboard/focus behavior passes.
- **Verification:** service/component tests and E2E history flow; bundle-size note if dependency added.
- **Non-goals:** three-way diff or section-aware merge.

## Phase 5 — Organize and find at power-user speed

### Objective

Add ordered bundles, scored search, a detail view, and one in-app command palette.

### Why now

Stable data and safe editing are present; discovery and sequential reuse are the remaining core value loop.

### Exact scope

Bundle repository/UI, search index/scoring/highlights, keyboard result navigation, palette actions Open/Copy/Fill Variables.

### Files likely affected

Bundle repository/components, search service/components, app state, prompt detail, E2E/performance tests.

### Required behavior

Bundle order is durable; deleted prompts cannot leave invalid membership; search ranking is deterministic; palette reuses existing actions.

### Tests

Bundle transaction/reorder tests, search relevance tables, scale benchmarks, keyboard and E2E flows.

### Acceptance criteria

- 5,000-asset p95 search is under 100 ms on recorded baseline hardware.
- Bundle create/reorder/open-next/copy works without an execution engine.
- Palette is fully keyboard usable and does not conflict with text entry.

### Dependencies

META-01, VAR-02, VER-02.

### Explicit non-goals

Global OS shortcut, extension, arbitrary graph, persisted workflow progress, or fuzzy/vector service.

### Completion evidence

Recorded relevance/latency report and E2E bundle/palette workflows.

### BUNDLE-01 — Add bundle repository integrity

- **Status:** DONE
- **Dependencies:** MIG-02
- **Objective:** CRUD and reorder bundles; clean membership atomically on prompt delete.
- **Files likely affected:** new `bundleRepository.ts`, `promptRepository.ts`, tests.
- **Acceptance criteria:** ordered unique existing IDs only; reorder is atomic; prompt deletion removes memberships without deleting bundles.
- **Verification:** focused repository tests with golden fixture.
- **Non-goals:** UI or progress engine.

### BUNDLE-02 — Add sequential bundle UI

- **Status:** DONE
- **Dependencies:** BUNDLE-01, VAR-02
- **Objective:** Create/edit/reorder bundle and open/copy/fill current or next asset.
- **Files likely affected:** new bundle components, sidebar/navigation state, prompt detail, E2E test.
- **Acceptance criteria:** keyboard reorder alternative exists; next item is derived correctly; empty/missing membership state is clear.
- **Verification:** component/E2E bundle flow.
- **Non-goals:** execution, timers, conditional steps, persisted completion.
- **Completion evidence:** Bundle component tests pass; focused and full Playwright bundle workflows pass; full unit suite, lint, and production build pass.

### SEARCH-01 — Implement deterministic ranked search

- **Status:** DONE
- **Dependencies:** META-01, BUNDLE-01, TEST-02
- **Objective:** Index all V1 fields and return stable scores/match ranges.
- **Files likely affected:** replace `src/utils/search.ts` with service or equivalent, tests, `PromptList.tsx`.
- **Acceptance criteria:** priority order matches `ARCHITECTURE.md`; highlights are safe and accurate; 5,000-asset p95 target is met or measured exception documented.
- **Verification:** relevance tables and performance command/test using golden builders.
- **Non-goals:** embeddings, typo-heavy fuzzy engine, worker until measurements demand it.
- **Completion evidence:** Deterministic ranking/range tests, indexed-field coverage, PromptList/card integration tests, and 5,000-asset latency test pass; full unit/E2E suites, lint, and production build pass.

### DETAIL-01 — Add a read-first asset view

- **Status:** DONE
- **Dependencies:** VAR-02, VER-02, SEARCH-01
- **Objective:** Let users read long content, notes, variables, metadata, history, and bundle context without entering edit mode.
- **Files likely affected:** new prompt detail component, card/list actions, app state, tests.
- **Acceptance criteria:** full content and headings are readable; copy/fill/edit/history actions are explicit; no nested interactive controls inside a button role.
- **Verification:** accessibility component tests and E2E open/use/edit flow.
- **Non-goals:** Markdown WYSIWYG or section reorder.

### PALETTE-01 — Add in-app command palette

- **Status:** DONE
- **Dependencies:** SEARCH-01, DETAIL-01, COPY-01, VAR-02
- **Objective:** `Ctrl/Cmd+Shift+P` searches and invokes Open, Copy, or Fill Variables.
- **Files likely affected:** new palette component/hook, App shell/state, keyboard tests.
- **Acceptance criteria:** open/search/navigate/action/close uses keyboard only; focus restores; same search results/actions as main UI.
- **Verification:** component keyboard tests and E2E palette flow.
- **Non-goals:** OS-global registration or direct insertion into third-party pages.

### KEY-01 — Complete and document keyboard behavior

- **Status:** DONE
- **Dependencies:** PALETTE-01, DETAIL-01, BUNDLE-02
- **Objective:** Unify new, save, search/palette, copy, favorite, edit, duplicate, close, and result navigation shortcuts with visible help.
- **Files likely affected:** `useKeyboardShortcuts.ts`, shortcut help component, relevant E2E tests.
- **Acceptance criteria:** shortcuts ignore incompatible editable contexts; browser/OS conflicts are documented; all actions have non-shortcut equivalents.
- **Verification:** keyboard matrix tests and manual Windows/browser check.
- **Non-goals:** configurable shortcuts in V1.

## Phase 6 — Canonical recovery and release gate

### Objective

Export/restore every V1 entity, close accessibility/performance gaps, and prove daily-use safety.

### Why now

The schema and workflows are stable enough to freeze the v2 portable contract and release documentation.

### Exact scope

Backup v2, staged restore, migration from v1 backup, backup reminders, full E2E/accessibility/performance pass, concise docs.

### Files likely affected

Import/export/backup service and UI, all fixture tests, accessibility hot spots, `README.md`, `docs/*` or this plan's promoted final docs.

### Required behavior

All entities round-trip; no partial destructive import; clean install/migration/restart/recovery passes; no critical console errors.

### Tests

Golden v1->v2 and v2 round-trip, corruption matrix, commit failure, browser download/upload, axe/manual keyboard checks, scale timings.

### Acceptance criteria

- Every item in `V1_GATE.md` is evidenced.
- Recovery is tested from an exported file, not only in-memory payloads.
- README and backup/recovery docs match shipped behavior.

### Dependencies

All V1 feature tasks.

### Explicit non-goals

Merge import, auto directory backup, extension, global launcher, blocks/relations/composer, AI.

### Completion evidence

Completed gate checklist with command versions, fixture hashes/counts, E2E artifacts, and manual recovery record.

### BACKUP-03 — Freeze canonical v2 export

- **Status:** DONE
- **Dependencies:** VER-01, BUNDLE-01, META-01
- **Objective:** Export all V1 entities with manifest counts and checksum while retaining v1 import support.
- **Files likely affected:** backup/import-export service, types, v1/v2 fixtures and tests.
- **Acceptance criteria:** v2 round-trip preserves all fields/versions/order; deterministic checksum detects alteration; future versions are rejected clearly.
- **Verification:** golden fixture round-trip and corruption tests.
- **Non-goals:** ZIP/attachments or encryption.

### BACKUP-04 — Implement staged replace restore

- **Status:** DONE
- **Dependencies:** BACKUP-03, BACKUP-02
- **Objective:** Parse/migrate/validate/preview/pre-backup/commit/re-read-verify before reporting restore success.
- **Files likely affected:** backup service, `ImportExportPanel.tsx`, restore dialog, tests.
- **Acceptance criteria:** no invalid input mutates active data; commit failure rolls back; summary and explicit backup acknowledgement precede replacement; post-commit mismatch is a blocking recovery error.
- **Verification:** adversarial unit/integration tests and file-based E2E restore.
- **Non-goals:** merge collision rules.

### A11Y-01 — Complete accessibility and mobile audit

- **Status:** DONE
- **Dependencies:** DETAIL-01, PALETTE-01, BUNDLE-02, UX-03
- **Objective:** Fix semantic/focus/label/contrast issues across final V1 workflows.
- **Files likely affected:** final UI components and accessibility tests.
- **Acceptance criteria:** dialogs/drawer trap and restore focus; cards contain no nested interactive button semantics; automated scan has no serious/critical findings and manual keyboard path completes at 375px and desktop.
- **Verification:** accessibility suite plus documented manual matrix.
- **Non-goals:** WCAG certification claim.
- **Completion evidence:** `Dialog.test.tsx`, `MobileSidebar.test.tsx`, and `PromptCard.test.tsx` cover focus containment/restoration and non-nested card semantics. `tests/e2e/accessibility.spec.ts` covers the desktop 1280×800 dialog keyboard path and the 375×800 skip-link/mobile-drawer path, including Tab wrapping and Escape restoration; the structural audit reports no unlabeled controls, unnamed dialogs, or nested interactive button semantics. Full unit tests (176/176), lint, production build, and Playwright E2E (14/14) pass.

### PERF-01 — Record realistic performance envelope

- **Status:** DONE
- **Dependencies:** SEARCH-01, BACKUP-03, TEST-02
- **Objective:** Measure load/search/save/version/export at 100/1,000/5,000 assets and long content.
- **Files likely affected:** benchmark scripts/tests and results document; product files only if measurements fail targets.
- **Acceptance criteria:** repeatable environment/commands; p50/p95 recorded; no unmeasured optimization, and any failed target creates a bounded follow-up.
- **Verification:** benchmark command recorded in release evidence.
- **Non-goals:** synthetic micro-optimization or worker by default.

- **Completion evidence:** `npm run perf` records p50/p95 timings for load, search-index construction, ranked search, canonical export, non-versioned save, and versioned save at 100, 1,000, and 5,000 deterministic fixture assets. On 2026-09-11 (Node v22.19.0, Windows x64), the largest search p95 was 15.768 ms against the 100 ms target; no bounded optimization follow-up is required. Full results and methodology are in `plan/completion/PERFORMANCE.md`.

### DOC-01 — Publish concise authoritative docs

- **Status:** DONE
- **Dependencies:** BACKUP-04, A11Y-01, PERF-01, KEY-01
- **Objective:** Replace stale claims with current product, architecture, model, recovery, development, and roadmap guidance.
- **Files likely affected:** `README.md`, `docs/PRODUCT.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `BACKUP_AND_RECOVERY.md`, `DEVELOPMENT.md`, `ROADMAP.md`, `CURRENT_STATE.md`; archive this plan rather than duplicate it.
- **Acceptance criteria:** commands/paths match repository; recovery is executable by a new user; historical `Design.md` is clearly archived or removed after owner review.
- **Verification:** link/command audit; clean-install instructions exercised.
- **Non-goals:** documentation bureaucracy or duplicate plan systems.
- **Completion evidence:** Added `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/BACKUP_AND_RECOVERY.md`, `docs/DEVELOPMENT.md`, `docs/CURRENT_STATE.md`, and `docs/ROADMAP.md`; updated `README.md` and marked `Design.md` historical. The relative-link audit passes, the documented test/build/browser/performance commands pass, and the production preview was checked at desktop and 375 px widths. `npm ci --include=dev` completes from the lockfile; the earlier environment-level Windows file-lock issue was resolved by stopping only the workspace preview process.

### RELEASE-01 — Prove Personal V1 and daily-use gates

- **Status:** BLOCKED
- **Dependencies:** all non-deferred tasks
- **Objective:** Execute `V1_GATE.md`, record failures, and release only when every mandatory item passes.
- **Files likely affected:** gate/evidence documents and only bounded bug fixes discovered by verification.
- **Acceptance criteria:** clean install, v1 migration, restart, backup/restore, keyboard, E2E, lint/test/build all pass; zero known critical/high data-loss issue; no critical console/runtime failure.
- **Verification:** exact commands in `V1_GATE.md` plus file-based recovery drill.
- **Non-goals:** post-V1 features.

- **Current blocker:** The deterministic implementation and fixture checks pass, but three daily-use items require the owner’s real browser library: a current backup, a fresh-profile restore, and search responsiveness at real-library scale. Personal data was intentionally not accessed by this run.

## Deferred ledger

### REL-01 — Lightweight related assets

- **Status:** DEFERRED
- **Dependencies:** RELEASE-01 plus demonstrated bundle insufficiency
- **Objective:** Add simple relation records with limited kinds.
- **Files likely affected:** future types/store/repository/detail UI/tests.
- **Acceptance criteria:** symmetric/typed integrity and deletion cleanup; real use case approved; backup contract versioned.
- **Verification:** repository/UI tests.
- **Non-goals:** graph traversal engine.

### BLOCK-01 — Snapshot reusable blocks

- **Status:** DEFERRED
- **Dependencies:** RELEASE-01
- **Objective:** Insert reusable content as an explicit snapshot first.
- **Files likely affected:** future block model/service/composer/tests.
- **Acceptance criteria:** insertion records provenance/version and never changes when source changes.
- **Verification:** composition tests.
- **Non-goals:** live references.

### BLOCK-02 — Live block references

- **Status:** DEFERRED
- **Dependencies:** BLOCK-01 and validated demand
- **Objective:** Resolve live blocks safely.
- **Files likely affected:** block resolver/repository/preview/tests.
- **Acceptance criteria:** cycle detection, depth bound, missing-reference error, deterministic preview; master content never silently rewrites.
- **Verification:** adversarial graph tests.
- **Non-goals:** recursive macros or programming language.

### COMPOSE-01 — Ordered composer

- **Status:** DEFERRED
- **Dependencies:** BLOCK-01
- **Objective:** Select/order blocks plus custom text, preview, and copy.
- **Files likely affected:** future composer UI/service/tests.
- **Acceptance criteria:** output order is explicit; no execution; snapshot/live behavior is labeled.
- **Verification:** component/E2E tests.
- **Non-goals:** visual programming.

### SECTION-01 — Markdown outline and copy section

- **Status:** DEFERRED
- **Dependencies:** RELEASE-01
- **Objective:** Derive a read-only heading outline with jump/copy.
- **Files likely affected:** Markdown outline service/detail UI/tests.
- **Acceptance criteria:** ATX headings/Unicode handled; source stays byte-identical.
- **Verification:** parser/UI tests.
- **Non-goals:** section reorder/collapse persistence.

### AUTOBACKUP-01 — User-selected backup directory

- **Status:** DEFERRED
- **Dependencies:** BACKUP-04 and capability/security review
- **Objective:** Timestamp verified backups through File System Access where available.
- **Files likely affected:** backup adapter/settings/UI/tests.
- **Acceptance criteria:** explicit permission, clear unsupported state, retention policy, failed write never updates success status.
- **Verification:** supported-browser integration tests.
- **Non-goals:** cloud sync.

### GLOBAL-01 — Global insertion architecture prototype

- **Status:** DEFERRED
- **Dependencies:** RELEASE-01 and user choice of browser extension versus desktop wrapper
- **Objective:** Validate one secure local-data bridge and global invocation route.
- **Files likely affected:** separate future package; base app read API/bridge only if selected.
- **Acceptance criteria:** threat model, browser/OS scope, stale-data behavior, uninstall/recovery documented before build commitment.
- **Verification:** bounded prototype.
- **Non-goals:** simultaneous extension and desktop products.

## Checkpoints

- **After Phase 0:** full lint/test/build and core E2E pass; no known current workflow regression.
- **After Phase 1:** export a fixture to disk, restore in a fresh isolated profile, inject migration failure, and verify original data remains.
- **After Phase 2:** golden v1->v2 manifest matches IDs/content/counts and v1 reader still passes.
- **After Phase 3:** fill/copy/reload proves template master unchanged.
- **After Phase 4:** edit/compare/restore/reverse-restore passes with transaction failure injection.
- **After Phase 5:** bundle/palette E2E and 5,000-asset search target pass.
- **After Phase 6:** both release gates in `V1_GATE.md` pass and evidence is attached before any `DONE` claim.
