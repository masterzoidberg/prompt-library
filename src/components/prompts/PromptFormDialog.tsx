import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { FolderCombobox } from './FolderCombobox';
import { TagCombobox } from './TagCombobox';
import { useFolders } from '../../hooks/useFolders';
import { useTags } from '../../hooks/useTags';
import { SYSTEM_FOLDER_ID } from '../../config/constants';
import { confirmDiscard, useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import type { Prompt } from '../../types';
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  DEFAULT_ASSET_TYPE,
  TARGET_TOOLS,
  TARGET_TOOL_LABELS,
  type AssetType,
  type PromptCreate,
  type PromptUpdate,
  type TargetTool,
} from '../../types/prompt';
import { detectVariables } from '../../services/templateService';
import { normalizeName } from '../../utils/normalize';

interface PromptFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Prompt;
  onSubmit: (values: PromptCreate | PromptUpdate) => Promise<void> | void;
}

export function PromptFormDialog({ open, onOpenChange, initial, onSubmit }: PromptFormDialogProps) {
  const { folders } = useFolders();
  const { tags } = useTags();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [folderId, setFolderId] = useState(initial?.folderId ?? SYSTEM_FOLDER_ID);
  const [newFolderName, setNewFolderName] = useState<string>();
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? []);
  const [newTagNames, setNewTagNames] = useState<string[]>([]);
  const [type, setType] = useState<AssetType>(initial?.type ?? DEFAULT_ASSET_TYPE);
  const [targetTools, setTargetTools] = useState<TargetTool[]>(initial?.targetTools ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [variableDefaults, setVariableDefaults] = useState<Record<string, string>>(
    initial?.variableDefaults ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '');
      setContent(initial?.content ?? '');
      setDescription(initial?.description ?? '');
      setFolderId(initial?.folderId ?? SYSTEM_FOLDER_ID);
      setNewFolderName(undefined);
      setTagIds(initial?.tagIds ?? []);
      setNewTagNames([]);
      setType(initial?.type ?? DEFAULT_ASSET_TYPE);
      setTargetTools(initial?.targetTools ?? []);
      setNotes(initial?.notes ?? '');
      setVariableDefaults({ ...initial?.variableDefaults });
      setError(null);
      setSubmitting(false);
    }
  }, [open, initial]);

  const dirty =
    title !== (initial?.title ?? '') ||
    content !== (initial?.content ?? '') ||
    description !== (initial?.description ?? '') ||
    folderId !== (initial?.folderId ?? SYSTEM_FOLDER_ID) ||
    newFolderName !== undefined ||
    tagIds.join(',') !== (initial?.tagIds ?? []).join(',') ||
    newTagNames.length > 0 ||
    type !== (initial?.type ?? DEFAULT_ASSET_TYPE) ||
    targetTools.join(',') !== (initial?.targetTools ?? []).join(',') ||
    notes !== (initial?.notes ?? '') ||
    JSON.stringify(variableDefaults) !== JSON.stringify(initial?.variableDefaults ?? {});

  const variables = useMemo(() => detectVariables(content), [content]);

  useUnsavedGuard(dirty);

  const handleClose = (next: boolean) => {
    if (!next && dirty) {
      if (!confirmDiscard()) return;
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Title is required.');
    if (!content.trim()) return setError('Content is required.');
    setSubmitting(true);
    try {
      const values: PromptCreate = {
        title: title.trim(),
        content,
        description: description.trim() || undefined,
        folderId,
        tagIds,
        type,
        targetTools,
        notes: notes.trim() || undefined,
        variableDefaults,
      };
      if (newFolderName !== undefined) values.newFolderName = newFolderName;
      if (newTagNames.length > 0) values.newTagNames = newTagNames;
      await onSubmit(values);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.repeat && e.key.toLowerCase() === 'enter') {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const toggleTag = (id: string) =>
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const stageTag = (name: string) => {
    const normalizedName = normalizeName(name);
    setNewTagNames((prev) => prev.some((item) => normalizeName(item) === normalizedName) ? prev : [...prev, name]);
  };

  const removeStagedTag = (name: string) => {
    const normalizedName = normalizeName(name);
    setNewTagNames((prev) => prev.filter((item) => normalizeName(item) !== normalizedName));
  };

  const toggleTargetTool = (tool: TargetTool) =>
    setTargetTools((prev) => (prev.includes(tool) ? prev.filter((item) => item !== tool) : [...prev, tool]));

  const setVariableDefault = (name: string, value: string) => {
    setVariableDefaults((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={initial ? 'Edit prompt' : 'New prompt'}
      description={initial ? 'Update your prompt details.' : 'Create a reusable AI prompt.'}
      maxWidthClass="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"
    >
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
        <div>
          <label htmlFor="prompt-title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <Input
            id="prompt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Explain code like I'm five"
            autoFocus
            data-autofocus-safe="true"
          />
        </div>

        <div>
          <label htmlFor="prompt-content" className="mb-1 block text-sm font-medium">
            Content
          </label>
          <Textarea
            id="prompt-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste or write your prompt. Formatting is preserved exactly."
            rows={10}
          />
        </div>

        <div>
          <label htmlFor="prompt-description" className="mb-1 block text-sm font-medium">
            Description <span className="text-neutral-400">(optional)</span>
          </label>
          <Input
            id="prompt-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short note about when to use this"
          />
        </div>

        {variables.length > 0 ? (
          <fieldset className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
            <legend className="px-1 text-sm font-medium">Variable defaults</legend>
            <p className="mb-3 text-xs text-neutral-500">
              Optional values used to prefill the fill dialog. They never change the stored prompt content.
            </p>
            <div className="space-y-3">
              {variables.map((name) => (
                <div key={name}>
                  <label htmlFor={`prompt-variable-default-${name}`} className="mb-1 block text-sm">
                    Default for {name}
                  </label>
                  <Textarea
                    id={`prompt-variable-default-${name}`}
                    value={variableDefaults[name] ?? ''}
                    onChange={(e) => setVariableDefault(name, e.target.value)}
                    placeholder={`Optional default for {{${name}}}`}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="prompt-type" className="mb-1 block text-sm font-medium">
              Type
            </label>
            <select
              id="prompt-type"
              required
              value={type}
              onChange={(e) => setType(e.target.value as AssetType)}
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              {ASSET_TYPES.map((assetType) => (
                <option key={assetType} value={assetType}>
                  {ASSET_TYPE_LABELS[assetType]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prompt-folder" className="mb-1 block text-sm font-medium">
              Folder
            </label>
            <FolderCombobox
              folders={folders}
              selectedId={folderId}
              stagedName={newFolderName}
              onSelect={(id) => {
                setFolderId(id);
                setNewFolderName(undefined);
              }}
              onStage={setNewFolderName}
            />
          </div>

          <div>
            <label htmlFor="prompt-tags" className="mb-1 block text-sm font-medium">Tags</label>
            <TagCombobox
              tags={tags}
              selectedIds={tagIds}
              stagedNames={newTagNames}
              onToggle={toggleTag}
              onStage={stageTag}
              onRemoveStaged={removeStagedTag}
            />
          </div>

          <fieldset className="sm:col-span-2">
            <legend className="mb-1 block text-sm font-medium">
              Target tools <span className="text-neutral-400">(optional)</span>
            </legend>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-neutral-300 p-3 dark:border-neutral-700 sm:grid-cols-4">
              {TARGET_TOOLS.map((tool) => (
                <label
                  key={tool}
                  htmlFor={`prompt-target-tool-${tool}`}
                  className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <input
                    id={`prompt-target-tool-${tool}`}
                    type="checkbox"
                    checked={targetTools.includes(tool)}
                    onChange={() => toggleTargetTool(tool)}
                    className="h-4 w-4 accent-accent-600"
                  />
                  <span>{TARGET_TOOL_LABELS[tool]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="sm:col-span-2">
            <label htmlFor="prompt-notes" className="mb-1 block text-sm font-medium">
              Notes <span className="text-neutral-400">(optional)</span>
            </label>
            <Textarea
              id="prompt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add private usage notes or context"
              rows={3}
            />
          </div>
        </div>

        {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <p className="text-xs text-neutral-400">Tip: Ctrl/⌘ + Enter to save.</p>
      </form>
    </Dialog>
  );
}

