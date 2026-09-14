import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import { DB_NAME, DB_VERSION, SETTINGS_KEY, SYSTEM_FOLDER_ID, SYSTEM_FOLDER_NAME } from '../config/constants';
import type { Prompt, PromptV1, Folder, Tag, Settings, MigrationJournal, PromptVersion, Bundle } from '../types';
import { DEFAULT_SETTINGS } from '../types/settings';
import { nowIso } from '../utils/date';

interface PromptLibSchema extends DBSchema {
  prompts: {
    key: string;
    value: Prompt | PromptV1;
    indexes: { 'by-folder': string; 'by-updatedAt': string; 'by-createdAt': string };
  };
  promptVersions: {
    key: string;
    value: PromptVersion;
    indexes: { 'by-promptId': string; 'by-prompt-sequence': [string, number] };
  };
  bundles: {
    key: string;
    value: Bundle;
    indexes: { 'by-updatedAt': string };
  };
  folders: {
    key: string;
    value: Folder;
    indexes: { 'by-normalizedName': string };
  };
  tags: {
    key: string;
    value: Tag;
    indexes: { 'by-normalizedName': string };
  };
  settings: {
    key: string;
    value: Settings | MigrationJournal;
  };
}

export type PromptDB = IDBPDatabase<PromptLibSchema>;

let dbPromise: Promise<PromptDB> | null = null;

export function getDb(): Promise<PromptDB> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<PromptLibSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('prompts')) {
        const store = db.createObjectStore('prompts', { keyPath: 'id' });
        store.createIndex('by-folder', 'folderId');
        store.createIndex('by-updatedAt', 'updatedAt');
        store.createIndex('by-createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('folders')) {
        const store = db.createObjectStore('folders', { keyPath: 'id' });
        store.createIndex('by-normalizedName', 'normalizedName', { unique: true });
      }
      if (!db.objectStoreNames.contains('tags')) {
        const store = db.createObjectStore('tags', { keyPath: 'id' });
        store.createIndex('by-normalizedName', 'normalizedName', { unique: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
      if (!db.objectStoreNames.contains('promptVersions')) {
        const store = db.createObjectStore('promptVersions', { keyPath: 'id' });
        store.createIndex('by-promptId', 'promptId');
        store.createIndex('by-prompt-sequence', ['promptId', 'sequence'], { unique: true });
      }
      if (!db.objectStoreNames.contains('bundles')) {
        const store = db.createObjectStore('bundles', { keyPath: 'id' });
        store.createIndex('by-updatedAt', 'updatedAt');
      }
    },
  });
  return dbPromise;
}

export async function ensureSeeded(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['folders', 'settings'], 'readwrite');
  const existingFolder = await tx.objectStore('folders').get(SYSTEM_FOLDER_ID);
  if (!existingFolder) {
    const now = nowIso();
    await tx.objectStore('folders').put({
      id: SYSTEM_FOLDER_ID,
      name: SYSTEM_FOLDER_NAME,
      normalizedName: SYSTEM_FOLDER_NAME.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    });
  }
  const existingSettings = await tx.objectStore('settings').get(SETTINGS_KEY);
  if (!existingSettings) {
    await tx.objectStore('settings').put(DEFAULT_SETTINGS, SETTINGS_KEY);
  }
  await tx.done;
}

export async function resetDbCache(): Promise<void> {
  dbPromise = null;
}
