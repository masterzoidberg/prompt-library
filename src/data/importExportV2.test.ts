import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import fixture from '../test/fixtures/library-v2.json';
import legacyFixture from '../test/fixtures/library-v1.json';
import {
  exportLibrary,
  importLibrary,
  serializeExport,
  validateExport,
  verifyExportChecksum,
  type ExportPayload,
  type V2ExportPayload,
} from './importExport';
import { ImportValidationError } from './importExport';
import { ensureSeeded, getDb, resetDbCache } from './db';

const libraryFixture = fixture as unknown as V2ExportPayload;
const legacyLibraryFixture = legacyFixture as unknown as ExportPayload;

function clonePayload<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T;
}

function normalizeExportedAt(payload: V2ExportPayload): V2ExportPayload {
  return { ...payload, exportedAt: '<normalized>' };
}

beforeEach(async () => {
  await resetDbCache();
  const db = await getDb();
  await Promise.all([
    db.clear('prompts'),
    db.clear('promptVersions'),
    db.clear('bundles'),
    db.clear('folders'),
    db.clear('tags'),
    db.clear('settings'),
  ]);
  await ensureSeeded();
});

describe('canonical v2 export', () => {
  it('validates the deterministic fixture and its checksum', async () => {
    const validated = validateExport(libraryFixture);

    expect(validated).toEqual(libraryFixture);
    expect(await verifyExportChecksum(validated)).toBe(true);
  });

  it('round-trips all v2 entities, authored fields, versions, settings, and bundle order', async () => {
    await importLibrary(libraryFixture);

    const exported = await exportLibrary();
    expect(exported.formatVersion).toBe(2);
    expect(normalizeExportedAt(exported)).toEqual(normalizeExportedAt(libraryFixture));
    expect(exported.data.bundles[0].promptIds).toEqual(['prompt-002', 'prompt-001']);
    expect(JSON.parse(serializeExport(exported))).toEqual(exported);
  });

  it('rejects altered data through checksum validation without mutating the database', async () => {
    await importLibrary(libraryFixture);
    const before = await exportLibrary();
    const altered = clonePayload(before);
    altered.data.prompts[0].content += '\nAltered';

    expect(await verifyExportChecksum(altered)).toBe(false);
    await expect(importLibrary(altered)).rejects.toBeInstanceOf(ImportValidationError);
    expect(normalizeExportedAt(await exportLibrary())).toEqual(normalizeExportedAt(before));
  });

  it('rejects future canonical versions and incorrect manifest counts', () => {
    const future = clonePayload(libraryFixture);
    future.formatVersion = 3;
    expect(() => validateExport(future)).toThrow(/Unsupported backup version/);

    const wrongCount = clonePayload(libraryFixture);
    wrongCount.summary.counts.bundles = 99;
    expect(() => validateExport(wrongCount)).toThrow(/summary/);
  });

  it('rejects dangling bundle members and duplicate version sequences', () => {
    const danglingBundle = clonePayload(libraryFixture);
    danglingBundle.data.bundles[0].promptIds = ['missing-prompt'];
    expect(() => validateExport(danglingBundle)).toThrow(/promptIds/);

    const duplicateSequence = clonePayload(libraryFixture);
    duplicateSequence.data.promptVersions.push({
      ...duplicateSequence.data.promptVersions[0],
      id: 'version-duplicate',
    });
    expect(() => validateExport(duplicateSequence)).toThrow(/sequences must be unique/);
  });

  it('continues to import the existing valid v1 backup', async () => {
    await importLibrary(legacyLibraryFixture);
    const exported = await exportLibrary();

    expect(exported.data.prompts.map((prompt) => prompt.id)).toEqual(
      legacyLibraryFixture.prompts.map((prompt) => prompt.id),
    );
    expect(exported.data.bundles).toEqual([]);
    expect(exported.data.promptVersions).toEqual([]);
  });
});
