import { useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { View, DialogKind, AppState } from '../types/appState';
import { AppStateContext } from './appStateContext';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [view, setViewState] = useState<View>({ kind: 'all' });
  const [dialog, setDialog] = useState<DialogKind>({ kind: 'none' });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const setView = useCallback((v: View) => {
    setViewState(v);
    if (v.kind !== 'tag') setSelectedTagIds([]);
  }, []);

  const setDialogState = useCallback((d: DialogKind) => setDialog(d), []);

  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  }, []);

  const clearTagFilters = useCallback(() => setSelectedTagIds([]), []);

  const value = useMemo<AppState>(
    () => ({
      view,
      dialog,
      paletteOpen,
      selectedTagIds,
      setView,
      setDialog: setDialogState,
      setPaletteOpen,
      toggleTagFilter,
      clearTagFilters,
    }),
    [view, dialog, paletteOpen, selectedTagIds, setView, setDialogState, setPaletteOpen, toggleTagFilter, clearTagFilters],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
