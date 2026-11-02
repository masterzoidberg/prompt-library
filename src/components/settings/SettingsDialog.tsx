import { useEffect, useState } from 'react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { useSettings } from '../../hooks/useSettings';
import { notify } from '../common/Toast';
import { ImportExportPanel } from './ImportExportPanel';
import { DEFAULT_SETTINGS } from '../../types/settings';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, update } = useSettings();
  const [theme, setTheme] = useState(settings?.theme ?? 'system');
  const [sort, setSort] = useState(settings?.defaultSort ?? 'recently-updated');
  const [confirmDelete, setConfirmDelete] = useState(settings?.confirmBeforeDelete ?? true);
  const [interfaceFontFamily, setInterfaceFontFamily] = useState(settings?.interfaceFontFamily ?? 'system-sans');
  const [interfaceFontSize, setInterfaceFontSize] = useState(settings?.interfaceFontSize ?? 16);
  const [promptFontFamily, setPromptFontFamily] = useState(settings?.promptFontFamily ?? 'monospace');
  const [promptFontSize, setPromptFontSize] = useState(settings?.promptFontSize ?? 14);
  const [promptLineSpacing, setPromptLineSpacing] = useState(settings?.promptLineSpacing ?? 'normal');

  useEffect(() => {
    if (!settings || !open) return;
    setTheme(settings.theme);
    setSort(settings.defaultSort);
    setConfirmDelete(settings.confirmBeforeDelete);
    setInterfaceFontFamily(settings.interfaceFontFamily);
    setInterfaceFontSize(settings.interfaceFontSize);
    setPromptFontFamily(settings.promptFontFamily);
    setPromptFontSize(settings.promptFontSize);
    setPromptLineSpacing(settings.promptLineSpacing);
  }, [settings, open]);

  if (!settings) return null;

  const rememberedCount = Object.keys(settings.rememberedVariableValues ?? {}).length;

  const handleSave = async () => {
    try {
      await update({
        theme,
        defaultSort: sort,
        confirmBeforeDelete: confirmDelete,
        interfaceFontFamily,
        interfaceFontSize,
        promptFontFamily,
        promptFontSize,
        promptLineSpacing,
      });
      notify.success('Settings saved');
      onOpenChange(false);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save settings');
    }
  };

  const resetTypography = () => {
    setInterfaceFontFamily(DEFAULT_SETTINGS.interfaceFontFamily);
    setInterfaceFontSize(DEFAULT_SETTINGS.interfaceFontSize);
    setPromptFontFamily(DEFAULT_SETTINGS.promptFontFamily);
    setPromptFontSize(DEFAULT_SETTINGS.promptFontSize);
    setPromptLineSpacing(DEFAULT_SETTINGS.promptLineSpacing);
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
            className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900 lg:h-10"
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
            className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900 lg:h-10"
          >
            <option value="recently-updated">Recently updated</option>
            <option value="recently-created">Recently created</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="most-copied">Most frequently copied</option>
          </select>
        </div>

        <fieldset className="space-y-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-base font-semibold">Typography</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-interface-font" className="mb-1 block text-sm font-medium">
                Interface font
              </label>
              <select
                id="settings-interface-font"
                value={interfaceFontFamily}
                onChange={(event) => setInterfaceFontFamily(event.target.value as typeof interfaceFontFamily)}
                className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900 lg:h-10"
              >
                <option value="system-sans">System Sans</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>

            <div>
              <label htmlFor="settings-interface-size" className="mb-1 block text-sm font-medium">
                Interface size
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="settings-interface-size"
                  type="range"
                  min={13}
                  max={20}
                  step={1}
                  value={interfaceFontSize}
                  onChange={(event) => setInterfaceFontSize(Number(event.target.value))}
                  className="h-11 min-w-0 flex-1 accent-accent-600"
                />
                <output id="settings-interface-size-value" htmlFor="settings-interface-size" className="w-12 text-right text-sm tabular-nums">
                  {interfaceFontSize}px
                </output>
              </div>
            </div>

            <div>
              <label htmlFor="settings-prompt-font" className="mb-1 block text-sm font-medium">
                Prompt font
              </label>
              <select
                id="settings-prompt-font"
                value={promptFontFamily}
                onChange={(event) => setPromptFontFamily(event.target.value as typeof promptFontFamily)}
                className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900 lg:h-10"
              >
                <option value="same-as-interface">Same as interface</option>
                <option value="system-sans">System Sans</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>

            <div>
              <label htmlFor="settings-prompt-size" className="mb-1 block text-sm font-medium">
                Prompt size
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="settings-prompt-size"
                  type="range"
                  min={12}
                  max={24}
                  step={1}
                  value={promptFontSize}
                  onChange={(event) => setPromptFontSize(Number(event.target.value))}
                  className="h-11 min-w-0 flex-1 accent-accent-600"
                />
                <output id="settings-prompt-size-value" htmlFor="settings-prompt-size" className="w-12 text-right text-sm tabular-nums">
                  {promptFontSize}px
                </output>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="settings-prompt-spacing" className="mb-1 block text-sm font-medium">
                Prompt spacing
              </label>
              <select
                id="settings-prompt-spacing"
                value={promptLineSpacing}
                onChange={(event) => setPromptLineSpacing(event.target.value as typeof promptLineSpacing)}
                className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900 lg:h-10"
              >
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="relaxed">Relaxed</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={resetTypography}>
              Reset typography
            </Button>
          </div>
        </fieldset>

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
