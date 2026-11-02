import { Plus, Search, Menu, ArrowUpDown, Filter } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Dropdown, DropdownItem, DropdownLabel } from '../common/Dropdown';
import { useAppState } from '../../hooks/useAppState';
import { useSettings } from '../../hooks/useSettings';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import type { SortKey } from '../../types/settings';
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  TARGET_TOOLS,
  TARGET_TOOL_LABELS,
} from '../../types/prompt';

interface TopBarProps {
  onToggleSidebar: () => void;
}

const SORT_LABELS: Record<SortKey, string> = {
  'recently-updated': 'Recently updated',
  'recently-created': 'Recently created',
  alphabetical: 'Alphabetical',
  'most-copied': 'Most frequently copied',
};

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { view, setView, setDialog } = useAppState();
  const { settings, update } = useSettings();
  const query = view.kind === 'search' ? view.query : '';
  const sort = settings?.defaultSort ?? 'recently-updated';
  const metadataFilterLabel =
    view.kind === 'type'
      ? `Type: ${ASSET_TYPE_LABELS[view.type]}`
      : view.kind === 'target-tool'
        ? `Target: ${TARGET_TOOL_LABELS[view.targetTool]}`
        : null;

  const handleSortChange = async (next: SortKey) => {
    await update({ defaultSort: next });
  };

  return (
    <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 border-b border-neutral-200 bg-white pb-2 pl-[calc(env(safe-area-inset-left)+0.75rem)] pr-[calc(env(safe-area-inset-right)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)] dark:border-neutral-800 dark:bg-neutral-900 md:flex md:h-14 md:gap-2 md:px-3 md:py-0">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        className="col-start-1 row-start-1 lg:hidden"
        onClick={onToggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="col-start-2 row-start-1 min-w-0 truncate text-base font-semibold md:hidden">Prompt Library</h1>
      <div className="relative col-span-3 row-start-2 min-w-0 md:col-auto md:row-auto md:flex-1 md:max-w-xl">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        />
        <Input
          type="search"
          placeholder="Search prompts (press /)"
          aria-label="Search prompts"
          className="pl-9"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            if (v) setView({ kind: 'search', query: v });
            else setView({ kind: 'all' });
          }}
        />
      </div>
      <div className="col-span-2 row-start-3 flex items-center gap-2 md:contents">
        <Dropdown
          trigger={
            <Button variant="ghost" aria-label="Filter prompts">
              <Filter className="h-4 w-4" />
              <span className="md:hidden">Filter</span>
              <span className="hidden md:inline">{metadataFilterLabel ?? 'Filter'}</span>
            </Button>
          }
        >
          <DropdownLabel>Filter by type</DropdownLabel>
          {ASSET_TYPES.map((type) => (
            <DropdownItem key={type} onSelect={() => setView({ kind: 'type', type })}>
              {ASSET_TYPE_LABELS[type]}
            </DropdownItem>
          ))}
          <DropdownLabel>Filter by target tool</DropdownLabel>
          {TARGET_TOOLS.map((targetTool) => (
            <DropdownItem key={targetTool} onSelect={() => setView({ kind: 'target-tool', targetTool })}>
              {TARGET_TOOL_LABELS[targetTool]}
            </DropdownItem>
          ))}
          {metadataFilterLabel ? (
            <DropdownItem onSelect={() => setView({ kind: 'all' })}>Clear filter</DropdownItem>
          ) : null}
        </Dropdown>
        <Dropdown
          trigger={
            <Button variant="ghost" aria-label="Change sort order">
              <ArrowUpDown className="h-4 w-4" />
              <span className="md:hidden">Sort</span>
              <span className="hidden md:inline">{SORT_LABELS[sort]}</span>
            </Button>
          }
        >
          <DropdownLabel>Sort by</DropdownLabel>
          {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
            <DropdownItem key={key} onSelect={() => handleSortChange(key)}>
              <span className={sort === key ? 'font-semibold text-accent-700 dark:text-accent-300' : ''}>
                {label}
              </span>
            </DropdownItem>
          ))}
        </Dropdown>
      </div>
      <div className="hidden md:block">
        <KeyboardShortcutsHelp />
      </div>
      <div className="col-start-3 row-start-3 ml-auto md:ml-auto">
        <Button variant="primary" onClick={() => setDialog({ kind: 'new-prompt' })}>
          <Plus className="h-4 w-4" />
          <span>New prompt</span>
        </Button>
      </div>
    </header>
  );
}
