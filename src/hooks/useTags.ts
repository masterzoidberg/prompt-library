import { useCallback, useContext } from 'react';
import { LibraryDataContext } from './libraryDataContext';
import * as tagRepo from '../data/tagRepository';
import type { TagCreate, TagUpdate } from '../types/tag';

export function useTags() {
  const ctx = useContext(LibraryDataContext);
  if (!ctx) throw new Error('useTags must be used within LibraryDataProvider');

  const create = useCallback(
    async (input: TagCreate) => {
      const t = await tagRepo.createTag(input);
      await ctx.reload();
      return t;
    },
    [ctx],
  );

  const update = useCallback(
    async (id: string, patch: TagUpdate) => {
      const t = await tagRepo.updateTag(id, patch);
      await ctx.reload();
      return t;
    },
    [ctx],
  );

  const remove = useCallback(
    async (id: string) => {
      await tagRepo.deleteTag(id);
      await ctx.reload();
    },
    [ctx],
  );

  return {
    tags: ctx.tags,
    loading: !ctx.loaded,
    create,
    update,
    remove,
    reload: ctx.reload,
  };
}