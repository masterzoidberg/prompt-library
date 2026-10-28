import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getDb, resetDbCache } from './db';
import { DB_NAME } from '../config/constants';
import { ensureSeeded } from './db';
import * as folderRepo from './folderRepository';
import * as tagRepo from './tagRepository';
import * as promptRepo from './promptRepository';
import type { PromptCreate, PromptUpdate, PromptV1 } from '../types/prompt';

async function resetAll() {
  await resetDbCache();
  const db = await getDb();
  await db.clear('prompts');
  await db.clear('folders');
  await db.clear('tags');
  await db.clear('settings');
  await ensureSeeded();
}

describe('folderRepo', () => {
  beforeEach(resetAll);

  it('seeds the Unfiled folder', async () => {
    const folders = await folderRepo.listFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe('Unfiled');
  });

  it('creates a folder', async () => {
    const f = await folderRepo.createFolder({ name: 'Writing' });
    expect(f.id).toBeDefined();
    expect(f.normalizedName).toBe('writing');
  });

  it('rejects duplicate name case-insensitively', async () => {
    await folderRepo.createFolder({ name: 'Writing' });
    await expect(folderRepo.createFolder({ name: '  WRITING ' })).rejects.toBeInstanceOf(
      folderRepo.FolderNameConflictError,
    );
  });

  it('refuses to rename Unfiled', async () => {
    await expect(folderRepo.updateFolder('unfiled', { name: 'Foo' })).rejects.toBeInstanceOf(
      folderRepo.SystemFolderProtectedError,
    );
  });

  it('refuses to delete Unfiled', async () => {
    await expect(folderRepo.deleteFolder('unfiled')).rejects.toBeInstanceOf(
      folderRepo.SystemFolderProtectedError,
    );
  });

  it('deletes a folder and moves prompts to Unfiled', async () => {
    const f = await folderRepo.createFolder({ name: 'Tmp' });
    const p = await promptRepo.createPrompt({ title: 't', content: 'c', folderId: f.id });
    await folderRepo.deleteFolder(f.id);
    expect(await folderRepo.getFolder(f.id)).toBeUndefined();
    const updated = await promptRepo.getPrompt(p.id);
    expect(updated?.folderId).toBe('unfiled');
  });

  it('updates a folder name', async () => {
    const f = await folderRepo.createFolder({ name: 'Old' });
    const updated = await folderRepo.updateFolder(f.id, { name: 'New' });
    expect(updated.name).toBe('New');
    expect(updated.normalizedName).toBe('new');
  });
});

describe('tagRepo', () => {
  beforeEach(resetAll);

  it('creates and lists tags', async () => {
    await tagRepo.createTag({ name: 'code' });
    await tagRepo.createTag({ name: 'writing' });
    const tags = await tagRepo.listTags();
    expect(tags.map((t) => t.name).sort()).toEqual(['code', 'writing']);
  });

  it('rejects duplicate tag name case-insensitively', async () => {
    await tagRepo.createTag({ name: 'Code' });
    await expect(tagRepo.createTag({ name: 'CODE' })).rejects.toBeInstanceOf(
      tagRepo.TagNameConflictError,
    );
  });

  it('deletes a tag and removes its id from prompts', async () => {
    const t = await tagRepo.createTag({ name: 'x' });
    const p = await promptRepo.createPrompt({ title: 't', content: 'c', tagIds: [t.id] });
    await tagRepo.deleteTag(t.id);
    expect(await tagRepo.getTag(t.id)).toBeUndefined();
    const updated = await promptRepo.getPrompt(p.id);
    expect(updated?.tagIds).toEqual([]);
  });
});

describe('promptRepo', () => {
  beforeEach(resetAll);

  it('requires title and content', async () => {
    await expect(promptRepo.createPrompt({ title: '', content: 'c' })).rejects.toThrow();
    await expect(promptRepo.createPrompt({ title: 't', content: '' })).rejects.toThrow();
  });

  it('assigns to Unfiled by default', async () => {
    const p = await promptRepo.createPrompt({ title: 't', content: 'c' });
    expect(p.folderId).toBe('unfiled');
  });

  it('creates staged folders and tags with the prompt and reuses normalized matches', async () => {
    const existingFolder = await folderRepo.createFolder({ name: 'Research' });
    const existingTag = await tagRepo.createTag({ name: 'Research' });

    const prompt = await promptRepo.createPrompt({
      title: 'Organized prompt',
      content: 'Prompt content',
      folderId: 'unfiled',
      newFolderName: ' research ',
      tagIds: [],
      newTagNames: [' research ', 'Personal', ' personal '],
    });

    expect(prompt.folderId).toBe(existingFolder.id);
    expect(prompt.tagIds).toHaveLength(2);
    expect(prompt.tagIds[0]).toBe(existingTag.id);
    expect(await folderRepo.listFolders()).toHaveLength(2);
    expect((await tagRepo.listTags()).map((tag) => tag.name).sort()).toEqual(['Personal', 'Research']);
    expect(prompt).not.toHaveProperty('newFolderName');
    expect(prompt).not.toHaveProperty('newTagNames');
  });

  it('reuses the protected Unfiled folder for normalized casing and whitespace variants', async () => {
    const prompt = await promptRepo.createPrompt({
      title: 'Unfiled prompt',
      content: 'Prompt content',
      newFolderName: '  UNFILED  ',
    });

    expect(prompt.folderId).toBe('unfiled');
    expect((await folderRepo.listFolders()).map((folder) => folder.id)).toEqual(['unfiled']);
  });

  it('rolls staged organization records back when prompt references are invalid', async () => {
    await expect(promptRepo.createPrompt({
      title: 'Invalid prompt',
      content: 'Prompt content',
      folderId: 'unfiled',
      newFolderName: 'Temporary',
      tagIds: ['missing-tag'],
      newTagNames: ['Staged tag'],
    })).rejects.toThrow(/Prompt tag does not exist/);

    expect((await folderRepo.listFolders()).map((folder) => folder.name)).toEqual(['Unfiled']);
    expect(await tagRepo.listTags()).toEqual([]);
    expect(await promptRepo.listPrompts()).toEqual([]);
  });

  it('updates a prompt with staged folder and tag records in one transaction', async () => {
    const prompt = await promptRepo.createPrompt({ title: 'Original', content: 'content' });

    const updated = await promptRepo.updatePrompt(prompt.id, {
      newFolderName: 'Experiments',
      newTagNames: ['Personal'],
    });

    expect((await folderRepo.listFolders()).map((folder) => folder.name).sort()).toEqual(['Experiments', 'Unfiled']);
    expect((await tagRepo.listTags()).map((tag) => tag.name)).toEqual(['Personal']);
    expect(updated.folderId).not.toBe('unfiled');
    expect(updated.tagIds).toHaveLength(1);
    expect(await promptRepo.getPrompt(prompt.id)).toEqual(updated);
  });

  it('assigns deterministic metadata defaults and persists valid metadata', async () => {
    const folder = await folderRepo.createFolder({ name: 'Templates' });
    const tag = await tagRepo.createTag({ name: 'Reusable' });
    const p = await promptRepo.createPrompt({
      title: 'Template',
      content: 'Hello {{NAME}}',
      folderId: folder.id,
      tagIds: [tag.id],
      type: 'template',
      targetTools: ['codex', 'chatgpt'],
      notes: 'Use for welcome messages.',
      variableDefaults: { NAME: 'Ada' },
    });

    expect(p.type).toBe('template');
    expect(p.targetTools).toEqual(['codex', 'chatgpt']);
    expect(p.notes).toBe('Use for welcome messages.');
    expect(p.variableDefaults).toEqual({ NAME: 'Ada' });
    expect(await promptRepo.getPrompt(p.id)).toEqual(p);

    const defaults = await promptRepo.createPrompt({ title: 'Default', content: 'content' });
    expect(defaults.type).toBe('prompt');
    expect(defaults.targetTools).toEqual([]);
    expect(defaults.variableDefaults).toEqual({});
  });

  it('adapts existing v1 records with deterministic metadata defaults', async () => {
    const legacy: PromptV1 = {
      id: 'legacy-prompt',
      title: 'Legacy',
      content: 'Existing v1 content',
      folderId: 'unfiled',
      tagIds: [],
      isFavorite: false,
      copyCount: 2,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      lastCopiedAt: '2025-01-01T00:01:00.000Z',
    };
    await (await getDb()).put('prompts', legacy);

    await expect(promptRepo.getPrompt(legacy.id)).resolves.toMatchObject({
      ...legacy,
      type: 'prompt',
      targetTools: [],
      variableDefaults: {},
    });
  });

  it('rejects invalid metadata and dangling references before persistence', async () => {
    const invalidInputs: PromptCreate[] = [
      { title: 'Bad type', content: 'content', type: 'unknown' as never },
      { title: 'Bad tool', content: 'content', targetTools: ['unknown'] as never },
      { title: 'Bad folder', content: 'content', folderId: 'missing-folder' },
      { title: 'Bad tag', content: 'content', tagIds: ['missing-tag'] },
    ];

    for (const input of invalidInputs) {
      await expect(promptRepo.createPrompt(input)).rejects.toThrow();
    }

    expect(await promptRepo.listPrompts()).toEqual([]);
  });

  it('rejects invalid metadata and dangling references on update', async () => {
    const prompt = await promptRepo.createPrompt({ title: 'Original', content: 'content' });
    const invalidUpdates: PromptUpdate[] = [
      { type: 'unknown' as never },
      { targetTools: ['unknown'] as never },
      { folderId: 'missing-folder' },
      { tagIds: ['missing-tag'] },
    ];

    for (const patch of invalidUpdates) {
      await expect(promptRepo.updatePrompt(prompt.id, patch)).rejects.toThrow();
    }

    expect(await promptRepo.getPrompt(prompt.id)).toEqual(prompt);
  });

  it('duplicates with reset counts and "Copy of" prefix', async () => {
    const p = await promptRepo.createPrompt({ title: 't', content: 'c' });
    await promptRepo.recordCopy(p.id);
    const dup = await promptRepo.duplicatePrompt(p.id);
    expect(dup.id).not.toBe(p.id);
    expect(dup.title).toBe('Copy of t');
    expect(dup.copyCount).toBe(0);
    expect(dup.lastCopiedAt).toBeNull();
  });

  it('recordCopy increments count and sets lastCopiedAt but not updatedAt', async () => {
    const p = await promptRepo.createPrompt({ title: 't', content: 'c' });
    const before = p.updatedAt;
    const after = await promptRepo.recordCopy(p.id);
    expect(after.copyCount).toBe(1);
    expect(after.lastCopiedAt).not.toBeNull();
    expect(after.updatedAt).toBe(before);
  });

  it('updatePrompt updates updatedAt', async () => {
    const p = await promptRepo.createPrompt({ title: 't', content: 'c' });
    const before = p.updatedAt;
    const updated = await promptRepo.updatePrompt(p.id, { title: 't2' });
    expect(updated.updatedAt).not.toBe(before);
  });

  it('deletePrompt removes a prompt', async () => {
    const p = await promptRepo.createPrompt({ title: 't', content: 'c' });
    await promptRepo.deletePrompt(p.id);
    expect(await promptRepo.getPrompt(p.id)).toBeUndefined();
  });
});

describe('db', () => {
  it('uses the expected db name', () => {
    expect(DB_NAME).toBe('prompt-library');
  });
});

