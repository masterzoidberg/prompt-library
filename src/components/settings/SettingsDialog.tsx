import { useEffect, useState } from 'react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { useSettings } from '../../hooks/useSettings';
import { notify } from '../common/Toast';
import { ImportExportPanel } from './ImportExportPanel';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, update } = useSettings();
  const [theme, setTheme] = useState(settings?.theme ?? 'system');
  const [sort, setSort] = useState(settings?.defaultSort ?? 'recently-updated');
  const [confirmDelete, setConfirmDelete] = useState(settings?.confirmBeforeDelete ?? true);

  useEffect(() => {
    if (!settings) return;
    setTheme(settings.theme);
    setSort(settings.defaultSort);
    setConfirmDelete(settings.confirmBeforeDelete);
  }, [settings]);

  if (!settings) return null;

  const rememberedCount = Object.keys(settings.rememberedVariableValues ?? {}).length;

  const handleSave = async () => {
    try {
      await update({
        theme,
        defaultSort: sort,
        confirmBeforeDelete: confirmDelete,
      });
      notify.success('Settings saved');
      onOpenChange(false);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save settings');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Settings">
      <div className="space-y-4">
        <div>
          <label htmlFor="settings-theme" className="mb-1 block text-sm font-medium">
            Theme
          </label>
          <select
            id="settings-theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as typeof theme)}
            className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div>
          <label htmlFor="settings-sort" className="mb-1 block text-sm font-medium">
            Default sort
          </label>
          <select
            id="settings-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="recently-updated">Recently updated</option>
            <option value="recently-created">Recently created</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="most-copied">Most frequently copied</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 accent-accent-600"
          />
          Confirm before deleting
        </label>

        {rememberedCount > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
            <div>
              <p className="text-sm font-medium">Remembered variable values</p>
              <p className="text-xs text-neutral-500">
                {rememberedCount} value{rememberedCount === 1 ? '' : 's'} stored locally.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                void update({ rememberedVariableValues: {} })
                  .then(() => notify.success('Remembered values cleared'))
                  .catch((error) =>
                    notify.error(error instanceof Error ? error.message : 'Failed to clear remembered values'),
                  );
              }}
            >
              Clear
            </Button>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
      <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <ImportExportPanel />
      </div>
    </Dialog>
  );
}
