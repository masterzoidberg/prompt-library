import { useState } from 'react';
import type { ReactNode } from 'react';
import { Copy, Check, MoreHorizontal, Star, Pencil, Trash2, Files, FolderInput, History, BookOpen } from 'lucide-react';
import type { Prompt, Folder, Tag } from '../../types';
import { ASSET_TYPE_LABELS, DEFAULT_ASSET_TYPE, TARGET_TOOL_LABELS } from '../../types/prompt';
import { detectVariables } from '../../services/templateService';
import { Button } from '../common/Button';
import { Dropdown, DropdownItem } from '../common/Dropdown';
import { formatRelative } from '../../utils/dateFormat';
import type { SearchField, SearchMatch } from '../../utils/search';

interface PromptCardProps {
  prompt: Prompt;
  folder?: Folder;
  tags: Tag[];
  onOpen?: (id: string) => void;
  onCopy: (id: string) => Promise<void> | void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string) => void;
  onHistory?: (id: string) => void;
  onFill?: (id: string) => void;
  onToggleFavorite: (id: string, value: boolean) => void;
  searchMatches?: SearchMatch[];
}

function HighlightedText({ value, field, matches }: { value: string; field: SearchField; matches: SearchMatch[] }): ReactNode {
  const ranges = matches
    .filter((match) => match.field === field && match.value === value)
    .map((match) => ({
      start: Math.max(0, Math.min(value.length, match.start)),
      end: Math.max(0, Math.min(value.length, match.end)),
    }))
    .filter((range) => Number.isInteger(range.start) && Number.isInteger(range.end) && range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (ranges.length === 0) return value;

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start < cursor) return;
    if (range.start > cursor) parts.push(value.slice(cursor, range.start));
    parts.push(
      <mark key={`${field}-${range.start}-${range.end}-${index}`} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-700/70">
        {value.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

export function PromptCard({
  prompt,
  folder,
  tags,
  onOpen,
  onCopy,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
  onHistory,
  onFill,
  onToggleFavorite,
  searchMatches = [],
}: PromptCardProps) {
  const [copied, setCopied] = useState(false);
  const typeLabel = prompt.type
    ? ASSET_TYPE_LABELS[prompt.type] ?? prompt.type
    : ASSET_TYPE_LABELS[DEFAULT_ASSET_TYPE];
  const targetTools = prompt.targetTools ?? [];
  const hasVariables = detectVariables(prompt.content).length > 0;

  const handleCopy = async () => {
    try {
      await onCopy(prompt.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // The container owns copy and persistence feedback.
    }
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (
      event.target !== event.currentTarget ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey
    ) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'enter':
        if (onOpen) {
          event.preventDefault();
          onOpen(prompt.id);
        }
        break;
      case 'c':
        event.preventDefault();
        void handleCopy();
        break;
      case 'f':
        event.preventDefault();
        onToggleFavorite(prompt.id, !prompt.isFavorite);
        break;
      case 'e':
        event.preventDefault();
        onEdit(prompt.id);
        break;
      case 'd':
        event.preventDefault();
        onDuplicate(prompt.id);
        break;
    }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <article
      aria-label={`Prompt: ${prompt.title}`}
      aria-keyshortcuts={onOpen ? 'Enter c f e d' : 'c f e d'}
      tabIndex={0}
      onKeyDown={handleCardKeyDown}
      className="group relative flex h-full flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-accent-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-accent-500"
    >
      <header className="flex items-start gap-2">
        <h3 className="flex-1 truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
          <HighlightedText value={prompt.title} field="title" matches={searchMatches} />
        </h3>
        {onOpen ? (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Open prompt: ${prompt.title}`}
            onClick={(e) => {
              stop(e);
              onOpen(prompt.id);
            }}
            className="h-7 px-2"
          >
            <BookOpen className="h-4 w-4" /> Open
          </Button>
        ) : null}
        <button
          type="button"
          aria-label={prompt.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={prompt.isFavorite}
          onClick={(e) => {
            stop(e);
            onToggleFavorite(prompt.id, !prompt.isFavorite);
          }}
          className="rounded-md p-1 text-neutral-400 hover:text-yellow-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        >
          <Star
            className={`h-4 w-4 ${prompt.isFavorite ? 'fill-yellow-400 text-yellow-500' : ''}`}
          />
        </button>
        <Dropdown
          trigger={
            <button
              type="button"
              aria-label="Prompt actions"
              onClick={stop}
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        >
          {onHistory ? (
            <DropdownItem onSelect={() => onHistory(prompt.id)}>
              <History className="h-4 w-4" /> Version history
            </DropdownItem>
          ) : null}
          {onFill && hasVariables ? (
            <DropdownItem onSelect={() => onFill(prompt.id)}>
              Fill variables
            </DropdownItem>
          ) : null}
          <DropdownItem onSelect={() => onEdit(prompt.id)}>
            <Pencil className="h-4 w-4" /> Edit
          </DropdownItem>
          <DropdownItem onSelect={() => onDuplicate(prompt.id)}>
            <Files className="h-4 w-4" /> Duplicate
          </DropdownItem>
          <DropdownItem onSelect={() => onMove(prompt.id)}>
            <FolderInput className="h-4 w-4" /> Move to folder
          </DropdownItem>
          <DropdownItem onSelect={() => onToggleFavorite(prompt.id, !prompt.isFavorite)}>
            <Star className="h-4 w-4" /> {prompt.isFavorite ? 'Unfavorite' : 'Favorite'}
          </DropdownItem>
          <DropdownItem onSelect={() => onDelete(prompt.id)} destructive>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownItem>
        </Dropdown>
      </header>

      <pre className="line-clamp-4 whitespace-pre-wrap break-words font-mono text-xs text-neutral-600 dark:text-neutral-300">
        <HighlightedText value={prompt.content} field="content" matches={searchMatches} />
      </pre>

      {prompt.description ? (
        <p className="line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
          <HighlightedText value={prompt.description} field="description" matches={searchMatches} />
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
            Type: <HighlightedText value={typeLabel} field="type" matches={searchMatches} />
          </span>
        {targetTools.map((tool) => (
          <span key={tool} className="rounded bg-accent-50 px-1.5 py-0.5 text-accent-700 dark:bg-accent-900/30 dark:text-accent-200">
            Target: <HighlightedText value={TARGET_TOOL_LABELS[tool] ?? tool} field="targetTool" matches={searchMatches} />
          </span>
        ))}
      </div>

      {prompt.notes ? (
        <p className="line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="font-medium">Notes:</span>{' '}
          <HighlightedText value={prompt.notes} field="notes" matches={searchMatches} />
        </p>
      ) : null}

      <footer className="mt-auto flex items-center justify-between gap-2 text-xs text-neutral-500">
        <div className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
          {folder ? (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
              {folder.name}
            </span>
          ) : null}
          {tags.slice(0, 3).map((t) => (
            <span
              key={t.id}
              className="rounded bg-accent-50 px-1.5 py-0.5 text-accent-700 dark:bg-accent-900/30 dark:text-accent-200"
            >
              #<HighlightedText value={t.name} field="tag" matches={searchMatches} />
            </span>
          ))}
          {tags.length > 3 ? (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
              +{tags.length - 3}
            </span>
          ) : null}
        </div>
        <span className="shrink-0">{formatRelative(prompt.updatedAt)}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copy prompt"
          onClick={(e) => {
            stop(e);
            handleCopy();
          }}
          className="h-7 w-7"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </footer>
    </article>
  );
}
