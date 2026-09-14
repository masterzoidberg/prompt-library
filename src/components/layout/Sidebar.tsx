import { useMemo, useState } from 'react';
import { Folder, Tag as TagIcon, Star, Inbox, Clock, TrendingUp, ListOrdered, Settings as SettingsIcon, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useFolders } from '../../hooks/useFolders';
import { usePrompts } from '../../hooks/usePrompts';
import { useTags } from '../../hooks/useTags';
import { useBundles } from '../../hooks/useBundles';
import { useAppState } from '../../hooks/useAppState';
import { SYSTEM_FOLDER_ID } from '../../config/constants';
import { Button } from '../common/Button';
import { Dropdown, DropdownItem } from '../common/Dropdown';

export function Sidebar() {
  const { folders } = useFolders();
  const { prompts } = usePrompts();
  const { tags } = useTags();
  const { bundles } = useBundles();
  const { view, setView, setDialog } = useAppState();

  const folderCounts = useMemo(() => {
    const counts = new Map(folders.map((folder) => [folder.id, 0]));
    for (const prompt of prompts) {
      counts.set(prompt.folderId, (counts.get(prompt.folderId) ?? 0) + 1);
    }
    return counts;
  }, [folders, prompts]);

  const sortedFolders = useMemo(
    () =>
      [...folders].sort((a, b) => {
        if (a.id === SYSTEM_FOLDER_ID) return -1;
        if (b.id === SYSTEM_FOLDER_ID) return 1;
        return a.name.localeCompare(b.name);
      }),
    [folders],
  );

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="px-4 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Prompt Library</h1>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-4" aria-label="Library navigation">
        <SidebarSection label="Library">
          <NavItem
            icon={<Inbox className="h-4 w-4" />}
            label="All Prompts"
            active={view.kind === 'all'}
            onClick={() => setView({ kind: 'all' })}
          />
          <NavItem
            icon={<Star className="h-4 w-4" />}
            label="Favorites"
            active={view.kind === 'favorites'}
            onClick={() => setView({ kind: 'favorites' })}
          />
          <NavItem
            icon={<Clock className="h-4 w-4" />}
            label="Recent"
            active={view.kind === 'recent'}
            onClick={() => setView({ kind: 'recent' })}
          />
          <NavItem
            icon={<TrendingUp className="h-4 w-4" />}
            label="Most Used"
            active={view.kind === 'most-used'}
            onClick={() => setView({ kind: 'most-used' })}
          />
        </SidebarSection>

        <SidebarSection
          label="Folders"
          action={
            <Button
              size="icon"
              variant="ghost"
              aria-label="New folder"
              onClick={() => setDialog({ kind: 'new-folder' })}
            >
              <Plus className="h-4 w-4" />
            </Button>
          }
        >
          {sortedFolders.map((f) => (
              <FolderRow
                key={f.id}
                id={f.id}
                name={f.name}
                isSystem={f.id === SYSTEM_FOLDER_ID}
                active={view.kind === 'folder' && view.folderId === f.id}
                count={folderCounts.get(f.id) ?? 0}
                onClick={() => setView({ kind: 'folder', folderId: f.id })}
                onRename={() => setDialog({ kind: 'rename-folder', folderId: f.id })}
                onDelete={() => setDialog({ kind: 'delete-folder', folderId: f.id })}
              />
            ))}
        </SidebarSection>

        <SidebarSection
          label="Tags"
          action={
            <Button
              size="icon"
              variant="ghost"
              aria-label="New tag"
              onClick={() => setDialog({ kind: 'new-tag' })}
            >
              <Plus className="h-4 w-4" />
            </Button>
          }
        >
          {tags.length === 0 ? (
            <p className="px-2 py-1 text-xs text-neutral-500">No tags yet.</p>
          ) : (
            tags.map((t) => (
              <TagRow
                key={t.id}
                name={t.name}
                onClick={() => setView({ kind: 'tag', tagId: t.id })}
                onRename={() => setDialog({ kind: 'rename-tag', tagId: t.id })}
                onDelete={() => setDialog({ kind: 'delete-tag', tagId: t.id })}
              />
            ))
          )}
        </SidebarSection>

        <SidebarSection
          label="Bundles"
          action={
            <Button
              size="icon"
              variant="ghost"
              aria-label="New bundle"
              onClick={() => setDialog({ kind: 'new-bundle' })}
            >
              <Plus className="h-4 w-4" />
            </Button>
          }
        >
          {bundles.length === 0 ? (
            <p className="px-2 py-1 text-xs text-neutral-500">No bundles yet.</p>
          ) : (
            bundles.map((bundle) => (
              <BundleRow
                key={bundle.id}
                bundle={bundle}
                active={view.kind === 'bundle' && view.bundleId === bundle.id}
                onClick={() => setView({ kind: 'bundle', bundleId: bundle.id })}
                onEdit={() => setDialog({ kind: 'edit-bundle', bundleId: bundle.id })}
                onDelete={() => setDialog({ kind: 'delete-bundle', bundleId: bundle.id })}
              />
            ))
          )}
        </SidebarSection>
      </nav>

      <div className="border-t border-neutral-200 p-2 dark:border-neutral-800">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => setDialog({ kind: 'settings' })}
        >
          <SettingsIcon className="h-4 w-4" />
          <span>Settings</span>
        </Button>
      </div>
    </aside>
  );
}

function SidebarSection({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <span>{label}</span>
        {action}
      </div>
      <ul className="mt-1 space-y-0.5">{children}</ul>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
          active
            ? 'bg-accent-100 text-accent-900 dark:bg-accent-900/30 dark:text-accent-100'
            : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
        }`}
      >
        {icon}
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}

function FolderRow({
  id: _id,
  name,
  isSystem,
  active,
  count,
  onClick,
  onRename,
  onDelete,
}: {
  id: string;
  name: string;
  isSystem: boolean;
  active: boolean;
  count: number;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <li
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group"
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={onClick}
          aria-current={active ? 'page' : undefined}
          className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
            active
              ? 'bg-accent-100 text-accent-900 dark:bg-accent-900/30 dark:text-accent-100'
              : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <Folder className="h-4 w-4" />
          <span className="truncate">{name}</span>
        </button>
        <span
          aria-label={`${count} ${count === 1 ? 'prompt' : 'prompts'}`}
          className="shrink-0 px-1 text-xs text-neutral-500"
        >
          {count}
        </span>
        {!isSystem && (hover || active) ? (
          <Dropdown
            trigger={
              <button
                type="button"
                aria-label={`Folder options for ${name}`}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          >
            <DropdownItem onSelect={onRename}>
              <Pencil className="h-4 w-4" /> Rename
            </DropdownItem>
            <DropdownItem onSelect={onDelete} destructive>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownItem>
          </Dropdown>
        ) : null}
      </div>
    </li>
  );
}

function TagRow({
  name,
  onClick,
  onRename,
  onDelete,
}: {
  name: string;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onClick}
          className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <TagIcon className="h-4 w-4" />
          <span className="truncate">{name}</span>
        </button>
        <Dropdown
          trigger={
            <button
              type="button"
              aria-label={`Tag options for ${name}`}
              className="rounded-md p-1 text-neutral-500 opacity-0 hover:bg-neutral-200 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-neutral-700"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        >
          <DropdownItem onSelect={onRename}>
            <Pencil className="h-4 w-4" /> Rename
          </DropdownItem>
          <DropdownItem onSelect={onDelete} destructive>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownItem>
        </Dropdown>
      </div>
    </li>
  );
}

function BundleRow({
  bundle,
  active,
  onClick,
  onEdit,
  onDelete,
}: {
  bundle: { id: string; name: string; promptIds: string[] };
  active: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onClick}
          aria-current={active ? 'page' : undefined}
          className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
            active
              ? 'bg-accent-100 text-accent-900 dark:bg-accent-900/30 dark:text-accent-100'
              : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <ListOrdered className="h-4 w-4" />
          <span className="truncate">{bundle.name}</span>
        </button>
        <span
          aria-label={`${bundle.promptIds.length} ${bundle.promptIds.length === 1 ? 'prompt' : 'prompts'} in bundle`}
          className="shrink-0 px-1 text-xs text-neutral-500"
        >
          {bundle.promptIds.length}
        </span>
        <Dropdown
          trigger={
            <button
              type="button"
              aria-label={`Bundle options for ${bundle.name}`}
              className="rounded-md p-1 text-neutral-500 opacity-0 hover:bg-neutral-200 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-neutral-700"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        >
          <DropdownItem onSelect={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </DropdownItem>
          <DropdownItem onSelect={onDelete} destructive>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownItem>
        </Dropdown>
      </div>
    </li>
  );
}
