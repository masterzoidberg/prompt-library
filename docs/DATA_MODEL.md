# Data model

## Storage

The database name is `prompt-library` and the current IndexedDB structure version is `2`. The database is opened by `src/data/db.ts`; application startup seeds the `unfiled` folder and the default settings record if they are missing.

Stores:

| Store | Key | Important indexes |
| --- | --- | --- |
| `prompts` | `id` | `by-folder`, `by-updatedAt`, `by-createdAt` |
| `folders` | `id` | unique `by-normalizedName` |
| `tags` | `id` | unique `by-normalizedName` |
| `settings` | explicit keys | application settings and migration journal |
| `promptVersions` | `id` | `by-promptId`, unique `by-prompt-sequence` |
| `bundles` | `id` | `by-updatedAt` |

## Prompt

A prompt retains the original authored content exactly. Its persisted fields are:

```text
id, title, content, description?, folderId, tagIds[], isFavorite,
copyCount, createdAt, updatedAt, lastCopiedAt,
type, targetTools[], notes?, variableDefaults{}
```

`type` is one of `prompt`, `instruction`, `coding-task`, `rubric`, `research-procedure`, `output-schema`, `checklist`, or `template`. `targetTools` uses the supported generic, ChatGPT, Codex, Claude, Claude Code, Gemini, Kilo, or API values. Usage is aggregate: copying increments `copyCount` and sets `lastCopiedAt`; it does not change `updatedAt`.

Variables are derived from `content` using the exact `{{NAME}}` grammar, where `NAME` matches `[A-Z][A-Z0-9_]*`. Defaults are stored on the prompt. There is no separate variable entity, and filling is never persisted as content.

## Supporting records

- A `Folder` has `id`, display `name`, normalized name, and timestamps. `unfiled` / `Unfiled` is reserved.
- A `Tag` has `id`, display `name`, normalized name, and timestamps.
- `Settings` stores theme, default sort, view mode, delete confirmation, optional remembered variable values, and the optional `lastBackupPreparedAt` timestamp used for the 30-day reminder. Remembered values are plain local data and can be cleared from Settings.
- A `PromptVersion` stores a prompt ID, positive sequence, timestamp, reason (`edit` or `restore`), and an authored-field snapshot. Folder, tag, favorite, usage, and bundle changes do not create versions. The history view reports estimated version bytes and the browser quota estimate when available; it never prunes versions automatically.
- A `Bundle` stores a name, optional description, timestamps, and an ordered unique `promptIds` array. Bundles are organizational; they do not persist execution progress.

## Migration and compatibility

The current migration runner reads existing v1 prompt records, preserves their IDs/content and existing fields, and adds deterministic v2 defaults (`type: prompt`, empty target tools, empty variable defaults, and absent optional fields). It records a migration journal and verifies counts and a content hash. See [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) for portable backup compatibility.
