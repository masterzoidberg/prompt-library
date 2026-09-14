import { useEffect, useState } from 'react';
import type { Bundle, BundleCreate, Prompt } from '../../types';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';

interface BundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts: Prompt[];
  initial?: Bundle;
  onSubmit: (values: BundleCreate) => Promise<void> | void;
}

function orderedPromptIds(
  prompts: Prompt[],
  selectedIds: Set<string>,
  initial?: Bundle,
): string[] {
  const ordered = initial?.promptIds.filter((id) => selectedIds.has(id)) ?? [];
  for (const promptId of selectedIds) {
    if (prompts.some((prompt) => prompt.id === promptId) && !ordered.includes(promptId)) {
      ordered.push(promptId);
    }
  }
  return ordered;
}

export function BundleDialog({ open, onOpenChange, prompts, initial, onSubmit }: BundleDialogProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initial?.promptIds ?? []));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setSelectedIds(new Set(initial?.promptIds ?? []));
    setError(null);
    setSubmitting(false);
  }, [open, initial]);

  const unavailableCount = [...selectedIds].filter((id) => !prompts.some((prompt) => prompt.id === id)).length;

  const togglePrompt = (promptId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(promptId)) next.delete(promptId);
      else next.add(promptId);
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        promptIds: orderedPromptIds(prompts, selectedIds, initial),
      });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save bundle.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? 'Edit bundle' : 'New bundle'}
      description="Group prompts into an ordered sequence for repeatable work."
      maxWidthClass="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div>
          <label htmlFor="bundle-name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <Input
            id="bundle-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Morning writing flow"
            autoFocus
            data-autofocus-safe="true"
          />
        </div>

        <div>
          <label htmlFor="bundle-description" className="mb-1 block text-sm font-medium">
            Description <span className="text-neutral-400">(optional)</span>
          </label>
          <Textarea
            id="bundle-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="When to use this sequence"
            rows={3}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Prompts in this bundle</legend>
          {prompts.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-neutral-300 p-2 dark:border-neutral-700">
              {prompts.map((prompt, index) => (
                <label
                  key={prompt.id}
                  htmlFor={`bundle-prompt-${prompt.id}`}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <input
                    id={`bundle-prompt-${prompt.id}`}
                    type="checkbox"
                    aria-label={`Include prompt ${index + 1}: ${prompt.title}`}
                    checked={selectedIds.has(prompt.id)}
                    onChange={() => togglePrompt(prompt.id)}
                    className="mt-0.5 h-4 w-4 accent-accent-600"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{prompt.title}</span>
                    <span className="block truncate text-xs text-neutral-500">{prompt.content}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-neutral-300 p-3 text-sm text-neutral-500 dark:border-neutral-700">
              No prompts available yet.
            </p>
          )}
          {unavailableCount > 0 ? (
            <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
              {unavailableCount} unavailable bundle {unavailableCount === 1 ? 'item' : 'items'} will be removed when saved.
            </p>
          ) : null}
        </fieldset>

        {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
