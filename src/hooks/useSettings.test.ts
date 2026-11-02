import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings } from './useSettings';
import { SettingsProvider } from './SettingsProvider';
import { resetDbCache, getDb, ensureSeeded } from '../data/db';
import * as settingsRepository from '../data/settingsRepository';
import { SETTINGS_KEY } from '../config/constants';
import { DEFAULT_SETTINGS } from '../types/settings';

afterEach(() => {
  vi.restoreAllMocks();
  for (const property of [
    '--interface-font-family',
    '--interface-font-size',
    '--prompt-font-family',
    '--prompt-font-size',
    '--prompt-line-height',
  ]) {
    document.documentElement.style.removeProperty(property);
  }
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

  it('adds typography defaults when loading a legacy settings record', async () => {
    const db = await getDb();
    await db.put(
      'settings',
      {
        schemaVersion: 1,
        theme: 'dark',
        defaultSort: 'alphabetical',
        viewMode: 'card',
        confirmBeforeDelete: true,
      } as never,
      SETTINGS_KEY,
    );

    expect(await settingsRepository.getSettings()).toMatchObject({
      theme: 'dark',
      interfaceFontFamily: 'system-sans',
      interfaceFontSize: 16,
      promptFontFamily: 'monospace',
      promptFontSize: 14,
      promptLineSpacing: 'normal',
    });
  });

  it('falls back invalid typography fields without discarding valid settings', async () => {
    const db = await getDb();
    await db.put(
      'settings',
      {
        ...DEFAULT_SETTINGS,
        theme: 'dark',
        interfaceFontFamily: 'comic-sans',
        interfaceFontSize: 99,
        promptFontFamily: 'system-sans',
        promptFontSize: 10,
        promptLineSpacing: 'huge',
      } as never,
      SETTINGS_KEY,
    );

    expect(await settingsRepository.getSettings()).toMatchObject({
      theme: 'dark',
      interfaceFontFamily: 'system-sans',
      interfaceFontSize: 16,
      promptFontFamily: 'system-sans',
      promptFontSize: 14,
      promptLineSpacing: 'normal',
    });
  });

  it('persists typography settings and applies their CSS variables', async () => {
    const { result, unmount } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update({
        interfaceFontFamily: 'serif',
        interfaceFontSize: 19,
        promptFontFamily: 'same-as-interface',
        promptFontSize: 23,
        promptLineSpacing: 'relaxed',
      });
    });

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--interface-font-size')).toBe('19px');
      expect(document.documentElement.style.getPropertyValue('--prompt-font-family')).toContain('Georgia');
    });
    expect(document.documentElement.style.getPropertyValue('--prompt-font-size')).toBe('23px');
    expect(document.documentElement.style.getPropertyValue('--prompt-line-height')).toBe('1.75');

    unmount();
    expect(await settingsRepository.getSettings()).toMatchObject({
      interfaceFontFamily: 'serif',
      interfaceFontSize: 19,
      promptFontFamily: 'same-as-interface',
      promptFontSize: 23,
      promptLineSpacing: 'relaxed',
    });
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
