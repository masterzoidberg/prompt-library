import { useEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { Input } from '../common/Input';
import type { Folder } from '../../types/folder';
import { SYSTEM_FOLDER_ID, SYSTEM_FOLDER_NAME } from '../../config/constants';
import { normalizeName } from '../../utils/normalize';

interface FolderComboboxProps {
  folders: Folder[];
  selectedId: string;
  stagedName?: string;
  onSelect: (id: string) => void;
  onStage: (name: string) => void;
}

const LISTBOX_ID = 'prompt-folder-options';

export function FolderCombobox({ folders, selectedId, stagedName, onSelect, onStage }: FolderComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressNextFocusOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedQuery = normalizeName(query);
  const matchingFolders = useMemo(
    () => [...folders]
      .sort((left, right) => Number(right.id === SYSTEM_FOLDER_ID) - Number(left.id === SYSTEM_FOLDER_ID))
      .filter((folder) => !normalizedQuery || folder.normalizedName.includes(normalizedQuery)),
    [folders, normalizedQuery],
  );
  const createName = query.trim();
  const exactMatch = folders.some((folder) => folder.normalizedName === normalizeName(createName));
  const canCreate = Boolean(createName) && !exactMatch;
  const optionCount = matchingFolders.length + Number(canCreate);
  const selectedName = stagedName ?? folders.find((folder) => folder.id === selectedId)?.name ?? SYSTEM_FOLDER_NAME;

  useEffect(() => {
    if (!open) return;
    const keepEscapeInsideCombobox = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault();
    };
    window.addEventListener('keydown', keepEscapeInsideCombobox, true);
    return () => window.removeEventListener('keydown', keepEscapeInsideCombobox, true);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
  };

  const selectOption = (index: number) => {
    if (index < matchingFolders.length) {
      onSelect(matchingFolders[index].id);
    } else if (canCreate) {
      const name = createName;
      if (normalizeName(name) === normalizeName(SYSTEM_FOLDER_NAME)) {
        onSelect(SYSTEM_FOLDER_ID);
      } else {
        onStage(name);
      }
    }
    close();
    suppressNextFocusOpen.current = true;
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(optionCount - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => index < 0 ? Math.max(optionCount - 1, 0) : Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (optionCount > 0) selectOption(activeIndex < 0 ? 0 : Math.min(activeIndex, optionCount - 1));
    }
  };

  const handleEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className="relative" onBlur={handleBlur} onKeyDown={handleEscape}>
      <Input
        ref={inputRef}
        id="prompt-folder"
        role="combobox"
        aria-label="Folder"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? LISTBOX_ID : undefined}
        aria-activedescendant={open && activeIndex >= 0 && activeIndex < optionCount ? `prompt-folder-option-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder="Search or select a folder..."
        value={open ? query : selectedName}
        onFocus={(event) => {
          if (suppressNextFocusOpen.current) {
            suppressNextFocusOpen.current = false;
            return;
          }
          setOpen(true);
          setQuery('');
          setActiveIndex(-1);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
      />
      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <ul id={LISTBOX_ID} role="listbox" aria-label="Folders" className="max-h-48 overflow-y-auto p-1">
            {matchingFolders.map((folder, index) => (
              <li key={folder.id} role="presentation">
                <button
                  id={`prompt-folder-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={folder.id === selectedId && !stagedName}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(index)}
                  className={`flex min-h-9 w-full items-center rounded px-2 text-left text-sm outline-none ${
                    index === activeIndex
                      ? 'bg-neutral-100 dark:bg-neutral-800'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="min-w-0 break-all">{folder.name}</span>
                </button>
              </li>
            ))}
            {canCreate ? (
              <li role="presentation">
                <button
                  id={`prompt-folder-option-${matchingFolders.length}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(matchingFolders.length)}
                  onClick={() => selectOption(matchingFolders.length)}
                  className={`flex min-h-9 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none ${
                    activeIndex === matchingFolders.length
                      ? 'bg-neutral-100 dark:bg-neutral-800'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span aria-hidden="true" className="text-accent-700 dark:text-accent-400">+</span>
                  <span>Create <span className="min-w-0 break-all font-medium">"{createName}"</span></span>
                </button>
              </li>
            ) : null}
            {optionCount === 0 ? (
              <li role="presentation" className="px-2 py-2 text-sm text-neutral-500">No folders found.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

