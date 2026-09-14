import type { Prompt, PromptVersion, PromptVersionSnapshot } from '../types';
import { newId } from '../utils/id';
import { nowIso } from '../utils/date';
import { getDb, type PromptDB } from './db';

type PromptWriteTransaction = ReturnType<PromptDB['transaction']>;

export function toPromptVersionSnapshot(prompt: Prompt): PromptVersionSnapshot {
  return {
    title: prompt.title,
    content: prompt.content,
    description: prompt.description,
    type: prompt.type,
    targetTools: [...prompt.targetTools],
    notes: prompt.notes,
    variableDefaults: { ...prompt.variableDefaults },
  };
}

function sameStringRecord(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

export function arePromptVersionSnapshotsEqual(
  left: PromptVersionSnapshot,
  right: PromptVersionSnapshot,
): boolean {
  return (
    left.title === right.title &&
    left.content === right.content &&
    left.description === right.description &&
    left.type === right.type &&
    left.targetTools.length === right.targetTools.length &&
    left.targetTools.every((tool, index) => tool === right.targetTools[index]) &&
    left.notes === right.notes &&
    sameStringRecord(left.variableDefaults, right.variableDefaults)
  );
}

export async function createPromptVersionInTransaction(
  tx: PromptWriteTransaction,
  prompt: Prompt,
  reason: PromptVersion['reason'],
  createdAt: string = nowIso(),
): Promise<PromptVersion> {
  const versionStore = tx.objectStore('promptVersions');
  const existingVersions = await versionStore.index('by-promptId').getAll(prompt.id);
  const nextSequence = existingVersions.reduce(
    (highest, version) => Math.max(highest, version.sequence),
    0,
  ) + 1;
  const version: PromptVersion = {
    id: newId(),
    promptId: prompt.id,
    sequence: nextSequence,
    createdAt,
    reason,
    snapshot: toPromptVersionSnapshot(prompt),
  };
  await versionStore.add!(version);
  return version;
}

export async function getPromptVersionInTransaction(
  tx: PromptWriteTransaction,
  id: string,
): Promise<PromptVersion | undefined> {
  return tx.objectStore('promptVersions').get(id);
}

export async function listPromptVersions(promptId: string): Promise<PromptVersion[]> {
  const db = await getDb();
  const versions = await db.getAllFromIndex('promptVersions', 'by-promptId', promptId);
  return versions.sort((left, right) => left.sequence - right.sequence);
}
