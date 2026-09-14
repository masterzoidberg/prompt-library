import { useCallback, useContext } from 'react';
import { LibraryDataContext } from './libraryDataContext';
import * as folderRepo from '../data/folderRepository';
import type { FolderCreate, FolderUpdate } from '../types/folder';

export function useFolders() {
  const ctx = useContext(LibraryDataContext);
  if (!ctx) throw new Error('useFolders must be used within LibraryDataProvider');

  const create = useCallback(
    async (input: FolderCreate) => {
      const f = await folderRepo.createFolder(input);
      await ctx.reload();
      return f;
    },
    [ctx],
  );

  const update = useCallback(
    async (id: string, patch: FolderUpdate) => {
      const f = await folderRepo.updateFolder(id, patch);
      await ctx.reload();
      return f;
    },
    [ctx],
  );

  const remove = useCallback(
    async (id: string) => {
      await folderRepo.deleteFolder(id);
      await ctx.reload();
    },
    [ctx],
  );

  return {
    folders: ctx.folders,
    loading: !ctx.loaded,
    create,
    update,
    remove,
    reload: ctx.reload,
  };
}