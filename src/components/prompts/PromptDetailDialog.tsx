import { useState } from 'react';
import { BookOpen, Copy, History, Pencil } from 'lucide-react';
import type { Bundle, Folder, Prompt, Tag } from '../../types';
import { ASSET_TYPE_LABELS, DEFAULT_ASSET_TYPE, TARGET_TOOL_LABELS } from '../../types/prompt';
import { detectVariables } from '../../services/templateService';
import { formatAbsolute } from '../../utils/dateFormat';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';

interface PromptDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt;
  folder?: Folder;
  tags: Tag[];
  bundles: Bundle[];
  onCopy: () => Promise<void>;
  onFill: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onOpenBundle: (bundleId: string) => void;
}

export function PromptDetailDialog({
  open,
  onOpenChange,
  prompt,
  folder,
  tags,
  bundles,
  onCopy,
  onFill,
  onEdit,
  onHistory,
  onOpenBundle,
}: PromptDetailDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const type = prompt.type ?? DEFAULT_ASSET_TYPE;
  const targetTools = prompt.targetTools ?? [];
  const variables = detectVariables(prompt.content);

  const handleCopy = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCopy();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to copy prompt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Prompt detail: ${prompt.title}`}
      description="Read the complete authored prompt and its library context."
      maxWidthClass="max-h-[calc(100vh-2rem)] max-w-4xl overflow-y-auto"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2" aria-label="Prompt actions">
          <Button size="sm" onClick={() => void handleCopy()} disabled={busy}>
            <Copy className="h-4 w-4" /> {busy ? 'Copying…' : 'Copy prompt'}
          </Button>
          {variables.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={onFill} disabled={busy}>
              <BookOpen className="h-4 w-4" /> Fill variables
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={onEdit} disabled={busy}>
            <Pencil className="h-4 w-4" /> Edit prompt
          </Button>
          <Button size="sm" variant="secondary" onClick={onHistory} disabled={busy}>
            <History className="h-4 w-4" /> Version history
          </Button>
        </div>

        <section aria-labelledby="prompt-detail-content-heading" className="space-y-2">
          <h3 id="prompt-detail-content-heading" className="text-sm font-semibold">Content</h3>
          <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm leading-6 dark:border-neutral-800 dark:bg-neutral-900">
            {prompt.content}
          </pre>
        </section>

        <section aria-labelledby="prompt-detail-metadata-heading" className="space-y-2">
          <h3 id="prompt-detail-metadata-heading" className="text-sm font-semibold">Metadata</h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <MetadataItem label="Type">{ASSET_TYPE_LABELS[type]}</MetadataItem>
            <MetadataItem label="Folder">{folder?.name ?? 'Unfiled'}</MetadataItem>
            <MetadataItem label="Tags">
              {tags.length > 0 ? tags.map((tag) => `#${tag.name}`).join(', ') : 'None'}
            </MetadataItem>
            <MetadataItem label="Target tools">
              {targetTools.length > 0 ? targetTools.map((tool) => TARGET_TOOL_LABELS[tool] ?? tool).join(', ') : 'None'}
            </MetadataItem>
            <MetadataItem label="Favorite">{prompt.isFavorite ? 'Yes' : 'No'}</MetadataItem>
            <MetadataItem label="Usage">
              {prompt.copyCount} {prompt.copyCount === 1 ? 'copy' : 'copies'}
              {prompt.lastCopiedAt ? ` · Last copied ${formatAbsolute(prompt.lastCopiedAt)}` : ''}
            </MetadataItem>
            <MetadataItem label="Updated">{formatAbsolute(prompt.updatedAt)}</MetadataItem>
          </dl>
        </section>

        {prompt.description ? (
          <section aria-labelledby="prompt-detail-description-heading" className="space-y-2">
            <h3 id="prompt-detail-description-heading" className="text-sm font-semibold">Description</h3>
            <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">{prompt.description}</p>
          </section>
        ) : null}

        {prompt.notes ? (
          <section aria-labelledby="prompt-detail-notes-heading" className="space-y-2">
            <h3 id="prompt-detail-notes-heading" className="text-sm font-semibold">Notes</h3>
            <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">{prompt.notes}</p>
          </section>
        ) : null}

        {variables.length > 0 ? (
          <section aria-labelledby="prompt-detail-variables-heading" className="space-y-2">
            <h3 id="prompt-detail-variables-heading" className="text-sm font-semibold">Variables</h3>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {variables.map((name) => (
                <li key={name} className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                  {name} — {prompt.variableDefaults[name] || '(no default)'}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="prompt-detail-bundles-heading" className="space-y-2">
          <h3 id="prompt-detail-bundles-heading" className="text-sm font-semibold">Bundle context</h3>
          {bundles.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {bundles.map((bundle) => (
                <li key={bundle.id}>
                  <Button size="sm" variant="ghost" aria-label={`Open bundle: ${bundle.name}`} onClick={() => onOpenBundle(bundle.id)}>
                    {bundle.name}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">This prompt is not in a bundle.</p>
          )}
        </section>

        {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
    </Dialog>
  );
}

function MetadataItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-neutral-800 dark:text-neutral-200">{children}</dd>
    </div>
  );
}
