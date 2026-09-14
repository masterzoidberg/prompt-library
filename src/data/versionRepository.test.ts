import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { ensureSeeded, getDb, resetDbCache } from './db';
import * as folderRepo from './folderRepository';
import * as promptRepo from './promptRepository';
import * as tagRepo from './tagRepository';
import { listPromptVersions } from './versionRepository';

async function resetAll(): Promise<void> {
  await resetDbCache();
  const db = await getDb();
  await db.clear('prompts');
  await db.clear('promptVersions');
  await db.clear('folders');
  await db.clear('tags');
  await db.clear('settings');
  await ensureSeeded();
}

describe('prompt version repository', () => {
  beforeEach(resetAll);

  it('snapshots prior authored fields before a meaningful edit', async () => {
    const prompt = await promptRepo.createPrompt({
      title: 'Original title',
      content: '# Original\n\n{{NAME}}',
      description: 'Original description',
      type: 'template',
      targetTools: ['codex', 'chatgpt'],
      notes: 'Original notes',
      variableDefaults: { NAME: 'Ada' },
    });

    const updated = await promptRepo.updatePrompt(prompt.id, {
      title: 'Updated title',
      content: '# Updated\n\n{{NAME}}',
      description: 'Updated description',
      type: 'instruction',
      targetTools: ['claude'],
      notes: 'Updated notes',
      variableDefaults: { NAME: 'Grace' },
    });

    expect(updated.title).toBe('Updated title');
    await expect(listPromptVersions(prompt.id)).resolves.toEqual([
      {
        id: expect.any(String),
        promptId: prompt.id,
        sequence: 1,
        createdAt: updated.updatedAt,
        reason: 'edit',
        snapshot: {
          title: prompt.title,
          content: prompt.content,
          description: prompt.description,
          type: prompt.type,
          targetTools: prompt.targetTools,
          notes: prompt.notes,
          variableDefaults: prompt.variableDefaults,
        },
      },
    ]);
  });

  it('does not create versions for identical or organizational changes', async () => {
    const folder = await folderRepo.createFolder({ name: 'Writing' });
    const tag = await tagRepo.createTag({ name: 'Work' });
    const prompt = await promptRepo.createPrompt({
      title: 'Prompt',
      content: 'Content',
      variableDefaults: { FIRST: '1', SECOND: '2' },
    });

    await promptRepo.updatePrompt(prompt.id, {
      title: prompt.title,
      content: prompt.content,
      variableDefaults: { SECOND: '2', FIRST: '1' },
    });
    await promptRepo.updatePrompt(prompt.id, {
      variableDefaults: { FIRST: '1', SECOND: '2' },
    });
    await promptRepo.updatePrompt(prompt.id, { folderId: folder.id, tagIds: [tag.id], isFavorite: true });
    await promptRepo.recordCopy(prompt.id);

    await expect(listPromptVersions(prompt.id)).resolves.toEqual([]);
  });

  it('assigns monotonic per-prompt sequences across authored edits', async () => {
    const prompt = await promptRepo.createPrompt({ title: 'Prompt', content: 'One' });

    const first = await promptRepo.updatePrompt(prompt.id, { content: 'Two' });
    const second = await promptRepo.updatePrompt(prompt.id, { content: 'Three' });
    const versions = await listPromptVersions(prompt.id);

    expect(versions.map((version) => version.sequence)).toEqual([1, 2]);
    expect(versions.map((version) => version.snapshot.content)).toEqual(['One', 'Two']);
    expect(versions.every((version) => version.promptId === prompt.id)).toBe(true);
    expect(first.content).toBe('Two');
    expect(second.content).toBe('Three');
  });

  it('restores an old authored snapshot and makes the restore reversible', async () => {
    const prompt = await promptRepo.createPrompt({ title: 'Original', content: 'Original content' });
    await promptRepo.updatePrompt(prompt.id, { title: 'Changed', content: 'Changed content' });
    const originalVersion = (await listPromptVersions(prompt.id))[0];

    const restored = await promptRepo.restorePromptVersion(prompt.id, originalVersion.id);
    const versions = await listPromptVersions(prompt.id);

    expect(restored.title).toBe('Original');
    expect(restored.content).toBe('Original content');
    expect(versions).toHaveLength(2);
    expect(versions[1]).toMatchObject({
      promptId: prompt.id,
      sequence: 2,
      reason: 'restore',
      snapshot: {
        title: 'Changed',
        content: 'Changed content',
      },
    });
  });

  it('duplicates a selected snapshot as a new prompt without creating history', async () => {
    const prompt = await promptRepo.createPrompt({
      title: 'Original',
      content: 'Original content',
      description: 'Original description',
      isFavorite: true,
    });
    await promptRepo.updatePrompt(prompt.id, {
      title: 'Current',
      content: 'Current content',
      description: 'Current description',
    });
    const originalVersion = (await listPromptVersions(prompt.id))[0];

    const duplicate = await promptRepo.duplicatePromptVersion(prompt.id, originalVersion.id);

    expect(duplicate.id).not.toBe(prompt.id);
    expect(duplicate.title).toBe('Copy of Original');
    expect(duplicate.content).toBe('Original content');
    expect(duplicate.description).toBe('Original description');
    expect(duplicate.isFavorite).toBe(false);
    expect(duplicate.copyCount).toBe(0);
    expect(duplicate.lastCopiedAt).toBeNull();
    await expect(listPromptVersions(duplicate.id)).resolves.toEqual([]);
  });

  it.each(['after-version', 'after-prompt'] as const)(
    'rolls back the prompt and version together when failure is injected %s',
    async (failAt) => {
      const prompt = await promptRepo.createPrompt({ title: 'Original', content: 'Original content' });
      const before = await promptRepo.getPrompt(prompt.id);

      await expect(
        promptRepo.updatePrompt(prompt.id, { content: 'Changed content' }, { failAt }),
      ).rejects.toThrow('Injected prompt update failure');

      await expect(promptRepo.getPrompt(prompt.id)).resolves.toEqual(before);
      await expect(listPromptVersions(prompt.id)).resolves.toEqual([]);
    },
  );
});
