import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import fixture from '../test/fixtures/library-v2.json';
import legacyFixture from '../test/fixtures/library-v1.json';
import {
  exportLibrary,
  importLibrary,
  prepareRestore,
  restoreLibrary,
  type ExportPayload,
  type PreparedRestore,
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

describe('staged restore', () => {
  const acknowledgement = { preRestoreBackupAcknowledged: true } as const;

  it('requires explicit acknowledgement before replacement', async () => {
    await importLibrary(legacyLibraryFixture);
    const before = await exportLibrary();
    const prepared = await prepareRestore(libraryFixture);

    await expect(restoreLibrary(prepared, {} as never)).rejects.toThrow(/acknowledgement/);
    expect(normalizeExportedAt(await exportLibrary())).toEqual(normalizeExportedAt(before));
  });

  it('prepares a validated candidate and a verified pre-restore backup without mutation', async () => {
    await importLibrary(legacyLibraryFixture);
    const before = await exportLibrary();

    const prepared = await prepareRestore(libraryFixture);

    expect(prepared.payload).toEqual(libraryFixture);
    expect(prepared.preRestoreBackup.formatVersion).toBe(2);
    expect(prepared.preRestoreBackup.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(normalizeExportedAt(await exportLibrary())).toEqual(normalizeExportedAt(before));
  });

  it('rejects a tampered candidate before preparing or mutating active data', async () => {
    await importLibrary(legacyLibraryFixture);
    const before = await exportLibrary();
    const tampered = clonePayload(libraryFixture);
    tampered.data.prompts[0].content += '\nTampered';

    await expect(prepareRestore(tampered)).rejects.toBeInstanceOf(ImportValidationError);
    expect(normalizeExportedAt(await exportLibrary())).toEqual(normalizeExportedAt(before));
  });

  it('restores the prepared candidate and verifies the post-commit export', async () => {
    await importLibrary(legacyLibraryFixture);
    const prepared = await prepareRestore(libraryFixture);

    await restoreLibrary(prepared, acknowledgement);

    expect(normalizeExportedAt(await exportLibrary())).toEqual(normalizeExportedAt(libraryFixture));
  });

  it('keeps v1 restore compatibility while verifying the resulting canonical v2 data', async () => {
    await importLibrary(libraryFixture);
    const prepared: PreparedRestore = await prepareRestore(legacyLibraryFixture);

    await restoreLibrary(prepared, acknowledgement);

    const restored = await exportLibrary();
    expect(restored.data.prompts.map((prompt) => prompt.id)).toEqual(
      legacyLibraryFixture.prompts.map((prompt) => prompt.id),
    );
    expect(restored.data.promptVersions).toEqual([]);
    expect(restored.data.bundles).toEqual([]);
  });

  it('rolls back an IndexedDB commit failure without losing the active library', async () => {
    await importLibrary(legacyLibraryFixture);
    const before = await exportLibrary();
    const prepared = await prepareRestore(libraryFixture);
    const db = await getDb();
    const originalTransaction = db.transaction.bind(db);
    const transactionSpy = vi.spyOn(db, 'transaction').mockImplementation((...args) => {
      const tx = originalTransaction(...args);
      if (Array.isArray(args[0]) && args[0].length === 6) {
        void tx.done.catch(() => undefined);
        tx.abort();
      }
      return tx;
    });

    try {
      await expect(restoreLibrary(prepared, acknowledgement)).rejects.toThrow();
    } finally {
      transactionSpy.mockRestore();
    }

    expect(normalizeExportedAt(await exportLibrary())).toEqual(normalizeExportedAt(before));
  });

  it('blocks success when the post-commit export does not match the candidate', async () => {
    await importLibrary(legacyLibraryFixture);
    const prepared = await prepareRestore(libraryFixture);
    const db = await getDb();
    const transactionSpy = injectStorePutFailure(db, 'prompts', (value, key, originalPut) => {
      if (isPromptRecord(value) && value.id === 'prompt-001') {
        return originalPut({ ...value, content: `${value.content} corrupted` }, key);
      }
      return originalPut(value, key);
    });

    try {
      await expect(restoreLibrary(prepared, acknowledgement)).rejects.toThrow(/did not match/);
    } finally {
      transactionSpy.mockRestore();
    }
  });
});

function isPromptRecord(value: unknown): value is { id: string; content: string } {
  return Boolean(value && typeof value === 'object' && 'id' in value && 'content' in value);
}

function injectStorePutFailure(
  db: Awaited<ReturnType<typeof getDb>>,
  storeName: 'folders' | 'prompts',
  mutate: (
    value: unknown,
    key: IDBValidKey | undefined,
    originalPut: (value: unknown, key?: IDBValidKey) => IDBRequest,
  ) => IDBRequest,
) {
  const originalTransaction = db.transaction.bind(db);
  return vi.spyOn(db, 'transaction').mockImplementation((...args) => {
    const tx = originalTransaction(...args);
    const requestedStores = Array.isArray(args[0]) ? args[0] : [args[0]];
    if (!requestedStores.includes(storeName)) return tx;
    const originalObjectStore = tx.objectStore.bind(tx);
    const store = originalObjectStore(storeName);
    const originalPut = store.put.bind(store) as (value: unknown, key?: IDBValidKey) => IDBRequest;
    vi.spyOn(store, 'put').mockImplementation((value, key) => mutate(value, key, originalPut));
    vi.spyOn(tx, 'objectStore').mockImplementation((name) =>
      name === storeName ? store : originalObjectStore(name),
    );
    return tx;
  });
}
