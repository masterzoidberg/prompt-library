import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getSettings, saveSettings } from '../data/settingsRepository';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { Settings } from '../types/settings';
import type { InterfaceFontFamily, PromptFontFamily, PromptLineSpacing } from '../types/settings';
import { SettingsContext } from './settingsContext';

const FONT_STACKS: Record<InterfaceFontFamily, string> = {
  'system-sans':
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  monospace:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

const PROMPT_LINE_HEIGHTS: Record<PromptLineSpacing, string> = {
  compact: '1.25',
  normal: '1.5',
  relaxed: '1.75',
};

function fontStack(family: PromptFontFamily, interfaceFamily: InterfaceFontFamily): string {
  return FONT_STACKS[family === 'same-as-interface' ? interfaceFamily : family];
}

function toError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await getSettings();
      setSettings(loaded);
      setError(null);
    } catch (cause) {
      const loadError = toError(cause, 'Failed to load settings');
      setSettings(DEFAULT_SETTINGS);
      setError(loadError);
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings().catch(() => undefined);
  }, [loadSettings]);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const properties = [
      '--interface-font-family',
      '--interface-font-size',
      '--prompt-font-family',
      '--prompt-font-size',
      '--prompt-line-height',
    ];
    const previous = new Map(properties.map((property) => [property, root.style.getPropertyValue(property)]));
    root.style.setProperty('--interface-font-family', FONT_STACKS[settings.interfaceFontFamily]);
    root.style.setProperty('--interface-font-size', `${settings.interfaceFontSize}px`);
    root.style.setProperty('--prompt-font-family', fontStack(settings.promptFontFamily, settings.interfaceFontFamily));
    root.style.setProperty('--prompt-font-size', `${settings.promptFontSize}px`);
    root.style.setProperty('--prompt-line-height', PROMPT_LINE_HEIGHTS[settings.promptLineSpacing]);
    return () => {
      for (const [property, value] of previous) {
        if (value) root.style.setProperty(property, value);
        else root.style.removeProperty(property);
      }
    };
  }, [settings]);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...(settings ?? DEFAULT_SETTINGS), ...patch };
      try {
        const saved = await saveSettings(next);
        setSettings(saved);
        setError(null);
        return saved;
      } catch (cause) {
        const saveError = toError(cause, 'Failed to save settings');
        setError(saveError);
        throw saveError;
      }
    },
    [settings],
  );

  const reload = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  const value = useMemo(
    () => ({ settings, loading, error, update, reload }),
    [settings, loading, error, update, reload],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
