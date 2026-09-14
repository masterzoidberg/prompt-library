import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings } from './useSettings';
import { SettingsProvider } from './SettingsProvider';
import { resetDbCache, getDb, ensureSeeded } from '../data/db';
import * as settingsRepository from '../data/settingsRepository';

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await resetDbCache();
  const db = await getDb();
  await db.clear('settings');
  await ensureSeeded();
});

describe('useSettings', () => {
  it('loads defaults', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings?.theme).toBe('system');
  });

  it('updates settings', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.update({ theme: 'dark' });
    });
    expect(result.current.settings?.theme).toBe('dark');
  });

  it('loads settings once and shares updates with every consumer', async () => {
    const getSettingsSpy = vi.spyOn(settingsRepository, 'getSettings');
    const { result } = renderHook(() => ({ first: useSettings(), second: useSettings() }), {
      wrapper: SettingsProvider,
    });

    await waitFor(() => expect(result.current.first.loading).toBe(false));
    expect(getSettingsSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.first.update({ theme: 'dark' });
    });

    expect(result.current.first.settings?.theme).toBe('dark');
    expect(result.current.second.settings?.theme).toBe('dark');
  });

  it('retains settings and exposes an error when saving fails', async () => {
    const saveSettingsSpy = vi
      .spyOn(settingsRepository, 'saveSettings')
      .mockRejectedValueOnce(new Error('storage unavailable'));
    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await expect(result.current.update({ theme: 'dark' })).rejects.toThrow('storage unavailable');
    });

    expect(saveSettingsSpy).toHaveBeenCalledTimes(1);
    expect(result.current.settings?.theme).toBe('system');
    expect(result.current.error?.message).toBe('storage unavailable');
  });
});
