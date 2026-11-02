import type { Settings } from '../types/settings';
import { normalizeSettings } from '../types/settings';
import { SETTINGS_KEY } from '../config/constants';
import { getDb } from './db';

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const stored = await db.get('settings', SETTINGS_KEY);
  return normalizeSettings(stored);
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const db = await getDb();
  await db.put('settings', settings, SETTINGS_KEY);
  return settings;
}
