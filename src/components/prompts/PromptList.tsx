import { useMemo } from 'react';
import { useAppState } from '../../hooks/useAppState';
import { usePrompts } from '../../hooks/usePrompts';
import { useFolders } from '../../hooks/useFolders';
import { useTags } from '../../hooks/useTags';
import { useSettings } from '../../hooks/useSettings';
import { PromptCard } from './PromptCard';
import { EmptyState } from './EmptyState';
import { createSearchIndex } from '../../utils/search';
import { sortPrompts } from '../../utils/sort';
import { notify } from '../common/Toast';
import { copyToClipboard } from '../../utils/copy';
import { ASSET_TYPE_LABELS, DEFAULT_ASSET_TYPE, TARGET_TOOL_LABELS } from '../../types/prompt';
import { useBundles } from '../../hooks/useBundles';
import { BundlePanel } from '../bundles/BundlePanel';

export function PromptList() {
  const { view, selectedTagIds, setDialog, setView, clearTagFilters } = useAppState();
  const { prompts, copy, update, duplicate } = usePrompts();
  const { folders } = useFolders();
  const { tags } = useTags();
  const { bundles, reorder } = useBundles();
  const { settings } = useSettings();

  const folderMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const searchIndex = useMemo(
    () => createSearchIndex(prompts, folderMap, tagMap, bundles),
    [prompts, folderMap, tagMap, bundles],
  );
  const searchResults = useMemo(
    () => (view.kind === 'search' ? searchIndex.search(view.query) : []),
    [searchIndex, view],
  );
  const searchMatchesByPromptId = useMemo(
    () => new Map(searchResults.map((result) => [result.prompt.id, result.matches])),
    [searchResults],
  );

  const visible = useMemo(() => {
    let list = prompts;
    if (view.kind === 'favorites') list = list.filter((p) => p.isFavorite);
    else if (view.kind === 'recent') list = sortPrompts(list, 'recently-updated');
    else if (view.kind === 'most-used') list = sortPrompts(list.filter((p) => p.copyCount > 0), 'most-copied');
    else if (view.kind === 'folder') list = list.filter((p) => p.folderId === view.folderId);
    else if (view.kind === 'tag') list = list.filter((p) => p.tagIds.includes(view.tagId));
    else if (view.kind === 'search') list = searchResults.map((result) => result.prompt);
    else if (view.kind === 'type') list = list.filter((p) => (p.type ?? DEFAULT_ASSET_TYPE) === view.type);
    else if (view.kind === 'target-tool') list = list.filter((p) => (p.targetTools ?? []).includes(view.targetTool));

    if (selectedTagIds.length > 0) {
      list = list.filter((p) => selectedTagIds.every((t) => p.tagIds.includes(t)));
    }

    if (settings && view.kind !== 'search' && view.kind !== 'recent' && view.kind !== 'most-used') {
      list = sortPrompts(list, settings.defaultSort);
    }
    return list;
  }, [prompts, view, selectedTagIds, settings, searchResults]);

  if (view.kind === 'bundle') {
    const bundle = bundles.find((item) => item.id === view.bundleId);
    if (!bundle) {
      return (
        <EmptyState
          title="Bundle unavailable"
          description="This bundle no longer exists. Browse all prompts to continue."
          actionLabel="Browse all prompts"
          onAction={() => setView({ kind: 'all' })}
        />
      );
    }
    return (
      <BundlePanel
        bundle={bundle}
        prompts={prompts}
        onOpenPrompt={(id) => setDialog({ kind: 'detail-prompt', promptId: id })}
        onCopyPrompt={async (id) => {
          const prompt = prompts.find((item) => item.id === id);
          if (!prompt) throw new Error('Prompt is no longer available.');
          try {
            await copyToClipboard(prompt.content);
            await copy(id);
            notify.success('Copied to clipboard');
          } catch {
            throw new Error('Failed to copy');
          }
        }}
        onFillPrompt={(id) => setDialog({ kind: 'fill-prompt', promptId: id })}
        onReorder={async (promptIds) => {
          await reorder(bundle.id, promptIds);
          notify.success('Bundle order updated');
        }}
        onEdit={() => setDialog({ kind: 'edit-bundle', bundleId: bundle.id })}
      />
    );
  }

  const emptyState = (() => {
    if (selectedTagIds.length > 0) {
      return {
        title: 'No prompts match the selected tags',
        description: 'Clear the tag filters or choose a different view.',
        actionLabel: 'Clear tag filters',
        onAction: clearTagFilters,
      };
    }

    switch (view.kind) {
      case 'favorites':
        return {
          title: 'No favorite prompts',
          description: 'Mark a prompt as a favorite to find it here.',
          actionLabel: 'Browse all prompts',
          onAction: () => setView({ kind: 'all' }),
        };
      case 'recent':
        return {
          title: 'No recent prompts',
          description: 'Updated prompts will appear here.',
          actionLabel: 'Browse all prompts',
          onAction: () => setView({ kind: 'all' }),
        };
      case 'most-used':
        return {
          title: 'No most-used prompts',
          description: 'Copy a prompt to see it in this view.',
          actionLabel: 'Browse all prompts',
          onAction: () => setView({ kind: 'all' }),
        };
      case 'folder':
        return {
          title: `No prompts in ${folderMap.get(view.folderId)?.name ?? 'this folder'}`,
          description: 'Create a prompt or browse another folder.',
          actionLabel: 'Browse all prompts',
          onAction: () => setView({ kind: 'all' }),
        };
      case 'tag':
        return {
          title: `No prompts tagged #${tagMap.get(view.tagId)?.name ?? 'this tag'}`,
          description: 'Add this tag to a prompt or browse all prompts.',
          actionLabel: 'Browse all prompts',
          onAction: () => setView({ kind: 'all' }),
        };
      case 'search':
        return {
          title: 'No prompts found',
          description: `No prompts match “${view.query}”. Try a different search or clear it.`,
          actionLabel: 'Clear search',
          onAction: () => setView({ kind: 'all' }),
        };
      case 'type':
        return {
          title: `No prompts of type ${ASSET_TYPE_LABELS[view.type]}`,
          description: 'Choose another type or browse all prompts.',
          actionLabel: 'Browse all prompts',
          onAction: () => setView({ kind: 'all' }),
        };
      case 'target-tool':
        return {
          title: `No prompts targeting ${TARGET_TOOL_LABELS[view.targetTool]}`,
          description: 'Choose another target tool or browse all prompts.',
          actionLabel: 'Browse all prompts',
          onAction: () => setView({ kind: 'all' }),
        };
      case 'all':
        return {
          title: 'No prompts yet',
          description: 'Create your first prompt to start building your library.',
          actionLabel: 'New prompt',
          onAction: () => setDialog({ kind: 'new-prompt' }),
        };
    }
  })();

  const handleCopy = async (id: string) => {
    const prompt = prompts.find((p) => p.id === id);
    if (!prompt) return;
    try {
      await copyToClipboard(prompt.content);
      await copy(id);
      notify.success('Copied to clipboard');
    } catch {
      notify.error('Failed to copy');
    }
  };

  if (visible.length === 0) {
    return <EmptyState {...emptyState} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((p) => (
        <PromptCard
          key={p.id}
          prompt={p}
          searchMatches={searchMatchesByPromptId.get(p.id)}
          folder={folderMap.get(p.folderId)}
          tags={p.tagIds.map((id) => tagMap.get(id)).filter((t): t is NonNullable<typeof t> => Boolean(t))}
          onOpen={(id) => setDialog({ kind: 'detail-prompt', promptId: id })}
          onCopy={handleCopy}
          onEdit={(id) => setDialog({ kind: 'edit-prompt', promptId: id })}
          onDuplicate={async (id) => {
            await duplicate(id);
            notify.success('Prompt duplicated');
          }}
          onDelete={(id) => setDialog({ kind: 'delete-prompt', promptId: id })}
          onMove={(id) => setDialog({ kind: 'move-prompt', promptId: id })}
          onHistory={(id) => setDialog({ kind: 'history-prompt', promptId: id })}
          onFill={(id) => setDialog({ kind: 'fill-prompt', promptId: id })}
          onToggleFavorite={async (id, value) => {
            await update(id, { isFavorite: value });
          }}
        />
      ))}
    </div>
  );
}
