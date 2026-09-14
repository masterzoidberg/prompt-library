import { useState } from 'react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { useFolders } from '../../hooks/useFolders';
import { SYSTEM_FOLDER_ID } from '../../config/constants';

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolderId: string;
  onMove: (folderId: string) => void | Promise<void>;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  currentFolderId,
  onMove,
}: MoveToFolderDialogProps) {
  const { folders } = useFolders();
  const [selected, setSelected] = useState(currentFolderId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Move to folder">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        autoFocus
      >
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={selected === currentFolderId}
          onClick={async () => {
            await onMove(selected === SYSTEM_FOLDER_ID ? '' : selected);
            onOpenChange(false);
          }}
        >
          Move
        </Button>
      </div>
    </Dialog>
  );
}