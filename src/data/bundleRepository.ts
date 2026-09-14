import type { Bundle, BundleCreate, BundleUpdate } from '../types/bundle';
import { newId } from '../utils/id';
import { nowIso } from '../utils/date';
import { getDb, type PromptDB } from './db';

type BundleWriteTransaction = ReturnType<PromptDB['transaction']>;
type AbortableTransaction = { abort: () => void; done: Promise<unknown> };

export class BundleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BundleValidationError';
  }
}

export class BundleNotFoundError extends Error {
  constructor(id: string) {
    super(`Bundle not found: ${id}`);
    this.name = 'BundleNotFoundError';
  }
}

function validateName(value: unknown): string {
  if (typeof value !== 'string') throw new BundleValidationError('Bundle name must be a string');
  const name = value.trim();
  if (!name) throw new BundleValidationError('Bundle name is required');
  return name;
}

function validateDescription(value: unknown): string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    throw new BundleValidationError('Bundle description must be a string');
  }
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function validatePromptIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new BundleValidationError('Bundle promptIds must be an array');
  const seen = new Set<string>();
  return value.map((promptId, index) => {
    if (typeof promptId !== 'string' || !promptId) {
      throw new BundleValidationError(`Bundle promptIds[${index}] must be a non-empty string`);
    }
    if (seen.has(promptId)) {
      throw new BundleValidationError(`Bundle promptIds must be unique: ${promptId}`);
    }
    seen.add(promptId);
    return promptId;
  });
}

async function validatePromptReferences(
  tx: BundleWriteTransaction,
  promptIds: string[],
): Promise<void> {
  const promptStore = tx.objectStore('prompts');
  for (const promptId of promptIds) {
    if (!(await promptStore.get(promptId))) {
      throw new BundleValidationError(`Bundle prompt does not exist: ${promptId}`);
    }
  }
}

async function abortTransaction(tx: AbortableTransaction): Promise<void> {
  try {
    tx.abort();
  } catch {
    // The transaction may already have completed after a failed read.
  }
  await tx.done.catch(() => undefined);
}

export async function listBundles(): Promise<Bundle[]> {
  const db = await getDb();
  return db.getAll('bundles');
}

export async function getBundle(id: string): Promise<Bundle | undefined> {
  const db = await getDb();
  return db.get('bundles', id);
}

export async function createBundle(input: BundleCreate): Promise<Bundle> {
  const name = validateName(input.name);
  const description = validateDescription(input.description);
  const promptIds = validatePromptIds(input.promptIds ?? []);
  const db = await getDb();
  const tx = db.transaction(['bundles', 'prompts'], 'readwrite');
  try {
    await validatePromptReferences(tx, promptIds);
    const now = nowIso();
    const bundle: Bundle = {
      id: newId(),
      name,
      description,
      promptIds,
      createdAt: now,
      updatedAt: now,
    };
    await tx.objectStore('bundles').add(bundle);
    await tx.done;
    return bundle;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
}

export async function updateBundle(id: string, patch: BundleUpdate): Promise<Bundle> {
  const db = await getDb();
  const tx = db.transaction(['bundles', 'prompts'], 'readwrite');
  try {
    const current = await tx.objectStore('bundles').get(id);
    if (!current) throw new BundleNotFoundError(id);

    const next: Bundle = { ...current };
    if (patch.name !== undefined) next.name = validateName(patch.name);
    if (patch.description !== undefined) next.description = validateDescription(patch.description);
    if (patch.promptIds !== undefined) next.promptIds = validatePromptIds(patch.promptIds);
    await validatePromptReferences(tx, next.promptIds);
    next.updatedAt = nowIso();
    await tx.objectStore('bundles').put(next);
    await tx.done;
    return next;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
}

export function reorderBundle(id: string, promptIds: string[]): Promise<Bundle> {
  return updateBundle(id, { promptIds });
}

export async function deleteBundle(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('bundles', 'readwrite');
  try {
    if (!(await tx.store.get(id))) throw new BundleNotFoundError(id);
    await tx.store.delete(id);
    await tx.done;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
}

export async function removePromptFromBundlesInTransaction(
  tx: BundleWriteTransaction,
  promptId: string,
): Promise<void> {
  let cursor = await tx.objectStore('bundles').openCursor();
  while (cursor) {
    if (cursor.value.promptIds.includes(promptId)) {
      await cursor.update!({
        ...cursor.value,
        promptIds: cursor.value.promptIds.filter((id) => id !== promptId),
        updatedAt: nowIso(),
      });
    }
    cursor = await cursor.continue();
  }
}
