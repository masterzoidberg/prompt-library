import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '../common/Button';
import {
  downloadJson,
  exportLibrary,
  exportFilename,
  ImportValidationError,
  prepareRestore,
  restoreLibrary,
  validateExport,
  type PreparedRestore,
} from '../../data/importExport';
import { notify } from '../common/Toast';
import { Dialog } from '../common/Dialog';
import { usePrompts } from '../../hooks/usePrompts';
import { useFolders } from '../../hooks/useFolders';
import { useTags } from '../../hooks/useTags';
import { useSettings } from '../../hooks/useSettings';

export function ImportExportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [preparedRestore, setPreparedRestore] = useState<PreparedRestore | null>(null);
  const [restoreAcknowledged, setRestoreAcknowledged] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const { reload: reloadPrompts } = usePrompts();
  const { reload: reloadFolders } = useFolders();
  const { reload: reloadTags } = useTags();
  const { settings, update: updateSettings, reload: reloadSettings } = useSettings();
  const backupReminderDays = 30;
  const lastBackupPreparedAt = settings?.lastBackupPreparedAt;
  const backupReminderDue =
    !lastBackupPreparedAt || Date.now() - Date.parse(lastBackupPreparedAt) >= backupReminderDays * 24 * 60 * 60 * 1000;

  const handleExport = async () => {
    setBackupStatus(null);
    try {
      const payload = validateExport(await exportLibrary());
      downloadJson(payload, exportFilename());
      const preparedAt = new Date().toISOString();
      try {
        await updateSettings({ lastBackupPreparedAt: preparedAt });
        setBackupStatus('Download initiated; filesystem save is not verified.');
        notify.success('Backup prepared; download initiated');
      } catch {
        setBackupStatus('Download initiated; backup reminder status could not be saved. Filesystem save is not verified.');
        notify.error('Backup downloaded, but reminder status could not be saved');
      }
    } catch {
      notify.error('Export failed');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new ImportValidationError('File must contain valid JSON');
      }
      const prepared = await prepareRestore(raw);
      setPreparedRestore(prepared);
      setRestoreAcknowledged(false);
      setRestoreError(null);
    } catch (err) {
      if (err instanceof ImportValidationError) notify.error(`Invalid file: ${err.message}`);
      else notify.error('Restore preparation failed');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const closeRestore = () => {
    if (restoreBusy) return;
    setPreparedRestore(null);
    setRestoreAcknowledged(false);
    setRestoreError(null);
  };

  const handleRestore = async () => {
    if (!preparedRestore || !restoreAcknowledged || restoreBusy) return;
    setRestoreBusy(true);
    setRestoreError(null);
    try {
      await restoreLibrary(preparedRestore, { preRestoreBackupAcknowledged: true });
      await Promise.all([reloadPrompts(), reloadFolders(), reloadTags(), reloadSettings()]);
      setPreparedRestore(null);
      setRestoreAcknowledged(false);
      notify.success('Library restored');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The restore could not be completed';
      setRestoreError(`Restore blocked: ${message}`);
      notify.error(`Restore blocked: ${message}`);
    } finally {
      setRestoreBusy(false);
    }
  };

  const handlePreRestoreDownload = () => {
    if (!preparedRestore) return;
    try {
      downloadJson(preparedRestore.preRestoreBackup, exportFilename());
      setBackupStatus('Pre-restore backup download initiated; filesystem save is not verified.');
    } catch {
      notify.error('Pre-restore backup download failed');
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <h3 className="text-sm font-semibold">Backup</h3>
      <p className="text-xs text-neutral-500">
        Export your entire library to a JSON file, or import a backup to replace the current library.
      </p>
      <p className="text-xs text-neutral-500">
        {backupReminderDue
          ? `Backup reminder due: prepare a fresh export and retain the downloaded file outside this browser profile.`
          : `Last backup prepared ${new Date(lastBackupPreparedAt!).toLocaleString()}; filesystem save is not verified.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Import
        </Button>
        <input
          ref={fileRef}
          aria-label="Import backup file"
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImport(f);
          }}
        />
      </div>
      {backupStatus ? (
        <p role="status" className="text-xs text-neutral-500">
          {backupStatus}
        </p>
      ) : null}
      <Dialog
        open={preparedRestore !== null}
        onOpenChange={(open) => {
          if (!open) closeRestore();
        }}
        title="Restore library"
        description="Review the verified backup before replacing the current library."
      >
        {preparedRestore ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-2 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
              <div>
                <dt className="text-neutral-500">Prompts</dt>
                <dd className="font-semibold">{preparedRestore.summary.prompts} prompts</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Folders</dt>
                <dd className="font-semibold">{preparedRestore.summary.folders} folders</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Tags</dt>
                <dd className="font-semibold">{preparedRestore.summary.tags} tags</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Prompt versions</dt>
                <dd className="font-semibold">{preparedRestore.summary.promptVersions} prompt versions</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Bundles</dt>
                <dd className="font-semibold">{preparedRestore.summary.bundles} bundles</dd>
              </div>
            </dl>
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">A verified pre-restore backup is ready.</p>
              <p className="mt-1 break-all text-xs">
                Checksum: {preparedRestore.preRestoreBackup.checksum}
              </p>
              <Button size="sm" className="mt-3" onClick={handlePreRestoreDownload}>
                Download pre-restore backup
              </Button>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={restoreAcknowledged}
                onChange={(event) => setRestoreAcknowledged(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-accent-600"
              />
              <span>I acknowledge the pre-restore backup and understand this will replace the current library.</span>
            </label>
            {restoreError ? (
              <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {restoreError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button onClick={closeRestore} disabled={restoreBusy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void handleRestore()} disabled={!restoreAcknowledged || restoreBusy}>
                {restoreBusy ? 'Restoring…' : 'Restore library'}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
