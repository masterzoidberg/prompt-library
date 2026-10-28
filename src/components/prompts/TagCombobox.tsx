import { useEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import type { Tag } from '../../types/tag';
import { normalizeName } from '../../utils/normalize';

interface TagComboboxProps {
  tags: Tag[];
  selectedIds: string[];
  stagedNames: string[];
  onToggle: (id: string) => void;
  onStage: (name: string) => void;
  onRemoveStaged: (name: string) => void;
}

const LISTBOX_ID = 'prompt-tag-options';

export function TagCombobox({
  tags,
  selectedIds,
  stagedNames,
  onToggle,
  onStage,
  onRemoveStaged,
}: TagComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedQuery = normalizeName(query);
  const matchingTags = useMemo(
    () => tags.filter((tag) => !normalizedQuery || tag.normalizedName.includes(normalizedQuery)),
    [tags, normalizedQuery],
  );
  const createName = query.trim();
  const normalizedCreateName = normalizeName(createName);
  const exactGlobalMatch = tags.some((tag) => tag.normalizedName === normalizedCreateName);
  const exactStagedMatch = stagedNames.some((name) => normalizeName(name) === normalizedCreateName);
  const canCreate = Boolean(createName) && !exactGlobalMatch && !exactStagedMatch;
  const optionCount = matchingTags.length + Number(canCreate);

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
    if (index < matchingTags.length) {
      onToggle(matchingTags[index].id);
    } else if (canCreate) {
      onStage(createName);
    }
    setQuery('');
    setOpen(true);
    setActiveIndex(-1);
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
    } else if (
      event.key === 'Enter' &&
      open &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
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
      <span role="status" className="sr-only">
        {selectedIds.length + stagedNames.length > 0
          ? `Selected tags: ${[...selectedIds.map((id) => tags.find((tag) => tag.id === id)?.name).filter((name): name is string => Boolean(name)), ...stagedNames].join(', ')}`
          : 'No tags selected.'}
      </span>
      <div
        className="flex min-h-10 flex-wrap items-center gap-1 rounded-md border border-neutral-300 bg-white p-1.5 focus-within:border-accent-500 focus-within:outline-none dark:border-neutral-700 dark:bg-neutral-900"
      >
        {selectedIds.map((id) => {
          const tag = tags.find((item) => item.id === id);
          if (!tag) return null;
          return (
            <span
              key={id}
              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded bg-accent-100 px-2 py-1 text-xs text-accent-900 dark:bg-accent-900/40 dark:text-accent-100"
            >
              <span className="min-w-0 break-all">{tag.name}</span>
              <button
                type="button"
                aria-label={`Remove tag ${tag.name}`}
                onClick={() => onToggle(id)}
                className="shrink-0 rounded px-0.5 text-sm leading-none hover:bg-accent-200 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:hover:bg-accent-800"
              >
                ×
              </button>
            </span>
          );
        })}
        {stagedNames.map((name) => (
          <span
            key={normalizeName(name)}
            className="inline-flex min-w-0 max-w-full items-center gap-1 rounded bg-accent-100 px-2 py-1 text-xs text-accent-900 dark:bg-accent-900/40 dark:text-accent-100"
          >
            <span className="min-w-0 break-all">{name}</span>
            <button
              type="button"
              aria-label={`Remove tag ${name}`}
              onClick={() => onRemoveStaged(name)}
              className="shrink-0 rounded px-0.5 text-sm leading-none hover:bg-accent-200 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:hover:bg-accent-800"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id="prompt-tags"
          type="text"
          role="combobox"
          aria-label="Tags"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? LISTBOX_ID : undefined}
          aria-activedescendant={open && activeIndex >= 0 && activeIndex < optionCount ? `prompt-tag-option-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="Search or add tags..."
          value={query}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(-1);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className="h-8 min-w-[7rem] flex-1 border-0 bg-transparent px-1 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:ring-0 dark:text-neutral-100 dark:placeholder-neutral-500"
        />
      </div>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <ul id={LISTBOX_ID} role="listbox" aria-label="Tags" aria-multiselectable="true" className="max-h-48 overflow-y-auto p-1">
            {matchingTags.map((tag, index) => {
              const selected = selectedIds.includes(tag.id);
              return (
                <li key={tag.id} role="presentation">
                  <button
                    id={`prompt-tag-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(index)}
                    className={`flex min-h-9 w-full items-center justify-between gap-3 rounded px-2 text-left text-sm outline-none ${
                      index === activeIndex
                        ? 'bg-neutral-100 dark:bg-neutral-800'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="min-w-0 break-all">{tag.name}</span>
                    {selected ? <span aria-hidden="true" className="shrink-0 text-accent-700 dark:text-accent-300">Selected</span> : null}
                  </button>
                </li>
              );
            })}
            {canCreate ? (
              <li role="presentation">
                <button
                  id={`prompt-tag-option-${matchingTags.length}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(matchingTags.length)}
                  onClick={() => selectOption(matchingTags.length)}
                  className={`flex min-h-9 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none ${
                    activeIndex === matchingTags.length
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
              <li role="presentation" className="px-2 py-2 text-sm text-neutral-500">
                {exactStagedMatch
                  ? 'Already selected.'
                  : matchingTags.length === 0 && normalizedQuery
                    ? 'No matching tags. Type to create one.'
                    : 'No tags yet.'}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

