import { useAppState } from '../../hooks/useAppState';
import { usePrompts } from '../../hooks/usePrompts';
import { useFolders } from '../../hooks/useFolders';
import { useTags } from '../../hooks/useTags';
import { PromptFormDialog } from './PromptFormDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { MoveToFolderDialog } from './MoveToFolderDialog';
import { FillPromptDialog } from './FillPromptDialog';
import { PromptDetailDialog } from './PromptDetailDialog';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { BundleDialog } from '../bundles/BundleDialog';
import { notify } from '../common/Toast';
import { SYSTEM_FOLDER_ID } from '../../config/constants';
import * as folderRepo from '../../data/folderRepository';
import * as tagRepo from '../../data/tagRepository';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useEffect, useRef, useState } from 'react';
import { SettingsDialog } from '../settings/SettingsDialog';
import { useSettings } from '../../hooks/useSettings';
import { copyToClipboard } from '../../utils/copy';
import { useBundles } from '../../hooks/useBundles';

export function DialogRouter() {
  const { dialog, setDialog, view, setView } = useAppState();
  const { prompts, create, update, remove, copy, restoreVersion, duplicateVersion } = usePrompts();
  const { bundles, create: createBundle, update: updateBundle, remove: removeBundle } = useBundles();
  const { folders, create: createFolder, update: updateFolder, remove: removeFolder } = useFolders();
  const { tags, create: createTag, update: updateTag, remove: removeTag } = useTags();
  const { settings } = useSettings();
  const confirmBeforeDelete = settings?.confirmBeforeDelete ?? true;

  const open = dialog.kind !== 'none';
  const close = () => setDialog({ kind: 'none' });

  switch (dialog.kind) {
    case 'new-prompt':
      return (
        <PromptFormDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          onSubmit={async (values) => {
            await create(values as Parameters<typeof create>[0]);
            notify.success('Prompt created');
          }}
        />
      );
    case 'edit-prompt': {
      const prompt = prompts.find((p) => p.id === dialog.promptId);
      if (!prompt) return null;
      return (
        <PromptFormDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          initial={prompt}
          onSubmit={async (values) => {
            await update(prompt.id, values);
            notify.success('Prompt updated');
          }}
        />
      );
    }
    case 'detail-prompt': {
      const prompt = prompts.find((p) => p.id === dialog.promptId);
      if (!prompt) return null;
      return (
        <PromptDetailDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          prompt={prompt}
          folder={folders.find((folder) => folder.id === prompt.folderId)}
          tags={prompt.tagIds.map((id) => tags.find((tag) => tag.id === id)).filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))}
          bundles={bundles.filter((bundle) => bundle.promptIds.includes(prompt.id))}
          onCopy={async () => {
            try {
              await copyToClipboard(prompt.content);
              await copy(prompt.id);
              notify.success('Copied to clipboard');
            } catch {
              throw new Error('Failed to copy');
            }
          }}
          onFill={() => setDialog({ kind: 'fill-prompt', promptId: prompt.id })}
          onEdit={() => setDialog({ kind: 'edit-prompt', promptId: prompt.id })}
          onHistory={() => setDialog({ kind: 'history-prompt', promptId: prompt.id })}
          onOpenBundle={(bundleId) => {
            close();
            setView({ kind: 'bundle', bundleId });
          }}
        />
      );
    }
    case 'delete-prompt': {
      const prompt = prompts.find((p) => p.id === dialog.promptId);
      if (!prompt) return null;
      if (!confirmBeforeDelete) {
        return (
          <ImmediateDelete
            action={() => remove(prompt.id)}
            successMessage="Prompt deleted"
            onComplete={close}
          />
        );
      }
      return (
        <ConfirmDeleteDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          title="Delete prompt?"
          description={<>“{prompt.title}” will be permanently deleted.</>}
          onConfirm={async () => {
            await remove(prompt.id);
            notify.success('Prompt deleted');
          }}
        />
      );
    }
    case 'move-prompt': {
      const prompt = prompts.find((p) => p.id === dialog.promptId);
      if (!prompt) return null;
      return (
        <MoveToFolderDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          currentFolderId={prompt.folderId}
          onMove={async (folderId) => {
            const target = folderId || SYSTEM_FOLDER_ID;
            await update(prompt.id, { folderId: target });
            const f = folders.find((x) => x.id === target);
            notify.success(`Moved to ${f?.name ?? 'Unfiled'}`);
          }}
        />
      );
    }
    case 'fill-prompt': {
      const prompt = prompts.find((p) => p.id === dialog.promptId);
      if (!prompt) return null;
      return (
        <FillPromptDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          prompt={prompt}
          onCopy={async (id, content) => {
            try {
              await copyToClipboard(content);
              await copy(id);
              notify.success('Copied rendered prompt');
            } catch (cause) {
              const error = cause instanceof Error ? cause : new Error('Failed to copy rendered prompt');
              notify.error(error.message);
              throw error;
            }
          }}
        />
      );
    }
    case 'history-prompt': {
      const prompt = prompts.find((p) => p.id === dialog.promptId);
      if (!prompt) return null;
      return (
        <VersionHistoryDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          prompt={prompt}
          onCopy={async (id, content) => {
            try {
              await copyToClipboard(content);
              await copy(id);
              notify.success('Copied version');
            } catch (cause) {
              const error = cause instanceof Error ? cause : new Error('Failed to copy version');
              notify.error(error.message);
              throw error;
            }
          }}
          onDuplicate={async (id, versionId) => {
            const duplicate = await duplicateVersion(id, versionId);
            notify.success(`Duplicated “${duplicate.title}”`);
          }}
          onRestore={async (id, versionId) => {
            await restoreVersion(id, versionId);
            notify.success('Prompt restored');
          }}
        />
      );
    }
    case 'new-bundle':
      return (
        <BundleDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          prompts={prompts}
          onSubmit={async (values) => {
            await createBundle(values);
            notify.success('Bundle created');
          }}
        />
      );
    case 'edit-bundle': {
      const bundle = bundles.find((item) => item.id === dialog.bundleId);
      if (!bundle) return null;
      return (
        <BundleDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          prompts={prompts}
          initial={bundle}
          onSubmit={async (values) => {
            await updateBundle(bundle.id, values);
            notify.success('Bundle updated');
          }}
        />
      );
    }
    case 'delete-bundle': {
      const bundle = bundles.find((item) => item.id === dialog.bundleId);
      if (!bundle) return null;
      const afterDelete = () => {
        if (view.kind === 'bundle' && view.bundleId === bundle.id) setView({ kind: 'all' });
        close();
      };
      if (!confirmBeforeDelete) {
        return (
          <ImmediateDelete
            action={() => removeBundle(bundle.id)}
            successMessage="Bundle deleted"
            onComplete={afterDelete}
          />
        );
      }
      return (
        <ConfirmDeleteDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          title="Delete bundle?"
          description={<>“{bundle.name}” will be deleted. Its prompts will remain in your library.</>}
          onConfirm={async () => {
            await removeBundle(bundle.id);
            afterDelete();
            notify.success('Bundle deleted');
          }}
        />
      );
    }
    case 'new-folder':
      return (
        <NameDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          title="New folder"
          label="Folder name"
          onSubmit={async (name) => {
            try {
              await createFolder({ name });
              notify.success('Folder created');
            } catch (err) {
              if (err instanceof folderRepo.FolderNameConflictError)
                throw new Error('A folder with that name already exists.');
              throw err;
            }
          }}
        />
      );
    case 'rename-folder': {
      const folder = folders.find((f) => f.id === dialog.folderId);
      if (!folder) return null;
      return (
        <NameDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          title="Rename folder"
          label="Folder name"
          initial={folder.name}
          onSubmit={async (name) => {
            try {
              await updateFolder(folder.id, { name });
              notify.success('Folder renamed');
            } catch (err) {
              if (err instanceof folderRepo.FolderNameConflictError)
                throw new Error('A folder with that name already exists.');
              throw err;
            }
          }}
        />
      );
    }
    case 'delete-folder': {
      const folder = folders.find((f) => f.id === dialog.folderId);
      if (!folder) return null;
      if (!confirmBeforeDelete) {
        return (
          <ImmediateDelete
            action={() => removeFolder(folder.id)}
            successMessage="Folder deleted"
            onComplete={close}
          />
        );
      }
      return (
        <ConfirmDeleteDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          title="Delete folder?"
          description={
            <>
              “{folder.name}” will be deleted. Prompts in this folder will move to{' '}
              <strong>Unfiled</strong>.
            </>
          }
          onConfirm={async () => {
            await removeFolder(folder.id);
            notify.success('Folder deleted');
          }}
        />
      );
    }
    case 'new-tag':
      return (
        <NameDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          title="New tag"
          label="Tag name"
          onSubmit={async (name) => {
            try {
              await createTag({ name });
              notify.success('Tag created');
            } catch (err) {
              if (err instanceof tagRepo.TagNameConflictError)
                throw new Error('A tag with that name already exists.');
              throw err;
            }
          }}
        />
      );
    case 'rename-tag': {
      const tag = tags.find((t) => t.id === dialog.tagId);
      if (!tag) return null;
      return (
        <NameDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          title="Rename tag"
          label="Tag name"
          initial={tag.name}
          onSubmit={async (name) => {
            try {
              await updateTag(tag.id, { name });
              notify.success('Tag renamed');
            } catch (err) {
              if (err instanceof tagRepo.TagNameConflictError)
                throw new Error('A tag with that name already exists.');
              throw err;
            }
          }}
        />
      );
    }
    case 'delete-tag': {
      const tag = tags.find((t) => t.id === dialog.tagId);
      if (!tag) return null;
      if (!confirmBeforeDelete) {
        return (
          <ImmediateDelete
            action={() => removeTag(tag.id)}
            successMessage="Tag deleted"
            onComplete={close}
          />
        );
      }
      return (
        <ConfirmDeleteDialog
          open={open}
          onOpenChange={(o) => (o ? null : close())}
          title="Delete tag?"
          description={
            <>“#{tag.name}” will be removed from any prompts that use it.</>
          }
          onConfirm={async () => {
            await removeTag(tag.id);
            notify.success('Tag deleted');
          }}
        />
      );
    }
    case 'settings':
      return <SettingsDialog open={open} onOpenChange={(o) => (o ? null : close())} />;
    default:
      return null;
  }
}

function ImmediateDelete({
  action,
  successMessage,
  onComplete,
}: {
  action: () => Promise<void>;
  successMessage: string;
  onComplete: () => void;
}) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void action()
      .then(() => notify.success(successMessage))
      .catch((cause) => notify.error(cause instanceof Error ? cause.message : 'Delete failed'))
      .finally(onComplete);
  }, [action, onComplete, successMessage]);

  return <p role="status" className="sr-only">Deleting…</p>;
}

interface NameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  initial?: string;
  onSubmit: (name: string) => Promise<void>;
}

function NameDialog({ open, onOpenChange, title, label, initial = '', onSubmit }: NameDialogProps) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(name.trim());
      setName('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium">
          {label}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="mt-1"
          />
        </label>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
