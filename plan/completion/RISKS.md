# Risks and mitigations

| ID | Risk | Likelihood / impact | Evidence or trigger | Mitigation | Owner task |
| --- | --- | --- | --- | --- | --- |
| RISK-001 | Existing browser data is lost during schema evolution. | Medium / Critical | No real migration runner; new V1 needs stores/fields. | Freeze v1 reader, verified backup first, additive upgrade, abortable transform, manifest verification. | BACKUP-01, MIG-01, MIG-02 |
| RISK-002 | Persistence failure looks like an empty library and invites overwrite/import. | Medium / Critical | Startup and reload catches suppress errors. | Blocking recovery state; never set loaded-success on failure; retry and export guidance. | START-01 |
| RISK-003 | Restore validates incompletely or accepts an unsupported format. | High / Critical | Any numeric export version is accepted; invariants are partial. | Immutable version dispatch, strict validators, staged in-memory migration, pre-backup, post-commit verification. | BACKUP-01, BACKUP-04 |
| RISK-004 | “Backup complete” is false because browser download was canceled or blocked. | Medium / High | Current UI reports success after click initiation. | Truthful states; validate prepared bytes; E2E download; never claim filesystem durability the browser cannot observe. | BACKUP-02 |
| RISK-005 | Split state causes apparently saved preferences not to apply. | High / Medium | Reproduced sorting failure; four settings hook instances. | Single provider/context and integration regression tests. | STATE-01 |
| RISK-006 | Version history consumes excessive quota. | Low initially / High later | Long prompts plus unlimited snapshots. | Measure storage, show estimate/quota warnings, no silent pruning; add explicit pruning only from evidence. | VER-01, PERF-01 |
| RISK-007 | Version creation and prompt update diverge. | Medium / Critical | New cross-store invariant. | Same IndexedDB transaction, failure injection, no UI success before commit. | VER-01 |
| RISK-008 | Deleted assets leave invalid bundle/version references. | Medium / Medium | New relationships. | Repository-owned transactional cleanup; versions deliberately cascade/delete with prompt only after explicit policy test; bundles remove member IDs. | BUNDLE-01, VER-01 |
| RISK-009 | Search quality improves relevance but becomes slow at 5,000 long assets. | Medium / Medium | Current search scans raw strings each render. | Pre-normalized in-memory documents, deterministic benchmark, worker only if target fails. | SEARCH-01, PERF-01 |
| RISK-010 | Template syntax expands into an unsafe/opaque language. | Medium / High | Blocks/defaults can invite expressions and recursion. | Exact uppercase grammar, literal one-pass substitution, no expressions/recursion. | VAR-01 |
| RISK-011 | Remembered variable values expose sensitive material. | Medium / High | IndexedDB is local but not encrypted and profile-accessible. | Opt-in, visibly clearable, warning that values are plain local data; never auto-remember. | VAR-02 |
| RISK-012 | Diff dependency adds supply-chain/bundle burden. | Low / Medium | A library is recommended but not selected. | Review license/maintenance/size; isolate adapter; record bundle delta; fall back to minimal maintained alternative. | VER-02 |
| RISK-013 | Accessibility regresses as dialogs/palette/bundles grow. | Medium / High | Existing custom drawer and card semantics are already weak. | Shared accessible primitives, keyboard tests per slice, final automated/manual audit. | TEST-01, A11Y-01 |
| RISK-014 | Full reload after every mutation degrades at scale. | Medium / Medium | All feature hooks call `ctx.reload()` for all stores. | Measure first; change to targeted immutable context updates only if 5,000-asset timings fail. | PERF-01 |
| RISK-015 | Historical docs redirect implementation toward phantom files/non-goals. | High / Medium | `Design.md` paths/tooling are stale. | Treat this plan as authority; publish small final docs and archive historical spec. | DOC-01 |
| RISK-016 | Lack of Git metadata makes plan/product changes hard to audit or recover. | High / Medium | `.git` absent. | Owner establishes source control/backups outside product execution; sessions record exact changed files and verification. | External owner action; not product scope |
| RISK-017 | Source snapshot archive is mistaken for a user-library backup. | Medium / Medium | `prompt-library.zip` includes dependencies/source, not IndexedDB data. | Label/exclude it in docs; do not import/delete it automatically. | DOC-01 |
| RISK-018 | Browser extension/global launcher widens attack surface and blocks V1. | Medium / High | Needs privileged access and a data bridge. | Keep deferred; require threat model and choose one platform architecture after base release. | GLOBAL-01 |

## Risk acceptance rules

- Any known path that can silently lose or overwrite prompt content blocks Personal V1.
- Any migration count/hash mismatch blocks normal app startup until recovery action.
- UNKNOWN real-library shape is handled with validators and copied fixtures, never by testing against personal data.
- Performance exceptions require recorded measurements and a bounded follow-up; they are not grounds for speculative architecture.
