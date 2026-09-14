import type { Tag, TagCreate, TagUpdate } from '../types/tag';
import { newId } from '../utils/id';
import { normalizeName } from '../utils/normalize';
import { nowIso } from '../utils/date';
import { getDb } from './db';

export class TagNameConflictError extends Error {
  constructor(name: string) {
    super(`Tag name already exists: ${name}`);
    this.name = 'TagNameConflictError';
  }
}

export class TagNotFoundError extends Error {
  constructor(id: string) {
    super(`Tag not found: ${id}`);
    this.name = 'TagNotFoundError';
  }
}

export async function listTags(): Promise<Tag[]> {
  const db = await getDb();
  return db.getAll('tags');
}

export async function getTag(id: string): Promise<Tag | undefined> {
  const db = await getDb();
  return db.get('tags', id);
}

export async function createTag(input: TagCreate): Promise<Tag> {
  const name = input.name.trim();
  if (!name) throw new Error('Tag name is required');
  const normalized = normalizeName(name);
  const db = await getDb();
  const tx = db.transaction('tags', 'readwrite');
  const store = tx.store;
  const existing = await store.index('by-normalizedName').get(normalized);
  if (existing) {
    await tx.done.catch(() => {});
    throw new TagNameConflictError(name);
  }
  const now = nowIso();
  const tag: Tag = {
    id: newId(),
    name,
    normalizedName: normalized,
    createdAt: now,
    updatedAt: now,
  };
  await store.add(tag);
  await tx.done;
  return tag;
}

export async function updateTag(id: string, patch: TagUpdate): Promise<Tag> {
  const db = await getDb();
  const tx = db.transaction('tags', 'readwrite');
  const store = tx.store;
  const current = await store.get(id);
  if (!current) {
    await tx.done.catch(() => {});
    throw new TagNotFoundError(id);
  }
  const next: Tag = { ...current };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error('Tag name is required');
    const normalized = normalizeName(name);
    if (normalized !== current.normalizedName) {
      const conflict = await store.index('by-normalizedName').get(normalized);
      if (conflict && conflict.id !== id) {
        await tx.done.catch(() => {});
        throw new TagNameConflictError(name);
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

export async function deleteTag(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['tags', 'prompts'], 'readwrite');
  const tag = await tx.objectStore('tags').get(id);
  if (!tag) {
    await tx.done.catch(() => {});
    throw new TagNotFoundError(id);
  }
  await tx.objectStore('tags').delete(id);
  let cursor = await tx.objectStore('prompts').openCursor();
  while (cursor) {
    const prompt = cursor.value;
    if (prompt.tagIds.includes(id)) {
      await cursor.update({ ...prompt, tagIds: prompt.tagIds.filter((t) => t !== id) });
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}