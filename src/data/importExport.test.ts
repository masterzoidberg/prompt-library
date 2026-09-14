import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import fixture from '../test/fixtures/library-v1.json';
import {
  validateExport,
  exportLibrary,
  importLibrary,
  EXPORT_FORMAT,
  serializeExport,
  type ExportPayload,
} from './importExport';
import { ImportValidationError } from './importExport';
import { resetDbCache, getDb, ensureSeeded } from './db';
import * as promptRepo from './promptRepository';
import * as folderRepo from './folderRepository';
import * as tagRepo from './tagRepository';
import { toPromptV1 } from '../types';

const libraryFixture = fixture as unknown as ExportPayload;

function clonePayload(payload: ExportPayload): ExportPayload {
  return JSON.parse(JSON.stringify(payload)) as ExportPayload;
}

function normalizeExportedAt(payload: ExportPayload): ExportPayload {
  return { ...payload, exportedAt: '<normalized>' };
}

function basePayload(): ExportPayload {
  return {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    prompts: [],
    folders: [
      {
        id: 'unfiled',
        name: 'Unfiled',
        normalizedName: 'unfiled',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ],
    tags: [],
    settings: {
      schemaVersion: 1,
      theme: 'system',
      defaultSort: 'recently-updated',
      viewMode: 'card',
      confirmBeforeDelete: true,
    },
  };
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

describe('validateExport', () => {
  it('accepts the committed representative v1 fixture without losing fields', () => {
    const validated = validateExport(libraryFixture);

    expect(normalizeExportedAt(validated)).toEqual(normalizeExportedAt(libraryFixture));
  });

  it('accepts a minimal valid payload', () => {
    const v = validateExport(basePayload());
    expect(v.folders).toHaveLength(1);
  });

  it('rejects unknown format', () => {
    const p = basePayload();
    (p as unknown as { format: string }).format = 'other';
    expect(() => validateExport(p)).toThrow(ImportValidationError);
  });

  it('rejects missing system folder', () => {
    const p = basePayload();
    p.folders = [];
    expect(() => validateExport(p)).toThrow(/unfiled/);
  });

  it('rejects prompt referencing unknown folder', () => {
    const p = basePayload();
    p.prompts = [
      {
        id: 'p1',
        title: 't',
        content: 'c',
        folderId: 'missing',
        tagIds: [],
        isFavorite: false,
        copyCount: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        lastCopiedAt: null,
      } as never,
    ];
    expect(() => validateExport(p)).toThrow(/folderId/);
  });

  it('rejects prompt referencing unknown tag', () => {
    const p = basePayload();
    p.prompts = [
      {
        id: 'p1',
        title: 't',
        content: 'c',
        folderId: 'unfiled',
        tagIds: ['nope'],
        isFavorite: false,
        copyCount: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        lastCopiedAt: null,
      } as never,
    ];
    expect(() => validateExport(p)).toThrow(/tag/);
  });

  it('rejects unsupported backup versions', () => {
    for (const version of [0, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const p = clonePayload(libraryFixture);
      p.version = version;
      expect(() => validateExport(p)).toThrow(ImportValidationError);
    }
  });

  it('rejects duplicate prompt, folder, and tag IDs', () => {
    const duplicatePrompt = clonePayload(libraryFixture);
    duplicatePrompt.prompts.push({ ...duplicatePrompt.prompts[0] });
    expect(() => validateExport(duplicatePrompt)).toThrow(ImportValidationError);

    const duplicateFolder = clonePayload(libraryFixture);
    duplicateFolder.folders.push({ ...duplicateFolder.folders[0] });
    expect(() => validateExport(duplicateFolder)).toThrow(ImportValidationError);

    const duplicateTag = clonePayload(libraryFixture);
    duplicateTag.tags.push({ ...duplicateTag.tags[0] });
    expect(() => validateExport(duplicateTag)).toThrow(ImportValidationError);
  });

  it('rejects duplicate or inconsistent normalized folder and tag names', () => {
    const duplicateFolderName = clonePayload(libraryFixture);
    duplicateFolderName.folders.push({
      ...duplicateFolderName.folders[0],
      id: 'folder-duplicate',
      name: '  PERSONAL  ',
      normalizedName: 'personal',
    });
    expect(() => validateExport(duplicateFolderName)).toThrow(ImportValidationError);

    const inconsistentFolderName = clonePayload(libraryFixture);
    inconsistentFolderName.folders[0].normalizedName = 'not-personal';
    expect(() => validateExport(inconsistentFolderName)).toThrow(ImportValidationError);

    const duplicateTagName = clonePayload(libraryFixture);
    duplicateTagName.tags.push({
      ...duplicateTagName.tags[0],
      id: 'tag-duplicate',
      name: '  ai  ',
      normalizedName: 'ai',
    });
    expect(() => validateExport(duplicateTagName)).toThrow(ImportValidationError);

    const inconsistentTagName = clonePayload(libraryFixture);
    inconsistentTagName.tags[0].normalizedName = 'not-ai';
    expect(() => validateExport(inconsistentTagName)).toThrow(ImportValidationError);
  });

  it('requires the exact reserved unfiled folder', () => {
    const missing = clonePayload(libraryFixture);
    missing.folders = missing.folders.filter((folder) => folder.id !== 'unfiled');
    expect(() => validateExport(missing)).toThrow(ImportValidationError);

    const renamed = clonePayload(libraryFixture);
    const unfiled = renamed.folders.find((folder) => folder.id === 'unfiled');
    if (!unfiled) throw new Error('Fixture is missing unfiled');
    unfiled.name = 'Archive';
    unfiled.normalizedName = 'archive';
    expect(() => validateExport(renamed)).toThrow(ImportValidationError);
  });

  it('rejects invalid timestamps and copy counts', () => {
    const invalidExportedAt = clonePayload(libraryFixture);
    invalidExportedAt.exportedAt = '2026-02-30T12:00:00.000Z';
    expect(() => validateExport(invalidExportedAt)).toThrow(ImportValidationError);

    const invalidCreatedAt = clonePayload(libraryFixture);
    invalidCreatedAt.prompts[0].createdAt = 'yesterday';
    expect(() => validateExport(invalidCreatedAt)).toThrow(ImportValidationError);

    const invalidLastCopiedAt = clonePayload(libraryFixture);
    invalidLastCopiedAt.prompts[0].lastCopiedAt = 'not-a-timestamp';
    expect(() => validateExport(invalidLastCopiedAt)).toThrow(ImportValidationError);

    const negativeCount = clonePayload(libraryFixture);
    negativeCount.prompts[0].copyCount = -1;
    expect(() => validateExport(negativeCount)).toThrow(ImportValidationError);

    const fractionalCount = clonePayload(libraryFixture);
    fractionalCount.prompts[0].copyCount = 1.5;
    expect(() => validateExport(fractionalCount)).toThrow(ImportValidationError);

    const infiniteCount = clonePayload(libraryFixture);
    infiniteCount.prompts[0].copyCount = Number.POSITIVE_INFINITY;
    expect(() => validateExport(infiniteCount)).toThrow(ImportValidationError);
  });

  it('validates every settings enum and schema version', () => {
    const invalidTheme = clonePayload(libraryFixture);
    invalidTheme.settings.theme = 'sepia' as never;
    expect(() => validateExport(invalidTheme)).toThrow(ImportValidationError);

    const invalidSort = clonePayload(libraryFixture);
    invalidSort.settings.defaultSort = 'random' as never;
    expect(() => validateExport(invalidSort)).toThrow(ImportValidationError);

    const invalidView = clonePayload(libraryFixture);
    invalidView.settings.viewMode = 'list' as never;
    expect(() => validateExport(invalidView)).toThrow(ImportValidationError);

    const invalidSchema = clonePayload(libraryFixture);
    invalidSchema.settings.schemaVersion = 2;
    expect(() => validateExport(invalidSchema)).toThrow(ImportValidationError);
  });

  it('rejects dangling folder and tag references', () => {
    const danglingFolder = clonePayload(libraryFixture);
    danglingFolder.prompts[0].folderId = 'folder-missing';
    expect(() => validateExport(danglingFolder)).toThrow(ImportValidationError);

    const danglingTag = clonePayload(libraryFixture);
    danglingTag.prompts[0].tagIds = ['tag-missing'];
    expect(() => validateExport(danglingTag)).toThrow(ImportValidationError);
  });
});

describe('exportLibrary / importLibrary', () => {
  it('serializes only a validated v1 payload', () => {
    expect(JSON.parse(serializeExport(libraryFixture))).toEqual(libraryFixture);

    const unsupported = clonePayload(libraryFixture);
    unsupported.version = 2;
    expect(() => serializeExport(unsupported)).toThrow(ImportValidationError);
  });

  it('imports the v1 fixture and exports the equivalent canonical v2 data', async () => {
    await importLibrary(libraryFixture);

    const exported = await exportLibrary();
    expect(exported.formatVersion).toBe(2);
    expect(exported.data.prompts.map(toPromptV1)).toEqual(libraryFixture.prompts);
    expect(exported.data.folders).toEqual(libraryFixture.folders);
    expect(exported.data.tags).toEqual(libraryFixture.tags);
    expect(exported.data.settings).toEqual(libraryFixture.settings);
    expect(exported.data.promptVersions).toEqual([]);
    expect(exported.data.bundles).toEqual([]);
    expect(exported.exportedAt).not.toBe(libraryFixture.exportedAt);
  });

  it('round-trips prompts, folders, and tags', async () => {
    const folder = await folderRepo.createFolder({ name: 'Writing' });
    const tag = await tagRepo.createTag({ name: 'code' });
    const prompt = await promptRepo.createPrompt({
      title: 'Greeting',
      content: 'Hello',
      folderId: folder.id,
      tagIds: [tag.id],
    });

    const payload = await exportLibrary();
    expect(payload.data.prompts).toHaveLength(1);
    expect(payload.data.folders.map((f) => f.name).sort()).toEqual(['Unfiled', 'Writing']);
    expect(payload.data.tags).toHaveLength(1);

    // Clear DB and re-import
    await resetDbCache();
    const db = await getDb();
    await db.clear('prompts');
    await db.clear('folders');
    await db.clear('tags');
    await db.clear('settings');

    await importLibrary(payload);
    const prompts = await promptRepo.listPrompts();
    const folders = await folderRepo.listFolders();
    const tags = await tagRepo.listTags();
    expect(prompts).toHaveLength(1);
    expect(prompts[0].id).toBe(prompt.id);
    expect(folders.length).toBeGreaterThanOrEqual(2);
    expect(tags).toHaveLength(1);
  });

  it('rolls back on validation failure (no partial write)', async () => {
    const before = await exportLibrary();
    const bad = basePayload();
    bad.prompts = [
      {
        id: 'p1',
        title: 't',
        content: 'c',
        folderId: 'does-not-exist',
        tagIds: [],
        isFavorite: false,
        copyCount: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        lastCopiedAt: null,
      } as never,
    ];
    await expect(importLibrary(bad)).rejects.toBeInstanceOf(ImportValidationError);
    const after = await exportLibrary();
    expect(after.prompts).toEqual(before.prompts);
  });

  it('rejects every invalid payload before mutating the active database', async () => {
    await importLibrary(libraryFixture);
    const invalidPayloads: Array<[string, ExportPayload]> = [];

    const addInvalidPayload = (name: string, mutate: (payload: ExportPayload) => void) => {
      const payload = clonePayload(libraryFixture);
      mutate(payload);
      invalidPayloads.push([name, payload]);
    };

    addInvalidPayload('unknown format', (payload) => {
      payload.format = 'other' as never;
    });
    addInvalidPayload('unsupported version', (payload) => {
      payload.version = 2;
    });
    addInvalidPayload('duplicate prompt ID', (payload) => {
      payload.prompts.push({ ...payload.prompts[0] });
    });
    addInvalidPayload('duplicate folder ID', (payload) => {
      payload.folders.push({ ...payload.folders[0] });
    });
    addInvalidPayload('duplicate tag ID', (payload) => {
      payload.tags.push({ ...payload.tags[0] });
    });
    addInvalidPayload('duplicate normalized folder name', (payload) => {
      payload.folders.push({
        ...payload.folders[0],
        id: 'folder-duplicate',
        name: '  PERSONAL  ',
        normalizedName: 'personal',
      });
    });
    addInvalidPayload('duplicate normalized tag name', (payload) => {
      payload.tags.push({
        ...payload.tags[0],
        id: 'tag-duplicate',
        name: '  ai  ',
        normalizedName: 'ai',
      });
    });
    addInvalidPayload('inconsistent normalized folder name', (payload) => {
      payload.folders[0].normalizedName = 'not-personal';
    });
    addInvalidPayload('inconsistent normalized tag name', (payload) => {
      payload.tags[0].normalizedName = 'not-ai';
    });
    addInvalidPayload('wrong reserved folder', (payload) => {
      const unfiled = payload.folders.find((folder) => folder.id === 'unfiled');
      if (!unfiled) throw new Error('Fixture is missing unfiled');
      unfiled.name = 'Archive';
      unfiled.normalizedName = 'archive';
    });
    addInvalidPayload('missing system folder', (payload) => {
      payload.folders = payload.folders.filter((folder) => folder.id !== 'unfiled');
    });
    addInvalidPayload('invalid exported timestamp', (payload) => {
      payload.exportedAt = 'invalid';
    });
    addInvalidPayload('invalid prompt timestamp', (payload) => {
      payload.prompts[0].updatedAt = 'invalid';
    });
    addInvalidPayload('invalid last-copied timestamp', (payload) => {
      payload.prompts[0].lastCopiedAt = 'invalid';
    });
    addInvalidPayload('negative copy count', (payload) => {
      payload.prompts[0].copyCount = -4;
    });
    addInvalidPayload('fractional copy count', (payload) => {
      payload.prompts[0].copyCount = 1.5;
    });
    addInvalidPayload('infinite copy count', (payload) => {
      payload.prompts[0].copyCount = Number.POSITIVE_INFINITY;
    });
    addInvalidPayload('invalid theme', (payload) => {
      payload.settings.theme = 'sepia' as never;
    });
    addInvalidPayload('invalid sort enum', (payload) => {
      payload.settings.defaultSort = 'random' as never;
    });
    addInvalidPayload('invalid view enum', (payload) => {
      payload.settings.viewMode = 'list' as never;
    });
    addInvalidPayload('invalid settings schema version', (payload) => {
      payload.settings.schemaVersion = 2;
    });
    addInvalidPayload('dangling folder reference', (payload) => {
      payload.prompts[0].folderId = 'missing-folder';
    });
    addInvalidPayload('dangling tag reference', (payload) => {
      payload.prompts[0].tagIds = ['missing-tag'];
    });

    for (const [name, invalidPayload] of invalidPayloads) {
      const before = await exportLibrary();
      await expect(importLibrary(invalidPayload), name).rejects.toBeInstanceOf(ImportValidationError);
      const after = await exportLibrary();
      expect(normalizeExportedAt(after), name).toEqual(normalizeExportedAt(before));
    }
  });

  it('continues to accept the existing minimal valid v1 backup', async () => {
    await importLibrary(basePayload());
    const exported = await exportLibrary();

    expect(exported.data.prompts).toEqual([]);
    expect(exported.data.folders).toHaveLength(1);
    expect(exported.data.tags).toEqual([]);
    expect(exported.data.settings).toEqual(basePayload().settings);
  });
});
