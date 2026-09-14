import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { ensureSeeded, getDb, resetDbCache } from './db';
import * as bundleRepo from './bundleRepository';
import * as promptRepo from './promptRepository';

async function resetAll(): Promise<void> {
  await resetDbCache();
  const db = await getDb();
  await db.clear('prompts');
  await db.clear('promptVersions');
  await db.clear('bundles');
  await db.clear('folders');
  await db.clear('tags');
  await db.clear('settings');
  await ensureSeeded();
}

describe('bundle repository', () => {
  beforeEach(resetAll);

  it('creates, lists, updates, reorders, and deletes ordered bundles', async () => {
    const first = await promptRepo.createPrompt({ title: 'First', content: 'First content' });
    const second = await promptRepo.createPrompt({ title: 'Second', content: 'Second content' });

    const created = await bundleRepo.createBundle({
      name: 'Morning flow',
      description: 'An ordered prompt set',
      promptIds: [second.id, first.id],
    });

    expect(created.name).toBe('Morning flow');
    expect(created.description).toBe('An ordered prompt set');
    expect(created.promptIds).toEqual([second.id, first.id]);
    await expect(bundleRepo.listBundles()).resolves.toEqual([created]);

    const updated = await bundleRepo.updateBundle(created.id, { name: 'Updated flow' });
    expect(updated.name).toBe('Updated flow');
    expect(updated.promptIds).toEqual([second.id, first.id]);

    const reordered = await bundleRepo.reorderBundle(created.id, [first.id, second.id]);
    expect(reordered.promptIds).toEqual([first.id, second.id]);
    await expect(bundleRepo.getBundle(created.id)).resolves.toEqual(reordered);

    await bundleRepo.deleteBundle(created.id);
    await expect(bundleRepo.getBundle(created.id)).resolves.toBeUndefined();
  });

  it('rejects duplicate or dangling prompt IDs without partially updating a bundle', async () => {
    const prompt = await promptRepo.createPrompt({ title: 'Prompt', content: 'Content' });

    await expect(
      bundleRepo.createBundle({ name: 'Duplicate members', promptIds: [prompt.id, prompt.id] }),
    ).rejects.toBeInstanceOf(bundleRepo.BundleValidationError);
    await expect(
      bundleRepo.createBundle({ name: 'Missing member', promptIds: ['missing-prompt'] }),
    ).rejects.toBeInstanceOf(bundleRepo.BundleValidationError);

    const bundle = await bundleRepo.createBundle({ name: 'Valid bundle', promptIds: [prompt.id] });
    await expect(
      bundleRepo.updateBundle(bundle.id, { name: 'Should not persist', promptIds: ['missing-prompt'] }),
    ).rejects.toBeInstanceOf(bundleRepo.BundleValidationError);
    await expect(bundleRepo.getBundle(bundle.id)).resolves.toEqual(bundle);

    await expect(bundleRepo.reorderBundle(bundle.id, [prompt.id, prompt.id])).rejects.toBeInstanceOf(
      bundleRepo.BundleValidationError,
    );
    await expect(bundleRepo.getBundle(bundle.id)).resolves.toEqual(bundle);
  });

  it('removes deleted prompts from every bundle while preserving the bundles', async () => {
    const first = await promptRepo.createPrompt({ title: 'First', content: 'First content' });
    const second = await promptRepo.createPrompt({ title: 'Second', content: 'Second content' });
    const firstBundle = await bundleRepo.createBundle({ name: 'Both', promptIds: [first.id, second.id] });
    const secondBundle = await bundleRepo.createBundle({ name: 'Only first', promptIds: [first.id] });

    await promptRepo.deletePrompt(first.id);

    await expect(promptRepo.getPrompt(first.id)).resolves.toBeUndefined();
    await expect(bundleRepo.getBundle(firstBundle.id)).resolves.toMatchObject({
      id: firstBundle.id,
      promptIds: [second.id],
    });
    await expect(bundleRepo.getBundle(secondBundle.id)).resolves.toMatchObject({
      id: secondBundle.id,
      promptIds: [],
    });
  });
});
