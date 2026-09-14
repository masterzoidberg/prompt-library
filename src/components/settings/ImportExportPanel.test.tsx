import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import 'fake-indexeddb/auto';
import fixture from '../../test/fixtures/library-v1.json';
import v2Fixture from '../../test/fixtures/library-v2.json';
import { LibraryDataProvider } from '../../hooks/LibraryDataProvider';
import { SettingsProvider } from '../../hooks/SettingsProvider';
import { resetDbCache, getDb, ensureSeeded } from '../../data/db';
import { getSettings } from '../../data/settingsRepository';
import * as importExport from '../../data/importExport';
import { notify } from '../common/Toast';
import { ImportExportPanel } from './ImportExportPanel';
import type { ExportPayload } from '../../data/importExport';
import type { PreparedRestore, V2ExportPayload } from '../../data/importExport';

beforeEach(async () => {
  await resetDbCache();
  const db = await getDb();
  await db.clear('prompts');
  await db.clear('folders');
  await db.clear('tags');
  await db.clear('settings');
  await ensureSeeded();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPanel() {
  return render(
    <SettingsProvider>
      <LibraryDataProvider>
        <ImportExportPanel />
      </LibraryDataProvider>
    </SettingsProvider>,
  );
}

describe('ImportExportPanel backup status', () => {
  it('reports download initiation without claiming filesystem durability', async () => {
    vi.spyOn(importExport, 'exportLibrary').mockResolvedValue(fixture as unknown as ExportPayload);
    const downloadSpy = vi.spyOn(importExport, 'downloadJson').mockImplementation(() => undefined);
    const successSpy = vi.spyOn(notify, 'success').mockImplementation(() => undefined);

    renderPanel();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(downloadSpy).toHaveBeenCalledOnce());
    expect(successSpy).toHaveBeenCalledWith('Backup prepared; download initiated');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Download initiated; filesystem save is not verified.',
    );
    expect((await getSettings()).lastBackupPreparedAt).toEqual(expect.any(String));
  });

  it('reports download failures without showing a successful status', async () => {
    vi.spyOn(importExport, 'exportLibrary').mockResolvedValue(fixture as unknown as ExportPayload);
    vi.spyOn(importExport, 'downloadJson').mockImplementation(() => {
      throw new Error('download blocked');
    });
    const errorSpy = vi.spyOn(notify, 'error').mockImplementation(() => undefined);

    renderPanel();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Export failed'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('validates the exported payload before invoking the downloader', async () => {
    const invalid = { ...(fixture as unknown as ExportPayload), version: 2 };
    vi.spyOn(importExport, 'exportLibrary').mockResolvedValue(invalid);
    const downloadSpy = vi.spyOn(importExport, 'downloadJson').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(notify, 'error').mockImplementation(() => undefined);

    renderPanel();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Export failed'));
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('stages a restore with a summary and requires backup acknowledgement', async () => {
    const prepared: PreparedRestore = {
      payload: v2Fixture as unknown as V2ExportPayload,
      preRestoreBackup: v2Fixture as unknown as V2ExportPayload,
      summary: { prompts: 2, folders: 3, tags: 4, promptVersions: 3, bundles: 2 },
    };
    const prepareSpy = vi.spyOn(importExport, 'prepareRestore').mockResolvedValue(prepared);
    const restoreSpy = vi.spyOn(importExport, 'restoreLibrary').mockResolvedValue(undefined);
    const successSpy = vi.spyOn(notify, 'success').mockImplementation(() => undefined);

    renderPanel();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => '{}' });
    fireEvent.change(fileInput, {
      target: { files: [file] },
    });
    await waitFor(() => expect(prepareSpy).toHaveBeenCalled());

    const dialog = await screen.findByRole('dialog', { name: 'Restore library' });
    expect(dialog).toHaveTextContent('2 prompts');
    expect(dialog).toHaveTextContent('3 folders');
    expect(dialog).toHaveTextContent('4 tags');
    expect(dialog).toHaveTextContent('3 prompt versions');
    expect(dialog).toHaveTextContent('2 bundles');
    const dialogQueries = within(dialog);
    const restoreButton = dialogQueries.getByRole('button', { name: 'Restore library', exact: true });
    expect(restoreButton).toBeDisabled();
    expect(restoreSpy).not.toHaveBeenCalled();

    await userEvent.setup().click(dialogQueries.getByRole('checkbox', { name: /pre-restore backup/i }));
    await userEvent.setup().click(restoreButton);

    await waitFor(() => expect(restoreSpy).toHaveBeenCalledWith(prepared, { preRestoreBackupAcknowledged: true }));
    expect(successSpy).toHaveBeenCalledWith('Library restored');
  });
});
