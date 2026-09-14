# Product

## Purpose

Prompt Library is a fast local control center for reusable AI instructions. It is designed for one person who wants reliable retrieval and copying without creating an account or sending library data to a service.

## Personal V1 capabilities

- Create, read, edit, duplicate, favorite, copy, move, and delete prompts.
- Organize prompts in flat folders and case-insensitive unique tags. `Unfiled` is a protected system folder.
- Classify prompts with an asset type, target tools, description, and private notes.
- Search title, content, description, notes, folder, tags, type, target tools, and bundle names with deterministic ranking and match highlighting.
- Fill exact uppercase variables such as `{{NAME}}` in a preview. Defaults and remembered values are optional; filling and rendered copying never modify the stored prompt.
- Preserve authored edits in version history, compare versions, copy or duplicate an old version, and reversibly restore it.
- Group prompts into ordered bundles and open, copy, fill, reorder, or advance through their members.
- Use the dedicated Recent view (updated-first) or Most Used view (copied prompts ordered by usage).
- Use theme, sort, delete-confirmation, responsive mobile navigation, dialogs, and keyboard workflows.
- Export a verified JSON backup and stage a validated replace restore with a pre-restore backup acknowledgement.
- See a 30-day backup reminder based on the last verified backup preparation; the app never claims that a browser download was durably saved.

## Local-data boundary

The library is stored in the current browser profile’s IndexedDB. Data is not encrypted by the app, synchronized, uploaded, or logged. Clearing site data or changing browser profiles can remove access to the library, so keep a recent export outside the browser.

The app does not provide accounts, collaboration, cloud sync, prompt execution, a built-in model client, AI rewriting, programmable template expressions, nested folders, or merge import.

## Keyboard essentials

- `/` focuses the main search field when focus is not in an editor.
- `Ctrl/Cmd+N` opens a new prompt.
- `Ctrl/Cmd+Shift+P` opens the command palette.
- On a focused prompt card: `Enter` opens it, `C` copies, `F` toggles favorite, `E` edits, and `D` duplicates.
- `Ctrl/Cmd+Enter` saves a prompt form; `Escape` closes the active overlay.

The in-app keyboard-help dialog is the source for the visible shortcut list.
