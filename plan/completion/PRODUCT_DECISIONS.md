# Product decisions

## Personal V1 boundary

Personal V1 is the smallest release that can be trusted as a daily control center for reusable AI instructions:

- Correct current CRUD, folder, tag, favorite, copy, sort, settings, responsive, and keyboard workflows.
- Explicit load/error recovery; no empty-library façade after persistence failure.
- Canonical, validated backup and staged replace restore with pre-restore backup.
- Guarded migration from every existing v1 prompt with no ID/content loss.
- One prompt entity with a lightweight type, target-tool metadata, notes, and deterministic variables/defaults.
- Reversible version history with readable diff, restore, duplicate, and copy-old-version.
- Ordered bundles with open/copy/next/reorder.
- Deterministic ranked search and an in-app command palette.
- Golden fixture, scale measurements, repository/service/UI/keyboard/E2E tests, and concise recovery docs.

Arbitrary related-asset graphs are not required because ordered bundles, tags, and shared folders cover the immediate organizational need. Merge import is not required because trustworthy replace/restore is the recovery primitive. Automatic directory backup is not required because browser permissions/platform support are conditional.

## Feature priority

| Feature | Workflow value | Cost | Model complexity | Maintenance | Decision |
| --- | --- | --- | --- | --- | --- |
| Current workflow fixes | Very high | Low | Low | Low | V1 first |
| Verified backup/restore | Critical | Medium | Medium | Low | V1 first |
| Migration harness | Critical | Medium | Medium | Medium | V1 before schema change |
| Variables/templates | Very high | Medium | Low | Low | V1 |
| Version/diff/restore | Very high | Medium | Medium | Medium | V1 |
| Bundles | High | Medium | Medium | Low | V1 |
| Ranked search | Very high | Medium | Low | Low | V1 |
| In-app command palette | High | Medium | Low | Low | V1 after search |
| Asset types/target tools | Medium-high | Low | Low | Low | V1 |
| Notes | Medium | Low | Low | Low | V1; searchable |
| Related-asset graph | Medium | Medium | Medium | Medium | Post-V1 |
| Snapshot reusable blocks | Medium-high | Medium | Medium | Medium | Post-V1 before live blocks |
| Live reusable blocks | High in some workflows | High | High | High | Post-V1 only after real use cases |
| Composer | Medium-high | Medium-high | Medium | Medium | Post-V1 |
| Markdown outline/jump | Medium | Low-medium | Low | Low | Post-V1 candidate |
| Section reorder | Medium | High | High | High | Deferred; unsafe Markdown transforms |
| Global launcher | High | High | High | High | Post-V1 desktop/extension decision |
| Browser extension | High | High | High | High | Post-V1; never blocks base app |
| Automatic backup folder | High | Medium-high | Medium | Medium | Post-V1 progressive enhancement |
| AI utilities | Low-medium | High | Medium | High | Deferred and optional |

## Specific decisions

1. Keep the product name Prompt Library and the `Prompt` persistence name in V1. Add a type field instead of a sweeping `InstructionAsset` rename.
2. Use eight broad asset types. Provider identity belongs in `targetTools`, not in more types.
3. Variables use only uppercase `{{NAME}}` placeholders, literal one-pass substitution, optional per-prompt defaults, and opt-in remembered values. No expressions, conditions, loops, nesting, or recursive evaluation.
4. Preserve all meaningful authored-state changes. Never auto-prune versions in V1.
5. Bundles are ordered collections, not executable workflows. Do not persist progress in V1.
6. Satisfy V1 relationship needs through bundles. Add arbitrary relationships only from demonstrated cases.
7. Defer reusable blocks. When introduced, ship snapshot insertion first. Live references require cycle detection, depth limits, missing-reference handling, and explicit preview; no recursive macros.
8. Markdown remains the document format. A read-only heading outline is safe post-V1; section reorder is deferred.
9. Search remains deterministic and local. No embeddings, vector store, or model calls.
10. The command palette is application-level (`Ctrl/Cmd+Shift+P`) and uses the same search service. True OS-global invocation needs a desktop wrapper/background process or extension and is post-V1.
11. V1 import supports Replace only. Merge waits for explicit collision requirements.
12. V1 backup is user-initiated and verified, with reminders. Directory automation is capability-detected later.
13. Usage remains aggregate (`copyCount`, `lastCopiedAt`). Do not add an event analytics table.

## Post-V1 sequence

1. Snapshot reusable blocks and ordered composer.
2. Read-only Markdown outline, jump, and copy-section.
3. Lightweight relations only if bundles prove insufficient.
4. User-selected automatic backup folder where supported.
5. Choose either browser extension or desktop wrapper for global insertion after a security/access prototype; do not build both initially.
6. Optional, bounded AI suggestions only after local-only workflows are complete and each call is opt-in.

## Explicit non-goals

Accounts, auth, billing, subscriptions, teams, collaboration, public sharing, marketplace, cloud backend, enterprise permissions/governance, prompt execution, built-in chat/model client, LLMOps/evaluation infrastructure, autonomous rewriting, telemetry, nested folders, rich-text storage, programmable templates, workflow execution, and mandatory AI/network access.
