import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import fixture from '../test/fixtures/library-v1.json';
import type { ExportPayload } from './importExport';
import { exportLibrary, importLibrary } from './importExport';
import { getMigrationJournal, runMigrations } from './migrations';
import { resetDbCache, getDb, ensureSeeded } from './db';
import { buildLibraryFixture } from '../test/builders/libraryBuilder';
import { toPromptV1 } from '../types/prompt';

const libraryFixture = fixture as unknown as ExportPayload;

function normalizeExportedAt(payload: ExportPayload): ExportPayload {
  return { ...payload, exportedAt: '<normalized>' };
}

beforeEach(async () => {
  await resetDbCache();
  const db = await getDb();
  await db.clear('prompts');
  await db.clear('folders');
  await db.clear('tags');
  await db.clear('settings');
  await ensureSeeded();
});

describe('v1 migration runner', () => {
  it('runs the v1 no-op step idempotently and records verification', async () => {
    await importLibrary(libraryFixture);
    const before = await exportLibrary();

    await runMigrations();
    await runMigrations();

    const after = await exportLibrary();
    expect(normalizeExportedAt(after)).toEqual(normalizeExportedAt(before));
    const db = await getDb();
    expect(Array.from(db.objectStoreNames)).toEqual(
      expect.arrayContaining(['promptVersions', 'bundles']),
    );
    const migratedPrompts = await db.getAll('prompts');
    expect(migratedPrompts).toHaveLength(libraryFixture.prompts.length);
    expect(migratedPrompts).toEqual(
      expect.arrayContaining(
        libraryFixture.prompts.map((prompt) =>
          expect.objectContaining({
            id: prompt.id,
            type: 'prompt',
            targetTools: [],
            variableDefaults: {},
          }),
        ),
      ),
    );
    expect(await getMigrationJournal()).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      status: 'complete',
      verification: {
        promptCount: libraryFixture.prompts.length,
        folderCount: libraryFixture.folders.length,
        tagCount: libraryFixture.tags.length,
      },
    });
  });

  it('retains v1 records after an injected migration failure and recovers on retry', async () => {
    await importLibrary(libraryFixture);
    const before = await exportLibrary();

    await expect(runMigrations({ failAt: 'before-complete' })).rejects.toThrow(
      'Injected migration failure',
    );

    const afterFailure = await exportLibrary();
    expect(normalizeExportedAt(afterFailure)).toEqual(normalizeExportedAt(before));
    const failedPrompts = await (await getDb()).getAll('prompts');
    expect(failedPrompts.every((prompt) => !('type' in prompt))).toBe(true);
    expect(await getMigrationJournal()).toMatchObject({ status: 'failed' });

    await runMigrations();
    expect(await getMigrationJournal()).toMatchObject({ status: 'complete' });
    const recoveredPrompts = await (await getDb()).getAll('prompts');
    expect(recoveredPrompts.every((prompt) => 'type' in prompt)).toBe(true);
    expect(normalizeExportedAt(await exportLibrary())).toEqual(normalizeExportedAt(before));
  });

  it.each([0, 100, 5000])('migrates a deterministic %s-prompt library without old-field loss', async (size) => {
    const payload = size === 0 ? { ...libraryFixture, prompts: [] } : buildLibraryFixture(size);
    await importLibrary(payload);

    await runMigrations();

    const migrated = await (await getDb()).getAll('prompts');
    expect(migrated).toHaveLength(size);
    expect(migrated.map(toPromptV1).sort((left, right) => left.id.localeCompare(right.id))).toEqual(
      payload.prompts.slice().sort((left, right) => left.id.localeCompare(right.id)),
    );
  }, 120000);
});
