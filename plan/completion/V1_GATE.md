# Personal V1 and daily-use gates

Every mandatory item requires a link or recorded artifact: command output, deterministic fixture manifest, E2E result, or manual check with browser/version. “Tests pass” alone is insufficient.

## Prompt Library Personal V1 Complete

### Installation and baseline

- [x] Clean `npm ci --include=dev` from the lockfile succeeds on Node v22.19.0.
- [x] `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build` pass.
- [x] Production preview opens without critical console/page errors at desktop and 375 px width.

### Preserve and migrate

- [x] Golden v1 library migrates with identical existing prompt IDs, title/content bytes, descriptions, folder/tag membership, favorites, usage counts, and timestamps.
- [x] Migration is idempotent and survives an injected mid-migration failure without record loss or empty-library presentation.
- [x] A verified pre-migration v1 backup can restore into a clean supported app.

### Core library

- [x] Create, read full content, edit, duplicate, move, favorite, tag, and delete work with truthful success/error states.
- [x] Folder/tag uniqueness and system-folder protection are enforced in repositories and imports.
- [x] Delete preference is honored; failed destructive writes leave records intact.
- [x] One copy action writes once, increments once after clipboard success, preserves exact content, and does not change `updatedAt`.

### Find and organize

- [x] Search indexes title, tags, type, target tools, description, notes, folder, bundle name, and content with documented deterministic ranking/highlights.
- [x] Search p95 is under 100 ms at 5,000 golden assets on the recorded baseline.
- [x] Favorites, Recent, Most Used, folders, tags, type, and target-tool filters return correct contextual empty states.
- [x] Bundle create/edit/reorder/open/copy/fill/open-next works; prompt deletion cannot leave invalid membership.

### Variables

- [x] Exact `{{NAME}}` detection handles repeats, malformed input, Unicode surrounding text, and multiline values deterministically.
- [x] Missing values/default precedence are visible and tested.
- [x] Fill, preview, and copy rendered output never mutate the stored master; reload proves byte equality.
- [x] Remembered values are opt-in, clearable, and documented as unencrypted local data.

### History and recovery

- [x] Meaningful authored edits atomically preserve the prior snapshot; identical and organizational changes do not create noise.
- [x] Version list, compare, copy, duplicate, restore, and reverse-restore pass repository and E2E tests.
- [x] No automatic version pruning occurs; local-storage retention warning is visible.

### Portability

- [x] Canonical v2 JSON preserves prompts, folders, tags, settings, versions, bundles, defaults, metadata, order, and usage fields.
- [x] Current v1 backup remains importable through tested migration; unsupported future versions are rejected.
- [x] Corrupt type/date/counter/ID/name/reference/checksum cases mutate nothing.
- [x] Replace restore shows a summary, requires/records pre-restore backup acknowledgement, commits atomically, re-reads, and verifies before success.
- [x] Export-to-file then restore-from-file succeeds in a fresh isolated profile; in-memory-only round-trip is not sufficient.

### Keyboard and accessibility

- [x] `/` search and `Ctrl/Cmd+Shift+P` palette work without stealing input focus.
- [x] New/save/copy/favorite/edit/duplicate/close/result navigation and variable filling have consistent keyboard paths and visible help.
- [x] Dialogs and mobile drawer trap/restore focus; Escape behavior is correct; no nested interactive controls use button semantics.
- [x] Automated audit has no serious/critical findings and the maintained keyboard-only browser workflow passes at desktop and mobile width.

### Documentation

- [x] README commands/versions are current.
- [x] Product, architecture, data model, backup/recovery, development, current state, and roadmap docs are concise, non-duplicative, and match code.
- [x] Historical `Design.md`, `.kilo`, generated trees, and source ZIP are clearly distinguished from product data/authority.

## Safe for Daily Personal Use

This is a separate release gate and all items are mandatory:

- [x] No open Critical/High data-loss, corruption, migration, or restore defect is known from the completed fixture/browser audit.
- [x] Startup/storage errors block unsafe use and provide retry/recovery instructions.
- [ ] A real-library backup less than the 30-day reminder age exists and has passed structural/checksum verification; owner action is required.
- [x] Fixture recovery drills restored v1 and v2 files into fresh profiles and matched the tested manifest/content invariants.
- [ ] The owner can export the current real library and restore that file in a fresh isolated profile without logging or including personal data in test artifacts; owner action is required because personal browser data is out of scope.
- [x] Migration and restart have been exercised on deterministic copies with no duplicate versions or bundles.
- [ ] Search responsiveness at or above the real library size is unknown until the owner runs the fixture-independent check.
- [x] No critical console/runtime error occurs in the covered create/edit/search/copy/version/restore/bundle workflows.
- [x] Production build and all automated suites pass from a clean install.
- [x] Backup and recovery instructions can be followed without reading source code.

## Verification record — 2026-09-11

- `npm ci --include=dev` completed successfully from the lockfile.
- `npm run lint`: PASS.
- `npm run test`: PASS — 36 files, 176 tests.
- `npm run test:e2e`: PASS — 14 browser tests, including fresh-profile v1 and v2 file restores.
- `npm run perf`: PASS — recorded 5,000-asset search p95 is 15.768 ms, below the 100 ms target.
- Latest rerun after a fresh `npm ci --include=dev`: lint, 176 unit tests, 14 E2E tests, performance, build, and production preview all passed; the 5,000-asset search p95 was 14.859 ms.
- `npm run build`: PASS — production bundle generated successfully.
- Production preview: PASS at 1280 px and 375 px; no console or page errors observed.
- Markdown relative-link audit: PASS for `README.md`, `docs/`, and `plan/completion/`.
- `npm audit --omit=dev`: PASS — no production dependency advisories. The full audit retains two moderate Vitest/@vitest/mocker advisories; the available fix is a Vitest 5 major upgrade and is deferred pending compatibility review.
- The three unchecked daily-use items remain owner actions because this run does not access personal browser data: current backup age/verification, fresh-profile restore from that export, and search responsiveness at real-library scale.

## Required verification commands

```bash
npm ci --include=dev
npm run lint
npm run test
npm run test:e2e
npm run perf
npm run build
npm run preview
```

`npm run test` intentionally excludes the browser and performance suites. `npm run preview` must be checked in a browser at desktop and 375 px widths; it serves the production output created by `npm run build`. The performance method and recovery drill evidence are recorded in `plan/completion/PERFORMANCE.md` and the backup/recovery documentation.
