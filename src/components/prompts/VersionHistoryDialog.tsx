import { useEffect, useMemo, useState } from 'react';
import { Copy, Files, RotateCcw } from 'lucide-react';
import type { Prompt, PromptVersion } from '../../types';
import { toPromptVersionSnapshot, listPromptVersions } from '../../data/versionRepository';
import { diffLines, type DiffLine } from '../../services/diffService';
import { formatAbsolute } from '../../utils/dateFormat';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';

interface StorageEstimate {
  usage: number;
  quota: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt;
  onCopy: (promptId: string, content: string) => Promise<void>;
  onDuplicate: (promptId: string, versionId: string) => Promise<void>;
  onRestore: (promptId: string, versionId: string) => Promise<void>;
}

type Action = 'copy' | 'duplicate' | 'restore' | null;

function displayValue(value: unknown): string {
  if (value === undefined || value === '') return '(empty)';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function changedMetadata(version: PromptVersion, prompt: Prompt): Array<[string, string, string]> {
  const oldSnapshot = version.snapshot;
  const currentSnapshot = toPromptVersionSnapshot(prompt);
  const fields: Array<[string, unknown, unknown]> = [
    ['Title', oldSnapshot.title, currentSnapshot.title],
    ['Description', oldSnapshot.description, currentSnapshot.description],
    ['Type', oldSnapshot.type, currentSnapshot.type],
    ['Target tools', oldSnapshot.targetTools, currentSnapshot.targetTools],
    ['Notes', oldSnapshot.notes, currentSnapshot.notes],
    ['Variable defaults', oldSnapshot.variableDefaults, currentSnapshot.variableDefaults],
  ];
  return fields
    .filter(([, oldValue, currentValue]) => displayValue(oldValue) !== displayValue(currentValue))
    .map(([label, oldValue, currentValue]) => [label, displayValue(oldValue), displayValue(currentValue)]);
}

function DiffView({ lines }: { lines: DiffLine[] }) {
  if (lines.length === 0) return <p className="text-sm text-neutral-500">No content changes.</p>;

  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-xs text-neutral-500" aria-label="Diff legend">
        <span>− Removed</span>
        <span>+ Added</span>
        <span>· Unchanged</span>
      </div>
      <pre className="max-h-72 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-900">
        {lines.map((line, index) => {
          const prefix = line.kind === 'removed' ? '−' : line.kind === 'added' ? '+' : ' ';
          const tone =
            line.kind === 'removed'
              ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'
              : line.kind === 'added'
                ? 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200'
                : 'text-neutral-600 dark:text-neutral-300';
          return (
            <span key={`${line.kind}-${line.oldLine ?? ''}-${line.newLine ?? ''}-${index}`} className={`block ${tone}`}>
              <span aria-hidden="true" className="mr-2 select-none opacity-70">
                {prefix}
              </span>
              {line.text || ' '}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  prompt,
  onCopy,
  onDuplicate,
  onRestore,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [restoreVersionId, setRestoreVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null);

  const versionStorageBytes = useMemo(
    () => new TextEncoder().encode(JSON.stringify(versions)).byteLength,
    [versions],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setVersions([]);
    setSelectedVersionId(null);
    setRestoreVersionId(null);
    setBusy(null);
    setError(null);
    void listPromptVersions(prompt.id)
      .then((loaded) => {
        if (cancelled) return;
        setVersions(loaded);
        setSelectedVersionId(loaded.at(-1)?.id ?? null);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Failed to load version history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, prompt.id]);

  useEffect(() => {
    if (!open || !navigator.storage?.estimate) return;
    let cancelled = false;
    void navigator.storage.estimate().then(({ usage, quota }) => {
      if (!cancelled && typeof usage === 'number' && typeof quota === 'number') {
        setStorageEstimate({ usage, quota });
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedVersion = versions.find((version) => version.id === selectedVersionId);
  const restoreCandidate = versions.find((version) => version.id === restoreVersionId);
  const contentDiff = useMemo(
    () => (selectedVersion ? diffLines(selectedVersion.snapshot.content, prompt.content) : []),
    [prompt.content, selectedVersion],
  );
  const metadataChanges = selectedVersion ? changedMetadata(selectedVersion, prompt) : [];

  const runAction = async (action: Exclude<Action, null>, callback: () => Promise<void>) => {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      await callback();
      if (action === 'restore') onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to ${action} version.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Version history: ${prompt.title}`}
      description="Compare saved authored snapshots. Organizing, favorite, and usage changes are not versioned."
      maxWidthClass="max-h-[calc(100vh-2rem)] max-w-5xl overflow-y-auto"
    >
      {loading ? <p role="status" className="text-sm text-neutral-500">Loading versions…</p> : null}
      <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        {versions.length} saved version{versions.length === 1 ? '' : 's'} retained. Versions are stored locally and are not automatically pruned.
      </p>
      <p role="status" className="text-xs text-neutral-500">
        Estimated version history size: {formatBytes(versionStorageBytes)}.{' '}
        {storageEstimate
          ? `Browser storage estimate: ${formatBytes(storageEstimate.usage)} of ${formatBytes(storageEstimate.quota)} used.`
          : 'Browser storage quota estimate is unavailable.'}
      </p>
      {storageEstimate && storageEstimate.quota > 0 && storageEstimate.usage / storageEstimate.quota >= 0.8 ? (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          Browser storage is nearing its quota. Export a backup before continuing to add authored versions.
        </p>
      ) : null}
      {!loading && versions.length === 0 ? (
        <p className="text-sm text-neutral-500">No saved versions yet. Edit this prompt to create its first snapshot.</p>
      ) : null}
      {!loading && versions.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)]">
          <aside aria-label="Saved versions">
            <h3 className="mb-2 text-sm font-semibold">Saved versions</h3>
            <ul className="space-y-1">
              {versions.map((version) => (
                <li key={version.id}>
                  <button
                    type="button"
                    aria-pressed={version.id === selectedVersionId}
                    onClick={() => {
                      setSelectedVersionId(version.id);
                      setRestoreVersionId(null);
                    }}
                    className="w-full rounded-md border border-transparent px-3 py-2 text-left text-sm hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 aria-pressed:border-accent-400 aria-pressed:bg-accent-50 dark:hover:bg-neutral-900 dark:aria-pressed:border-accent-700 dark:aria-pressed:bg-accent-950/40"
                  >
                    <span className="block font-medium">Version {version.sequence}</span>
                    <span className="block text-xs text-neutral-500">
                      {version.reason === 'restore' ? 'Restore' : 'Edit'} · {formatAbsolute(version.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selectedVersion ? (
            <section aria-labelledby="selected-version-heading" className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="selected-version-heading" className="text-base font-semibold">
                    Version {selectedVersion.sequence}
                  </h3>
                  <p className="text-xs text-neutral-500">Saved {formatAbsolute(selectedVersion.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void runAction('copy', () => onCopy(prompt.id, selectedVersion.snapshot.content))}
                    disabled={busy !== null}
                  >
                    <Copy className="h-4 w-4" /> Copy version {selectedVersion.sequence}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void runAction('duplicate', () => onDuplicate(prompt.id, selectedVersion.id))}
                    disabled={busy !== null}
                  >
                    <Files className="h-4 w-4" /> Duplicate version {selectedVersion.sequence}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRestoreVersionId(selectedVersion.id)}
                    disabled={busy !== null}
                  >
                    <RotateCcw className="h-4 w-4" /> Restore version {selectedVersion.sequence}
                  </Button>
                </div>
              </div>

              <section aria-labelledby="version-content-diff-heading" className="space-y-2">
                <h4 id="version-content-diff-heading" className="text-sm font-semibold">Content comparison</h4>
                <p className="text-xs text-neutral-500">Version snapshot → current prompt</p>
                <DiffView lines={contentDiff} />
              </section>

              <section aria-labelledby="version-metadata-diff-heading" className="space-y-2">
                <h4 id="version-metadata-diff-heading" className="text-sm font-semibold">Other authored fields</h4>
                {metadataChanges.length > 0 ? (
                  <dl className="space-y-2 text-sm">
                    {metadataChanges.map(([label, oldValue, currentValue]) => (
                      <div key={label} className="rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
                        <dt className="font-medium">{label}</dt>
                        <dd className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
                          <span className="rounded bg-red-50 p-1.5 text-red-800 dark:bg-red-950/40 dark:text-red-200">
                            Version: {oldValue}
                          </span>
                          <span className="rounded bg-green-50 p-1.5 text-green-800 dark:bg-green-950/40 dark:text-green-200">
                            Current: {currentValue}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-neutral-500">No other authored field changes.</p>
                )}
              </section>

              {restoreCandidate ? (
                <div role="alert" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="font-semibold">Restore version {restoreCandidate.sequence}?</p>
                  <p>
                    Current “{prompt.title}” will become “{restoreCandidate.snapshot.title}”. The current authored fields will be saved as a new reversible restore version.
                  </p>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <p className="mb-1 font-medium">Current content</p>
                      <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded border border-amber-200 bg-white/60 p-2 dark:border-amber-900 dark:bg-black/20">
                        {prompt.content}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 font-medium">Restored content</p>
                      <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded border border-amber-200 bg-white/60 p-2 dark:border-amber-900 dark:bg-black/20">
                        {restoreCandidate.snapshot.content}
                      </pre>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button size="sm" variant="ghost" onClick={() => setRestoreVersionId(null)} disabled={busy !== null}>
                      Cancel restore
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void runAction('restore', () => onRestore(prompt.id, restoreCandidate.id))}
                      disabled={busy !== null}
                    >
                      {busy === 'restore' ? 'Restoring…' : `Confirm restore version ${restoreCandidate.sequence}`}
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </Dialog>
  );
}
