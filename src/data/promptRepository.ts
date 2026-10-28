import type {
  AssetType,
  Prompt,
  PromptCreate,
  PromptUpdate,
  TargetTool,
} from '../types/prompt';
import {
  DEFAULT_ASSET_TYPE,
  DEFAULT_TARGET_TOOLS,
  DEFAULT_VARIABLE_DEFAULTS,
  isAssetType,
  isTargetTool,
  withPromptDefaults,
} from '../types/prompt';
import { SYSTEM_FOLDER_ID, SYSTEM_FOLDER_NAME } from '../config/constants';
import type { Folder } from '../types/folder';
import type { Tag } from '../types/tag';
import { newId } from '../utils/id';
import { normalizeName } from '../utils/normalize';
import { nowIso } from '../utils/date';
import { getDb, type PromptDB } from './db';
import {
  arePromptVersionSnapshotsEqual,
  createPromptVersionInTransaction,
  getPromptVersionInTransaction,
  toPromptVersionSnapshot,
} from './versionRepository';
import { removePromptFromBundlesInTransaction } from './bundleRepository';

type PromptWriteTransaction = ReturnType<PromptDB['transaction']>;

export type PromptUpdateFailurePoint = 'after-version' | 'after-prompt';

export interface PromptUpdateOptions {
  failAt?: PromptUpdateFailurePoint;
}

export class PromptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptValidationError';
  }
}

export class PromptNotFoundError extends Error {
  constructor(id: string) {
    super(`Prompt not found: ${id}`);
    this.name = 'PromptNotFoundError';
  }
}

export async function listPrompts(): Promise<Prompt[]> {
  const db = await getDb();
  const prompts = await db.getAll('prompts');
  return prompts.map(withPromptDefaults);
}

export async function getPrompt(id: string): Promise<Prompt | undefined> {
  const db = await getDb();
  const prompt = await db.get('prompts', id);
  return prompt ? withPromptDefaults(prompt) : undefined;
}

function validateAssetType(value: unknown): AssetType {
  if (!isAssetType(value)) throw new PromptValidationError('Prompt type is invalid');
  return value;
}

function validateTargetTools(value: unknown): TargetTool[] {
  if (!Array.isArray(value)) throw new PromptValidationError('Prompt targetTools must be an array');
  const seen = new Set<TargetTool>();
  return value.map((tool, index) => {
    if (!isTargetTool(tool)) throw new PromptValidationError(`Prompt targetTools[${index}] is invalid`);
    if (seen.has(tool)) throw new PromptValidationError(`Prompt targetTools must be unique: ${tool}`);
    seen.add(tool);
    return tool;
  });
}

function validateTagIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new PromptValidationError('Prompt tagIds must be an array');
  const seen = new Set<string>();
  return value.map((tagId, index) => {
    if (typeof tagId !== 'string' || !tagId) {
      throw new PromptValidationError(`Prompt tagIds[${index}] must be a non-empty string`);
    }
    if (seen.has(tagId)) throw new PromptValidationError(`Prompt tagIds must be unique: ${tagId}`);
    seen.add(tagId);
    return tagId;
  });
}

function validateVariableDefaults(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PromptValidationError('Prompt variableDefaults must be an object');
  }
  const entries = Object.entries(value);
  if (entries.some(([, entryValue]) => typeof entryValue !== 'string')) {
    throw new PromptValidationError('Prompt variableDefaults values must be strings');
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function validateMetadata(input: {
  type?: unknown;
  targetTools?: unknown;
  notes?: unknown;
  variableDefaults?: unknown;
}): Pick<Prompt, 'type' | 'targetTools' | 'notes' | 'variableDefaults'> {
  const type = input.type === undefined ? DEFAULT_ASSET_TYPE : validateAssetType(input.type);
  const targetTools = input.targetTools === undefined ? [...DEFAULT_TARGET_TOOLS] : validateTargetTools(input.targetTools);
  if (input.notes !== undefined && typeof input.notes !== 'string') {
    throw new PromptValidationError('Prompt notes must be a string');
  }
  const notes = typeof input.notes === 'string' ? input.notes.trim() || undefined : undefined;
  const variableDefaults =
    input.variableDefaults === undefined
      ? { ...DEFAULT_VARIABLE_DEFAULTS }
      : validateVariableDefaults(input.variableDefaults);
  return { type, targetTools, notes, variableDefaults };
}

function injectUpdateFailure(
  failAt: PromptUpdateFailurePoint | undefined,
  point: PromptUpdateFailurePoint,
): void {
  if (failAt === point) throw new Error('Injected prompt update failure');
}

async function validatePromptReferences(
  tx: PromptWriteTransaction,
  folderId: string,
  tagIds: string[],
): Promise<void> {
  const folder = await tx.objectStore('folders').get(folderId);
  if (!folder) throw new PromptValidationError(`Prompt folder does not exist: ${folderId}`);
  for (const tagId of tagIds) {
    const tag = await tx.objectStore('tags').get(tagId);
    if (!tag) throw new PromptValidationError(`Prompt tag does not exist: ${tagId}`);
  }
}


async function getOrCreateFolderInTransaction(
  tx: PromptWriteTransaction,
  input: unknown,
): Promise<string> {
  if (typeof input !== 'string') throw new PromptValidationError('New folder name must be a string');
  const name = input.trim();
  if (!name) throw new PromptValidationError('New folder name is required');
  const normalizedName = normalizeName(name);
  const store = tx.objectStore('folders');

  if (normalizedName === normalizeName(SYSTEM_FOLDER_NAME)) {
    const systemFolder = await store.get(SYSTEM_FOLDER_ID);
    if (systemFolder) return systemFolder.id;
    throw new PromptValidationError('The Unfiled system folder does not exist');
  }

  const existing = await store.index('by-normalizedName').get(normalizedName);
  if (existing) return existing.id;

  const now = nowIso();
  const folder: Folder = { id: newId(), name, normalizedName, createdAt: now, updatedAt: now };
  await store.add!(folder);
  return folder.id;
}

async function resolveTagIdsInTransaction(
  tx: PromptWriteTransaction,
  currentIds: string[],
  stagedNames: unknown,
): Promise<string[]> {
  if (!Array.isArray(stagedNames)) throw new PromptValidationError('New tag names must be an array');
  const tagIds = [...currentIds];
  const seenNames = new Set<string>();
  const store = tx.objectStore('tags');

  for (const [index, input] of stagedNames.entries()) {
    if (typeof input !== 'string') {
      throw new PromptValidationError(`New tag names[${index}] must be a string`);
    }
    const name = input.trim();
    if (!name) throw new PromptValidationError(`New tag names[${index}] must not be empty`);
    const normalizedName = normalizeName(name);
    if (seenNames.has(normalizedName)) continue;
    seenNames.add(normalizedName);

    const existing = await store.index('by-normalizedName').get(normalizedName);
    let tagId = existing?.id;
    if (!tagId) {
      const now = nowIso();
      const tag: Tag = { id: newId(), name, normalizedName, createdAt: now, updatedAt: now };
      await store.add!(tag);
      tagId = tag.id;
    }
    if (!tagIds.includes(tagId)) tagIds.push(tagId);
  }

  return tagIds;
}

async function abortTransaction(tx: PromptWriteTransaction): Promise<void> {
  try {
    tx.abort();
  } catch {
    // The transaction may already have completed after a failed read.
  }
  await tx.done.catch(() => undefined);
}

export async function createPrompt(input: PromptCreate): Promise<Prompt> {
  if (typeof input.title !== 'string') throw new PromptValidationError('Prompt title must be a string');
  if (typeof input.content !== 'string') throw new PromptValidationError('Prompt content must be a string');
  const title = input.title.trim();
  const content = input.content;
  if (!title) throw new Error('Prompt title is required');
  if (!content) throw new Error('Prompt content is required');
  if (input.description !== undefined && typeof input.description !== 'string') {
    throw new PromptValidationError('Prompt description must be a string');
  }
  if (input.folderId !== undefined && typeof input.folderId !== 'string') {
    throw new PromptValidationError('Prompt folderId must be a string');
  }
  if (input.isFavorite !== undefined && typeof input.isFavorite !== 'boolean') {
    throw new PromptValidationError('Prompt isFavorite must be a boolean');
  }
  const requestedFolderId = input.folderId || SYSTEM_FOLDER_ID;
  const requestedTagIds = validateTagIds(input.tagIds ?? []);
  const metadata = validateMetadata(input);
  const db = await getDb();
  const tx = db.transaction(['prompts', 'folders', 'tags'], 'readwrite');
  try {
    const folderId = input.newFolderName !== undefined
      ? await getOrCreateFolderInTransaction(tx, input.newFolderName)
      : requestedFolderId;
    const tagIds = await resolveTagIdsInTransaction(tx, requestedTagIds, input.newTagNames ?? []);
    await validatePromptReferences(tx, folderId, tagIds);
    const now = nowIso();
    const prompt: Prompt = {
      id: newId(),
      title,
      content,
      description: input.description?.trim() || undefined,
      folderId,
      tagIds,
      isFavorite: input.isFavorite ?? false,
      copyCount: 0,
      createdAt: now,
      updatedAt: now,
      lastCopiedAt: null,
      ...metadata,
    };
    await tx.objectStore('prompts').add(prompt);
    await tx.done;
    return prompt;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
}

export async function updatePrompt(
  id: string,
  patch: PromptUpdate,
  options: PromptUpdateOptions = {},
): Promise<Prompt> {
  const db = await getDb();
  const tx = db.transaction(['prompts', 'promptVersions', 'folders', 'tags'], 'readwrite');
  try {
    const current = await tx.objectStore('prompts').get(id);
    if (!current) throw new PromptNotFoundError(id);
    const source = withPromptDefaults(current);
    const next: Prompt = { ...source, updatedAt: nowIso() };
    if (patch.title !== undefined) {
      if (typeof patch.title !== 'string') throw new PromptValidationError('Prompt title must be a string');
      const title = patch.title.trim();
      if (!title) throw new Error('Prompt title is required');
      next.title = title;
    }
    if (patch.content !== undefined) {
      if (typeof patch.content !== 'string') throw new PromptValidationError('Prompt content must be a string');
      if (!patch.content) throw new Error('Prompt content is required');
      next.content = patch.content;
    }
    if (patch.description !== undefined) {
      if (typeof patch.description !== 'string') throw new PromptValidationError('Prompt description must be a string');
      next.description = patch.description.trim() || undefined;
    }
    if (patch.folderId !== undefined) {
      if (typeof patch.folderId !== 'string') throw new PromptValidationError('Prompt folderId must be a string');
      next.folderId = patch.folderId || SYSTEM_FOLDER_ID;
    }
    if (patch.newFolderName !== undefined) {
      next.folderId = await getOrCreateFolderInTransaction(tx, patch.newFolderName);
    }
    if (patch.tagIds !== undefined || patch.newTagNames !== undefined) {
      const tagIds = patch.tagIds === undefined ? next.tagIds : validateTagIds(patch.tagIds);
      next.tagIds = await resolveTagIdsInTransaction(tx, tagIds, patch.newTagNames ?? []);
    }
    if (patch.isFavorite !== undefined) {
      if (typeof patch.isFavorite !== 'boolean') throw new PromptValidationError('Prompt isFavorite must be a boolean');
      next.isFavorite = patch.isFavorite;
    }
    if (patch.type !== undefined) next.type = validateAssetType(patch.type);
    if (patch.targetTools !== undefined) next.targetTools = validateTargetTools(patch.targetTools);
    if (patch.notes !== undefined) {
      if (typeof patch.notes !== 'string') throw new PromptValidationError('Prompt notes must be a string');
      next.notes = patch.notes.trim() || undefined;
    }
    if (patch.variableDefaults !== undefined) next.variableDefaults = validateVariableDefaults(patch.variableDefaults);
    Object.assign(next, validateMetadata(next));
    await validatePromptReferences(tx, next.folderId, next.tagIds);

    if (!arePromptVersionSnapshotsEqual(toPromptVersionSnapshot(source), toPromptVersionSnapshot(next))) {
      await createPromptVersionInTransaction(tx, source, 'edit', next.updatedAt);
      injectUpdateFailure(options.failAt, 'after-version');
    }

    await tx.objectStore('prompts').put(next);
    injectUpdateFailure(options.failAt, 'after-prompt');
    await tx.done;
    return next;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
}

export async function restorePromptVersion(
  id: string,
  versionId: string,
  options: PromptUpdateOptions = {},
): Promise<Prompt> {
  const db = await getDb();
  const tx = db.transaction(['prompts', 'promptVersions', 'folders', 'tags'], 'readwrite');
  try {
    const current = await tx.objectStore('prompts').get(id);
    if (!current) throw new PromptNotFoundError(id);
    const version = await getPromptVersionInTransaction(tx, versionId);
    if (!version || version.promptId !== id) {
      throw new PromptValidationError(`Prompt version does not belong to prompt: ${versionId}`);
    }

    const source = withPromptDefaults(current);
    const next: Prompt = {
      ...source,
      title: version.snapshot.title,
      content: version.snapshot.content,
      description: version.snapshot.description,
      type: version.snapshot.type,
      targetTools: [...version.snapshot.targetTools],
      notes: version.snapshot.notes,
      variableDefaults: { ...version.snapshot.variableDefaults },
      updatedAt: nowIso(),
    };
    if (typeof next.title !== 'string' || !next.title) throw new PromptValidationError('Prompt title is invalid');
    if (typeof next.content !== 'string' || !next.content) throw new PromptValidationError('Prompt content is invalid');
    Object.assign(next, validateMetadata(next));
    await validatePromptReferences(tx, next.folderId, next.tagIds);

    if (!arePromptVersionSnapshotsEqual(toPromptVersionSnapshot(source), toPromptVersionSnapshot(next))) {
      await createPromptVersionInTransaction(tx, source, 'restore', next.updatedAt);
      injectUpdateFailure(options.failAt, 'after-version');
      await tx.objectStore('prompts').put(next);
      injectUpdateFailure(options.failAt, 'after-prompt');
      await tx.done;
      return next;
    }

    await tx.done;
    return source;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
}

export async function duplicatePromptVersion(id: string, versionId: string): Promise<Prompt> {
  const db = await getDb();
  const tx = db.transaction(['prompts', 'promptVersions', 'folders', 'tags'], 'readwrite');
  try {
    const current = await tx.objectStore('prompts').get(id);
    if (!current) throw new PromptNotFoundError(id);
    const version = await getPromptVersionInTransaction(tx, versionId);
    if (!version || version.promptId !== id) {
      throw new PromptValidationError(`Prompt version does not belong to prompt: ${versionId}`);
    }

    const source = withPromptDefaults(current);
    await validatePromptReferences(tx, source.folderId, source.tagIds);
    const now = nowIso();
    const copy: Prompt = {
      ...source,
      id: newId(),
      title: `Copy of ${version.snapshot.title}`,
      content: version.snapshot.content,
      description: version.snapshot.description,
      type: version.snapshot.type,
      targetTools: [...version.snapshot.targetTools],
      notes: version.snapshot.notes,
      variableDefaults: { ...version.snapshot.variableDefaults },
      isFavorite: false,
      copyCount: 0,
      createdAt: now,
      updatedAt: now,
      lastCopiedAt: null,
    };
    if (!copy.title.trim()) throw new PromptValidationError('Prompt version title is invalid');
    if (!copy.content) throw new PromptValidationError('Prompt version content is invalid');
    Object.assign(copy, validateMetadata(copy));
    await tx.objectStore('prompts').add(copy);
    await tx.done;
    return copy;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['prompts', 'bundles'], 'readwrite');
  try {
    await tx.objectStore('prompts').delete(id);
    await removePromptFromBundlesInTransaction(tx, id);
    await tx.done;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
}

export async function duplicatePrompt(id: string): Promise<Prompt> {
  const db = await getDb();
  const tx = db.transaction(['prompts', 'folders', 'tags'], 'readwrite');
  try {
    const current = await tx.objectStore('prompts').get(id);
    if (!current) throw new PromptNotFoundError(id);
    const now = nowIso();
    const source = withPromptDefaults(current);
    await validatePromptReferences(tx, source.folderId, source.tagIds);
    const copy: Prompt = {
      ...source,
      id: newId(),
      title: `Copy of ${source.title}`,
      isFavorite: false,
      copyCount: 0,
      lastCopiedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await tx.objectStore('prompts').add(copy);
    await tx.done;
    return copy;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
}

export async function recordCopy(id: string): Promise<Prompt> {
  const db = await getDb();
  const tx = db.transaction(['prompts', 'folders', 'tags'], 'readwrite');
  try {
    const current = await tx.objectStore('prompts').get(id);
    if (!current) throw new PromptNotFoundError(id);
    const source = withPromptDefaults(current);
    await validatePromptReferences(tx, source.folderId, source.tagIds);
    const next: Prompt = {
      ...source,
      copyCount: source.copyCount + 1,
      lastCopiedAt: nowIso(),
    };
    await tx.objectStore('prompts').put(next);
    await tx.done;
    return next;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
}
