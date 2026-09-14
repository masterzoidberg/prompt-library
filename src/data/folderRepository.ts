import type { Folder, FolderCreate, FolderUpdate } from '../types/folder';
import { SYSTEM_FOLDER_ID } from '../config/constants';
import { newId } from '../utils/id';
import { normalizeName } from '../utils/normalize';
import { nowIso } from '../utils/date';
import { getDb } from './db';

export class FolderNameConflictError extends Error {
  constructor(name: string) {
    super(`Folder name already exists: ${name}`);
    this.name = 'FolderNameConflictError';
  }
}

export class SystemFolderProtectedError extends Error {
  constructor() {
    super('The Unfiled system folder cannot be modified or deleted.');
    this.name = 'SystemFolderProtectedError';
  }
}

export class FolderNotFoundError extends Error {
  constructor(id: string) {
    super(`Folder not found: ${id}`);
    this.name = 'FolderNotFoundError';
  }
}

export async function listFolders(): Promise<Folder[]> {
  const db = await getDb();
  return db.getAll('folders');
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  const db = await getDb();
  return db.get('folders', id);
}

export async function createFolder(input: FolderCreate): Promise<Folder> {
  const name = input.name.trim();
  if (!name) throw new Error('Folder name is required');
  const normalized = normalizeName(name);
  const db = await getDb();
  const tx = db.transaction('folders', 'readwrite');
  const store = tx.store;
  const existing = await store.index('by-normalizedName').get(normalized);
  if (existing) {
    await tx.done.catch(() => {});
    throw new FolderNameConflictError(name);
  }
  const now = nowIso();
  const folder: Folder = {
    id: newId(),
    name,
    normalizedName: normalized,
    createdAt: now,
    updatedAt: now,
  };
  await store.add(folder);
  await tx.done;
  return folder;
}

export async function updateFolder(id: string, patch: FolderUpdate): Promise<Folder> {
  if (id === SYSTEM_FOLDER_ID) throw new SystemFolderProtectedError();
  const db = await getDb();
  const tx = db.transaction('folders', 'readwrite');
  const store = tx.store;
  const current = await store.get(id);
  if (!current) {
    await tx.done.catch(() => {});
    throw new FolderNotFoundError(id);
  }
  const next: Folder = { ...current };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error('Folder name is required');
    const normalized = normalizeName(name);
    if (normalized !== current.normalizedName) {
      const conflict = await store.index('by-normalizedName').get(normalized);
      if (conflict && conflict.id !== id) {
        await tx.done.catch(() => {});
        throw new FolderNameConflictError(name);
      }
    }
    next.name = name;
    next.normalizedName = normalized;
    next.updatedAt = nowIso();
  }
  await store.put(next);
  await tx.done;
  return next;
}

export async function deleteFolder(id: string): Promise<void> {
  if (id === SYSTEM_FOLDER_ID) throw new SystemFolderProtectedError();
  const db = await getDb();
  const tx = db.transaction(['folders', 'prompts'], 'readwrite');
  const folder = await tx.objectStore('folders').get(id);
  if (!folder) {
    await tx.done.catch(() => {});
    throw new FolderNotFoundError(id);
  }
  await tx.objectStore('folders').delete(id);
  const promptIndex = tx.objectStore('prompts').index('by-folder');
  let cursor = await promptIndex.openCursor(id);
  while (cursor) {
    const prompt = cursor.value;
    await cursor.update({ ...prompt, folderId: SYSTEM_FOLDER_ID });
    cursor = await cursor.continue();
  }
  await tx.done;
}