import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Files, Pencil, Play, RotateCcw } from 'lucide-react';
import type { Bundle, Prompt } from '../../types';
import { detectVariables } from '../../services/templateService';
import { Button } from '../common/Button';

interface BundlePanelProps {
  bundle: Bundle;
  prompts: Prompt[];
  onOpenPrompt: (promptId: string) => void;
  onCopyPrompt: (promptId: string) => Promise<void>;
  onFillPrompt: (promptId: string) => void;
  onReorder: (promptIds: string[]) => Promise<void>;
  onEdit: () => void;
}

export function BundlePanel({
  bundle,
  prompts,
  onOpenPrompt,
  onCopyPrompt,
  onFillPrompt,
  onReorder,
  onEdit,
}: BundlePanelProps) {
  const promptMap = useMemo(() => new Map(prompts.map((prompt) => [prompt.id, prompt])), [prompts]);
  const members = useMemo(
    () => bundle.promptIds.map((promptId) => promptMap.get(promptId)).filter((prompt): prompt is Prompt => Boolean(prompt)),
    [bundle.promptIds, promptMap],
  );
  const missingCount = bundle.promptIds.length - members.length;
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(members[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const firstAvailable = members[0]?.id ?? null;
    setCurrentPromptId((current) => (current && members.some((prompt) => prompt.id === current) ? current : firstAvailable));
  }, [bundle.id, members]);

  const currentPrompt = members.find((prompt) => prompt.id === currentPromptId) ?? null;
  const currentIndex = currentPrompt ? members.findIndex((prompt) => prompt.id === currentPrompt.id) : -1;
  const hasVariables = currentPrompt ? detectVariables(currentPrompt.content).length > 0 : false;

  const runAsync = async (callback: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await callback();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bundle action failed.');
    } finally {
      setBusy(false);
    }
  };

  const moveMember = (promptId: string, offset: -1 | 1) => {
    const index = bundle.promptIds.indexOf(promptId);
    const targetIndex = index + offset;
    if (index < 0 || targetIndex < 0 || targetIndex >= bundle.promptIds.length) return;
    const promptIds = [...bundle.promptIds];
    [promptIds[index], promptIds[targetIndex]] = [promptIds[targetIndex], promptIds[index]];
    void runAsync(() => onReorder(promptIds));
  };

  const selectNext = () => {
    if (currentIndex < 0 || currentIndex >= members.length - 1) return;
    setCurrentPromptId(members[currentIndex + 1].id);
  };

  const selectPrevious = () => {
    if (currentIndex <= 0) return;
    setCurrentPromptId(members[currentIndex - 1].id);
  };

  return (
    <div className="space-y-5 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{bundle.name}</h2>
          {bundle.description ? <p className="mt-1 text-sm text-neutral-500">{bundle.description}</p> : null}
          <p className="mt-1 text-xs text-neutral-500">
            {members.length} of {bundle.promptIds.length} bundle {bundle.promptIds.length === 1 ? 'item' : 'items'} available
          </p>
        </div>
        <Button size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" /> Edit bundle
        </Button>
      </header>

      {missingCount > 0 ? (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {missingCount} unavailable bundle {missingCount === 1 ? 'item' : 'items'} no longer exists. Edit the bundle to remove it.
        </p>
      ) : null}

      {members.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">{missingCount > 0 ? 'No available prompts in this bundle.' : 'This bundle is empty.'}</p>
          <Button size="sm" className="mt-3" onClick={onEdit}>Edit bundle</Button>
        </div>
      ) : (
        <>
          {currentPrompt ? (
            <section aria-label="Current asset" className="space-y-3 rounded-lg border border-accent-200 bg-accent-50/40 p-4 dark:border-accent-900 dark:bg-accent-950/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent-700 dark:text-accent-300">Current asset</p>
                  <h3 className="mt-1 truncate text-lg font-semibold">{currentPrompt.title}</h3>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" aria-label="Previous asset" onClick={selectPrevious} disabled={busy || currentIndex <= 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" aria-label="Next asset" onClick={selectNext} disabled={busy || currentIndex < 0 || currentIndex >= members.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-3 font-mono text-sm dark:border-neutral-800 dark:bg-neutral-950">
                {currentPrompt.content}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onOpenPrompt(currentPrompt.id)} disabled={busy}>
                  <Play className="h-4 w-4" /> Open current asset
                </Button>
                <Button size="sm" onClick={() => void runAsync(() => onCopyPrompt(currentPrompt.id))} disabled={busy}>
                  <Files className="h-4 w-4" /> Copy current asset
                </Button>
                {hasVariables ? (
                  <Button size="sm" variant="secondary" onClick={() => onFillPrompt(currentPrompt.id)} disabled={busy}>
                    <RotateCcw className="h-4 w-4" /> Fill current asset
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="bundle-order-heading" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="bundle-order-heading" className="text-sm font-semibold">Bundle order</h3>
              <span className="text-xs text-neutral-500">Use the arrow buttons to reorder</span>
            </div>
            <ol className="space-y-2">
              {members.map((prompt) => {
                const index = bundle.promptIds.indexOf(prompt.id);
                const selected = prompt.id === currentPromptId;
                return (
                  <li key={prompt.id} className="flex items-center gap-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-800" aria-current={selected ? 'step' : undefined}>
                    <button
                      type="button"
                      aria-label={`Select bundle item ${index + 1}: ${prompt.title}`}
                      aria-pressed={selected}
                      onClick={() => setCurrentPromptId(prompt.id)}
                      className="min-w-0 flex-1 rounded px-2 py-1 text-left text-sm hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:hover:bg-neutral-900"
                    >
                      <span className="mr-2 text-xs text-neutral-500">{index + 1}</span>
                      <span className="font-medium">{prompt.title}</span>
                    </button>
                    <Button size="icon" aria-label={`Move bundle item ${index + 1} up`} onClick={() => moveMember(prompt.id, -1)} disabled={busy || index <= 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" aria-label={`Move bundle item ${index + 1} down`} onClick={() => moveMember(prompt.id, 1)} disabled={busy || index >= bundle.promptIds.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}

      {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
