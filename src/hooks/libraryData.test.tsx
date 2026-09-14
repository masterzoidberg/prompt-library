import React, { useEffect } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, act, screen, waitFor } from '@testing-library/react';
import { LibraryDataProvider } from './LibraryDataProvider';
import { useFolders } from './useFolders';
import { useBundles } from './useBundles';
import { useLibraryData } from './useLibraryData';
import { resetDbCache, getDb, ensureSeeded } from '../data/db';
import * as promptRepo from '../data/promptRepository';

beforeEach(async () => {
  await resetDbCache();
  const db = await getDb();
  await db.clear('prompts');
  await db.clear('bundles');
  await db.clear('folders');
  await db.clear('tags');
  await db.clear('settings');
  await ensureSeeded();
});

function ContextConsumer({ onUpdate }: { onUpdate: (snap: ReturnType<typeof useLibraryData>) => void }) {
  const snap = useLibraryData();
  useEffect(() => {
    onUpdate(snap);
  });
  return null;
}

function FoldersConsumer({ onUpdate }: { onUpdate: (snap: ReturnType<typeof useFolders>) => void }) {
  const snap = useFolders();
  useEffect(() => {
    onUpdate(snap);
  });
  return null;
}

function BundlesConsumer({ onUpdate }: { onUpdate: (snap: ReturnType<typeof useBundles>) => void }) {
  const snap = useBundles();
  useEffect(() => {
    onUpdate(snap);
  });
  return null;
}

function LoadStateConsumer() {
  const { loaded, error, reload } = useLibraryData();
  return (
    <>
      <output>{loaded ? 'loaded' : 'loading'}</output>
      {error ? <p>{error.message}</p> : null}
      <button type="button" onClick={() => void reload()}>
        Retry load
      </button>
    </>
  );
}

async function mount() {
  const ctxHistory: ReturnType<typeof useLibraryData>[] = [];
  const folderHistory: ReturnType<typeof useFolders>[] = [];
  const bundleHistory: ReturnType<typeof useBundles>[] = [];

  render(
    <LibraryDataProvider>
      <ContextConsumer onUpdate={(s) => ctxHistory.push(s)} />
      <FoldersConsumer onUpdate={(s) => folderHistory.push(s)} />
      <BundlesConsumer onUpdate={(s) => bundleHistory.push(s)} />
    </LibraryDataProvider>,
  );

  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

  return {
    latestCtx: () => ctxHistory[ctxHistory.length - 1],
    latestFolders: () => folderHistory[folderHistory.length - 1],
    latestBundles: () => bundleHistory[bundleHistory.length - 1],
  };
}

describe('shared library data context', () => {
  it('loads and creates bundles through the shared data context', async () => {
    const { latestCtx, latestBundles } = await mount();
    const prompt = await promptRepo.createPrompt({ title: 'Bundle member', content: 'content' });

    await act(async () => {
      await latestBundles().create({ name: 'Daily flow', promptIds: [prompt.id] });
    });

    expect(latestBundles().bundles).toHaveLength(1);
    expect(latestBundles().bundles[0].promptIds).toEqual([prompt.id]);
    expect(latestCtx().bundles).toBe(latestBundles().bundles);
  });

  it('creating a folder updates both a context consumer and a useFolders consumer', async () => {
    const { latestCtx, latestFolders } = await mount();

    await act(async () => {
      await latestFolders().create({ name: 'Brand new' });
    });

    expect(latestFolders().folders.map((f) => f.name)).toContain('Brand new');
    expect(latestCtx().folders.map((f) => f.name)).toContain('Brand new');
  });

  it('deleting a folder updates both consumers', async () => {
    const { latestCtx, latestFolders } = await mount();

    let createdId = '';
    await act(async () => {
      const f = await latestFolders().create({ name: 'Tmp' });
      createdId = f.id;
    });

    expect(latestCtx().folders.map((f) => f.id)).toContain(createdId);

    await act(async () => {
      await latestFolders().remove(createdId);
    });

    expect(latestFolders().folders.map((f) => f.id)).not.toContain(createdId);
    expect(latestCtx().folders.map((f) => f.id)).not.toContain(createdId);
  });

  it('the context is shared (same Provider instance) so reload triggers updates for all consumers', async () => {
    const { latestCtx, latestFolders } = await mount();
    const initialFoldersRef = latestFolders().folders;
    void initialFoldersRef;

    await act(async () => {
      await latestFolders().create({ name: 'Another' });
    });

    expect(latestCtx().folders).toBe(latestFolders().folders);
    expect(latestCtx().loaded).toBe(true);
  });

  it('exposes repository load failures and recovers on retry', async () => {
    const loadError = new Error('prompt store unavailable');
    vi.spyOn(promptRepo, 'listPrompts')
      .mockRejectedValueOnce(loadError)
      .mockResolvedValueOnce([]);

    render(
      <LibraryDataProvider>
        <LoadStateConsumer />
      </LibraryDataProvider>,
    );

    expect(await screen.findByText('prompt store unavailable')).toBeInTheDocument();
    expect(screen.getByText('loading')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: 'Retry load' }).click();
    });

    await waitFor(() => expect(screen.getByText('loaded')).toBeInTheDocument());
    expect(screen.queryByText('prompt store unavailable')).not.toBeInTheDocument();
  });
});
