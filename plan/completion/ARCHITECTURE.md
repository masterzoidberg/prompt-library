# Target architecture and data model

## Keep / simplify / merge / freeze / remove

| Subsystem | Decision | Reason | Consequence |
| --- | --- | --- | --- |
| React + Vite SPA | KEEP | Appropriate for a small local tool; build is healthy. | No router/backend/framework migration. |
| IndexedDB via `idb` | KEEP | Existing transactional layer works and scales to the target library. | Invest in migration/backup rather than replacement. |
| Feature repositories | KEEP | Clear persistence ownership and good unit-test seam. | Repositories remain the only DB callers. |
| `LibraryDataProvider` + per-entity hooks | SIMPLIFY | Shared records are coherent, but every mutation reloads every store. | Retain for V1; add targeted updates only if measured at 5,000 assets. |
| Repeated `useSettings` state | MERGE | Four unsynchronized instances cause visible bugs. | Add one SettingsProvider/context. |
| `AppStateProvider` | SIMPLIFY | Dialog/view ownership is useful; unreachable multi-tag state is not. | Remove placeholder state, then add explicit search filters when implemented. |
| `DialogRouter` | SIMPLIFY | Central routing is useful, but one 274-line switch owns unrelated forms/errors. | Keep router; move each existing name/delete workflow only when touched, not as a standalone refactor. |
| Prompt cards as primary view | KEEP + FIX | Fast for copy-first use. | Add a read/detail path; use semantic article with separate actions, not nested buttons. |
| Literal search utility | REPLACE IN PLACE | Simple but unranked and insufficient for 5,000 assets. | One deterministic in-memory search service; no vector DB. |
| JSON envelope v1 | FREEZE | It is the only recoverable representation of current data. | Keep an immutable v1 reader/fixture; export only latest canonical version. |
| `log.ts` | REMOVE | No production caller. | Reintroduce logging only with a concrete recovery/diagnostic need. |
| `movePromptsToFolder` | REMOVE/FREEZE | Unused bulk path has no product workflow. | Add back with tests only if bulk actions enter scope. |
| `.kilo/` | FREEZE OUTSIDE PRODUCT | Local agent tooling, not runtime architecture. | Exclude from product audits/builds; do not delete without owner decision. |
| `prompt-library.zip` | FREEZE OUTSIDE PRODUCT | Full source/dependency snapshot, not library backup. | Do not migrate/import it; owner decides retention. |
| Popover/tooltip dependencies | REMOVE IF STILL UNUSED | No imports in source. | Confirm with dependency scan, then remove in a baseline cleanup task. |

## V1 domain decision

Keep the persisted/public entity name `Prompt` for Personal V1. A repository-wide rename to `InstructionAsset` would touch most files and backup contracts without delivering user value. Add `type` so a prompt record can represent a broader instruction asset. UI may say “asset” in filters/details while retaining the product name Prompt Library.

### V1-required entities

```ts
type AssetType =
  | 'prompt'
  | 'instruction'
  | 'coding-task'
  | 'rubric'
  | 'research-procedure'
  | 'output-schema'
  | 'checklist'
  | 'template';

type TargetTool =
  | 'generic'
  | 'chatgpt'
  | 'codex'
  | 'claude'
  | 'claude-code'
  | 'gemini'
  | 'kilo'
  | 'api';

interface Prompt {
  // existing v1 fields remain unchanged
  id: string;
  title: string;
  content: string;
  description?: string;
  folderId: string;
  tagIds: string[];
  isFavorite: boolean;
  copyCount: number;
  createdAt: string;
  updatedAt: string;
  lastCopiedAt: string | null;

  // additive Personal V1 fields
  type: AssetType;                 // migrated default: 'prompt'
  targetTools: TargetTool[];       // migrated default: []
  notes?: string;
  variableDefaults: Record<string, string>; // migrated default: {}
}

interface PromptVersion {
  id: string;
  promptId: string;
  sequence: number;
  createdAt: string;
  reason: 'edit' | 'restore';
  snapshot: {
    title: string;
    content: string;
    description?: string;
    type: AssetType;
    targetTools: TargetTool[];
    notes?: string;
    variableDefaults: Record<string, string>;
  };
}

interface Bundle {
  id: string;
  name: string;
  description?: string;
  promptIds: string[];             // authoritative order; unique IDs
  createdAt: string;
  updatedAt: string;
}
```

Folder, Tag, and Settings remain. Settings gains only fields actually used by V1, such as a backup-reminder timestamp and optional remembered variable values. Remembered values must be opt-in and visibly clearable; secrets must not be treated specially or promised secure storage.

Variables are detected from content with the exact grammar `{{NAME}}`, where `NAME` matches `[A-Z][A-Z0-9_]*`. Detection is derived, not persisted. Substitution is literal, one pass, and non-recursive. Unknown/unfilled tokens remain visible and block “copy rendered” unless the user explicitly chooses copy-with-placeholders. Filling never writes prompt content. Multiline values are allowed. Defaults live on the prompt; commonly remembered values are a settings convenience, not part of the template language.

Version creation rule: before an update that changes any snapshot field, atomically write the prior snapshot and the updated prompt. Folder, tag, favorite, usage, and bundle membership changes do not create versions. Identical saves do not create versions. Restore first snapshots the current state with reason `restore`, then applies the chosen old snapshot, so restore is itself reversible. V1 has no automatic pruning; display storage use and defer user-controlled pruning until evidence requires it.

Bundles are organizational only. Opening/copying a member delegates to the existing prompt workflow. Removing a prompt removes its ID from bundles in the same transaction. No execution state is persisted in V1; “next” is derived from the open member and ordered list.

### Post-V1 entities

- `AssetRelation` for companion/variant/predecessor links, only if bundles and tags cannot cover real cases.
- `ReusableBlock` plus explicit live-reference edges. Snapshot insertion can initially duplicate text without an entity.
- Optional backup manifest/file metadata if attachments are introduced.

Do not add separate entities for variables, target tools, sections, usage events, or workflow progress in V1. Current aggregate usage fields are enough.

## Target dependency map

```text
React views/components
  -> application hooks/actions
     -> pure services
        templateService   detect + validate + render
        searchService     index + score + match metadata
        diffService       readable line/word diff adapter
        backupService     serialize + validate + preview
     -> repositories
        promptRepository  CRUD + atomic version creation
        versionRepository history/read/restore
        bundleRepository  ordered membership + cleanup
        folder/tag/settings repositories
     -> migration runner
        immutable v1 reader -> additive v2 stores/defaults -> verification
     -> IndexedDB
        prompts | folders | tags | settings | promptVersions | bundles
```

UI ownership:

- `LibraryDataProvider` owns loaded prompts/folders/tags/bundles and explicit load errors.
- New `SettingsProvider` is the single in-memory settings owner.
- `AppStateProvider` owns only transient navigation/dialog/palette state.
- Repositories own integrity and transaction boundaries.
- Pure services never access IndexedDB or React.
- Import reads into a detached validated snapshot; only the final commit touches active stores.

## Persistence and migration design

Use a two-level version explicitly:

- IndexedDB `DB_VERSION` controls store/index structure.
- Backup `formatVersion` controls portable JSON shape.
- Do not use `Settings.schemaVersion` as a competing authority; remove it or make it informational after migration.

Migration from current v1 must be additive:

1. Ship and verify the immutable v1 exporter/validator before any DB version bump.
2. Offer and strongly gate on a verified v1 backup before upgrade.
3. IndexedDB upgrade creates `promptVersions` and `bundles`; it does not delete/clear old stores.
4. Application migration reads each prompt and adds default metadata in one guarded transaction, preserving IDs and all existing fields.
5. Verify record counts, IDs, folder/tag references, and a deterministic content hash before marking migration complete.
6. On failure, abort the write transaction, retain the v1 backup, show a blocking recovery screen, and never present an empty library as success.
7. Re-running is safe: a migration journal/check uses explicit from/to versions and completed state.

Rollback means restoring the verified v1 backup through the supported recovery path or repairing forward; an older build may be unable to open a newer IndexedDB version, so “downgrade the binary” is not a valid recovery promise.

## Canonical backup format

Use readable JSON, latest export version 2:

```text
{
  format: "prompt-library-backup",
  formatVersion: 2,
  appVersion: string,
  exportedAt: ISO timestamp,
  data: {
    prompts, folders, tags, settings, promptVersions, bundles
  },
  summary: { counts },
  checksum: deterministic SHA-256 of canonicalized data
}
```

Keep a tested v1 importer forever unless an explicit support policy supersedes it. Reject future versions. Validate types, enums, ISO dates, finite non-negative integer counters, unique IDs/normalized names, reserved system folder invariants, references, bundle membership uniqueness, version sequence uniqueness, and checksum before mutation.

V1 import mode is safe Replace only: parse -> migrate in memory -> validate -> show summary/conflicts -> create a verified export of current library -> one transaction replace -> re-read and verify -> report success. If the browser cannot guarantee the pre-restore file was saved, require an explicit user acknowledgement. Merge is post-V1 because collision semantics add substantial risk and are not required for recovery.

Browser-only automatic backup cannot be guaranteed without user-granted File System Access permission and is not portable across all browsers. Personal V1 provides verified manual backup, reminders, and clear last-backup status. User-selected directory backups are post-V1 progressive enhancement.

## Search and performance

Keep search in memory through 5,000 assets. Build a normalized document once per library change. Deterministic score order:

1. exact/prefix title,
2. title token,
3. tag/type/target tool,
4. description/notes/folder/bundle name,
5. content substring/token.

Return score plus match ranges for highlighting and stable tie-break by updated time/title/ID. Add modest token-prefix tolerance only if measurements show value; do not add a fuzzy-search dependency or vector database by default. Target p95 search response under 100 ms at 5,000 representative assets on the supported baseline device.

## Diff choice

Use a small, established text-diff package behind `diffService` if its license, bundle cost, and maintenance status pass review at `VER-02`. A home-grown line diff is a worse fit because correctness and readable edge cases are not product differentiation. Render line-level changes with optional word emphasis; do not implement Git semantics.
