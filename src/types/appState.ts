import type { AssetType, TargetTool } from './prompt';

export type View =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'most-used' }
  | { kind: 'folder'; folderId: string }
  | { kind: 'tag'; tagId: string }
  | { kind: 'search'; query: string }
  | { kind: 'type'; type: AssetType }
  | { kind: 'target-tool'; targetTool: TargetTool }
  | { kind: 'bundle'; bundleId: string };

export type DialogKind =
  | { kind: 'none' }
  | { kind: 'new-prompt' }
  | { kind: 'edit-prompt'; promptId: string }
  | { kind: 'detail-prompt'; promptId: string }
  | { kind: 'new-folder' }
  | { kind: 'rename-folder'; folderId: string }
  | { kind: 'delete-folder'; folderId: string }
  | { kind: 'new-tag' }
  | { kind: 'rename-tag'; tagId: string }
  | { kind: 'delete-tag'; tagId: string }
  | { kind: 'move-prompt'; promptId: string }
  | { kind: 'fill-prompt'; promptId: string }
  | { kind: 'history-prompt'; promptId: string }
  | { kind: 'new-bundle' }
  | { kind: 'edit-bundle'; bundleId: string }
  | { kind: 'delete-bundle'; bundleId: string }
  | { kind: 'delete-prompt'; promptId: string }
  | { kind: 'settings' };

export interface AppState {
  view: View;
  dialog: DialogKind;
  paletteOpen: boolean;
  selectedTagIds: string[];
  setView: (v: View) => void;
  setDialog: (d: DialogKind) => void;
  setPaletteOpen: (open: boolean) => void;
  toggleTagFilter: (tagId: string) => void;
  clearTagFilters: () => void;
}
