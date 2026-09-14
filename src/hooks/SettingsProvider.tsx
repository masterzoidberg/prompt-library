import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getSettings, saveSettings } from '../data/settingsRepository';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { Settings } from '../types/settings';
import { SettingsContext } from './settingsContext';

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
