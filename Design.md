# Historical spec: Prompt Library

> This file is retained as historical input. It contains superseded versions, file maps, tooling claims, and feature boundaries. Current product behavior and release requirements are documented in [`docs/`](./docs/) and the execution evidence in [`plan/completion/`](./plan/completion/).

## Objective

A personal, single-user, browser-based web application for storing, organizing, finding, and copying reusable AI prompts. The user is a power user of LLM tools who wants a fast, reliable local "second brain" for their prompt collection — with the freedom to export their data and zero risk of vendor lock-in.

**Success criteria:**
- User can create a prompt with title, content, optional description, folder, and tags in under 10 seconds.
- User can find any prompt in their library in under 5 seconds via search, filter, or folder navigation.
- User can copy a prompt to clipboard with a single click (or `Enter` on a focused card) and get a visual confirmation.
- All user data persists across browser sessions via IndexedDB; export/import round-trips 100% of data losslessly.
- App is fully keyboard navigable, screen-reader accessible (WCAG 2.1 AA), and usable on mobile down to 375px width.

## Tech Stack

- **Build/Dev:** Vite 5+ with React 18 + TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v3
- **Icons:** lucide-react
- **Primitives:** @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-popover, @radix-ui/react-tooltip
- **Toasts:** sonner
- **Storage:** IndexedDB via `idb` (Jake Archibald)
- **Routing:** None — single-page with view state in React
- **Testing:** Vitest + @testing-library/react + jsdom
- **Lint/Format:** ESLint + Prettier (default Vite TS config)

**Explicitly NOT used:** Firebase, auth, backend, Gemini API, cloud sync, analytics, telemetry, shared libraries, collaboration, nested folders, rich-text editing, prompt execution, AI rewriting, prompt variables, version history, drag-and-drop, bulk editing.

## Commands

```bash
# Install
npm install

# Dev server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Run all tests once
npm run test

# Watch tests
npm run test:watch

# Lint
npm run lint

# Format
npm run format
```

## Project Structure

```
prompt-library/
├── Design.md
├── README.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── .eslintrc.cjs
├── .prettierrc
├── public/
└── src/
    ├── main.tsx                  # React root, mounts <App />
    ├── App.tsx                   # Top-level layout, view state
    ├── config/
    │   └── constants.ts          # System folder ID ("unfiled"), defaults
    ├── types/
    │   ├── prompt.ts
    │   ├── folder.ts
    │   ├── tag.ts
    │   ├── settings.ts
    │   └── index.ts
    ├── data/
    │   ├── db.ts                 # idb openDB, schema migrations
    │   ├── promptRepo.ts         # CRUD + transactional ops for prompts
    │   ├── folderRepo.ts         # CRUD + uniqueness for folders
    │   ├── tagRepo.ts            # CRUD + uniqueness for tags
    │   ├── settingsRepo.ts       # Get/set settings
    │   └── importExport.ts       # JSON validation, round-trip
    ├── hooks/
    │   ├── usePrompts.ts         # List/create/update/delete + cross-record ops
    │   ├── useFolders.ts
    │   ├── useTags.ts
    │   ├── useSettings.ts
    │   ├── useTheme.ts           # System/Light/Dark, applies to <html>
    │   ├── useKeyboardShortcuts.ts # "/" focuses search, etc.
    │   └── useUnsavedGuard.ts    # Confirm before discarding dirty form
    ├── utils/
    │   ├── id.ts                 # crypto.randomUUID() with fallback
    │   ├── normalize.ts          # Case/whitespace normalization helpers
    │   ├── copy.ts               # Clipboard wrapper with error handling
    │   ├── search.ts             # In-memory filter+rank
    │   ├── debounce.ts
    │   ├── date.ts               # Format relative + absolute dates
    │   └── log.ts                # Logger that redacts user content
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx
    │   │   ├── Sidebar.tsx
    │   │   ├── TopBar.tsx
    │   │   └── MobileSidebar.tsx
    │   ├── prompts/
    │   │   ├── PromptList.tsx
    │   │   ├── PromptCard.tsx
    │   │   ├── PromptFormDialog.tsx
    │   │   ├── ConfirmDeleteDialog.tsx
    │   │   ├── MoveToFolderDialog.tsx
    │   │   └── EmptyState.tsx
    │   ├── folders/
    │   │   ├── FolderList.tsx
    │   │   ├── FolderCreateDialog.tsx
    │   │   └── FolderRenameDialog.tsx
    │   ├── tags/
    │   │   ├── TagList.tsx
    │   │   ├── TagCreateDialog.tsx
    │   │   └── TagFilterChips.tsx
    │   ├── search/
    │   │   ├── SearchBar.tsx
    │   │   ├── FilterBar.tsx
    │   │   └── SortMenu.tsx
    │   ├── settings/
    │   │   ├── SettingsDialog.tsx
    │   │   └── ImportExportPanel.tsx
    │   └── common/
    │       ├── Button.tsx
    │       ├── Input.tsx
    │       ├── Textarea.tsx
    │       ├── Dialog.tsx        # Radix wrapper
    │       ├── Dropdown.tsx      # Radix wrapper
    │       └── Toast.tsx         # Sonner helpers
    └── styles/
        └── globals.css           # Tailwind layers + theme variables
```

## Code Style

TypeScript strict. One component per file (or small focused groupings). Tailwind utility classes; no separate CSS files per component. Named exports for utilities, repos, hooks; default exports for components. No comments unless logic is non-obvious.

```ts
// data/promptRepo.ts
import type { Prompt } from '../types/prompt';

export async function listPrompts(): Promise<Prompt[]> {
  const db = await openDb();
  return db.getAll('prompts');
}

export async function createPrompt(input: PromptCreate): Promise<Prompt> {
  const now = new Date().toISOString();
  const prompt: Prompt = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    lastCopiedAt: null,
    copyCount: 0,
    isFavorite: false,
    tagIds: [],
    ...input,
  };
  const db = await openDb();
  await db.add('prompts', prompt);
  return prompt;
}
```

## Testing Strategy

- **Framework:** Vitest with jsdom environment.
- **Library:** @testing-library/react + @testing-library/user-event.
- **Unit tests** for: `normalize.ts`, `search.ts`, `date.ts`, `id.ts`, all repos (against `fake-indexeddb`), `importExport.ts` validators.
- **Hook tests** for: `usePrompts`, `useFolders`, `useTags`, `useKeyboardShortcuts`.
- **Component tests** for: `PromptCard` (click copies + propagation stops), `SearchBar` (`/` shortcut), form dialogs (save/dismiss/unsaved guard).
- **Coverage target:** 80%+ on `src/utils`, `src/data`; meaningful coverage (smoke + key paths) on components.
- Test files live next to source: `foo.ts` → `foo.test.ts`.

## Boundaries

**Always:**
- Run `npm run lint` and `npm run test` before claiming a task is done.
- Use the repository layer for all DB access; never call `indexedDB` directly from a component.
- Validate user input server-of-trust-side (i.e. in the repo/hook) before persisting.
- Stop propagation on interactive elements inside a copyable card.
- Preserve exact user formatting in prompt `content`.

**Ask first:**
- Adding any new npm dependency.
- Changing the IndexedDB schema (requires migration).
- Changing the import/export JSON shape (breaks compatibility).
- Adding any feature outside the master spec.

**Never:**
- Log prompt titles, content, descriptions, tag names, or folder names to console (use redacting logger).
- Auto-format or "prettify" Markdown in the textarea.
- Allow a folder named case-insensitively equal to "Unfiled".
- Delete the system `unfiled` folder.
- Seed the DB with sample prompts.

## Success Criteria

- [ ] `npm run dev` starts the app with an empty library.
- [ ] User can create, edit, duplicate, favorite, copy, move, and delete prompts via UI and keyboard.
- [ ] Folder deletion moves prompts to Unfiled in a single transactional operation.
- [ ] Tag deletion removes the tagId from all affected prompts atomically.
- [ ] Folder and tag names are case-insensitively unique.
- [ ] Search filters prompts in real time across title, content, description, folder, tags.
- [ ] `/` focuses search; `Esc` closes dialogs; `Ctrl/Cmd+Enter` saves forms.
- [ ] Copying a prompt increments `copyCount`, sets `lastCopiedAt`, does NOT update `updatedAt`.
- [ ] Export produces a JSON file; import replaces the library only after full validation.
- [ ] All Radix dialogs trap focus and close on `Escape`.
- [ ] Theme switch (System/Light/Dark) persists and applies correctly.
- [ ] Layout is usable from 375px to 1920px width.
- [ ] `npm run test` passes; `npm run lint` passes; `npm run build` produces a deployable bundle.

## Open Questions

None — spec is fully specified by the master context. Implementation will proceed in order:

1. Project scaffold + Tailwind + tooling
2. Types + IndexedDB layer + repos + system folder
3. Common UI primitives (Button, Dialog, Dropdown, etc.)
4. Layout shell (Sidebar, TopBar, AppShell)
5. Prompt CRUD UI (form dialog, card, list, copy)
6. Folder & Tag management
7. Search, filter, sort
8. Settings + theme
9. Import/Export
10. Polish, a11y audit, tests
