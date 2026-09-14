import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Copy, Search } from 'lucide-react';
import type { Prompt } from '../../types';
import { useAppState } from '../../hooks/useAppState';
import { usePrompts } from '../../hooks/usePrompts';
import { useFolders } from '../../hooks/useFolders';
import { useTags } from '../../hooks/useTags';
import { useBundles } from '../../hooks/useBundles';
import { createSearchIndex, type SearchResult } from '../../utils/search';
import { detectVariables } from '../../services/templateService';
import { copyToClipboard } from '../../utils/copy';
import { notify } from '../common/Toast';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';
import { Input } from '../common/Input';

type PaletteAction = 'open' | 'copy' | 'fill';

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, setDialog } = useAppState();
  const { prompts, copy } = usePrompts();
  const { folders } = useFolders();
  const { tags } = useTags();
  const { bundles } = useBundles();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const searchIndex = useMemo(
    () => createSearchIndex(prompts, folderMap, tagMap, bundles),
    [prompts, folderMap, tagMap, bundles],
  );
  const results = useMemo(() => searchIndex.search(query), [searchIndex, query]);

  useEffect(() => {
    if (!paletteOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    setSelectedIndex(0);
    setBusy(false);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [paletteOpen]);

  useEffect(() => {
    setSelectedIndex((index) => Math.min(index, Math.max(0, results.length - 1)));
  }, [results.length]);

  const close = () => {
    setPaletteOpen(false);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  };

  const runAction = async (result: SearchResult, action: PaletteAction) => {
    if (action === 'open') {
      setPaletteOpen(false);
      setDialog({ kind: 'detail-prompt', promptId: result.prompt.id });
      return;
    }
    if (action === 'fill') {
      setPaletteOpen(false);
      setDialog({ kind: 'fill-prompt', promptId: result.prompt.id });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await copyToClipboard(result.prompt.content);
      await copy(result.prompt.id);
      notify.success('Copied to clipboard');
      close();
    } catch {
      notify.error('Failed to copy');
    } finally {
      setBusy(false);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home' && results.length > 0) {
      event.preventDefault();
      setSelectedIndex(0);
    } else if (event.key === 'End' && results.length > 0) {
      event.preventDefault();
      setSelectedIndex(results.length - 1);
    } else if (event.key === 'Enter' && results[selectedIndex]) {
      event.preventDefault();
      void runAction(results[selectedIndex], 'open');
    }
  };

  return (
    <Dialog
      open={paletteOpen}
      onOpenChange={(open) => (open ? setPaletteOpen(true) : close())}
      title="Command palette"
      description="Search your library and choose an action without leaving the keyboard."
      maxWidthClass="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto"
    >
      <div className="space-y-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            ref={inputRef}
            type="search"
            aria-label="Command palette search"
            aria-controls="command-palette-results"
            placeholder="Search prompts…"
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        <p className="text-xs text-neutral-500">Use ↑/↓ to navigate, Enter to open, or Tab to choose an action. Esc closes.</p>
        {results.length > 0 ? (
          <ul id="command-palette-results" aria-label="Command palette results" className="space-y-2">
            {results.map((result, index) => {
              const { prompt } = result;
              const hasVariables = detectVariables(prompt.content).length > 0;
              return (
                <li
                  key={prompt.id}
                  id={`command-palette-result-${prompt.id}`}
                  className={`rounded-md border p-3 ${
                    selectedIndex === index
                      ? 'border-accent-400 bg-accent-50 dark:border-accent-700 dark:bg-accent-950/30'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{prompt.title}</h3>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-neutral-600 dark:text-neutral-300">
                        {preview(prompt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" aria-label={`Open prompt: ${prompt.title}`} onClick={() => void runAction(result, 'open')}>
                        <BookOpen className="h-4 w-4" /> Open
                      </Button>
                      <Button size="sm" aria-label={`Copy prompt: ${prompt.title}`} onClick={() => void runAction(result, 'copy')} disabled={busy}>
                        <Copy className="h-4 w-4" /> Copy
                      </Button>
                      {hasVariables ? (
                        <Button size="sm" aria-label={`Fill variables: ${prompt.title}`} onClick={() => void runAction(result, 'fill')} disabled={busy}>
                          Fill variables
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p role="status" className="rounded-md border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
            No prompts match “{query}”.
          </p>
        )}
      </div>
    </Dialog>
  );
}

function preview(prompt: Prompt): string {
  const value = prompt.description?.trim() || prompt.content.trim();
  return value.length > 140 ? `${value.slice(0, 140)}…` : value;
}
