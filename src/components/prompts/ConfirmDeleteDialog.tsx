import { useState } from 'react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {error ? <p role="alert" className="pt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)} data-autofocus-safe="true">
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => void handleConfirm()}
          data-autofocus-unsafe="true"
        >
          {busy ? 'Deleting…' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
