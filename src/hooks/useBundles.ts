import { useCallback, useContext } from 'react';
import { LibraryDataContext } from './libraryDataContext';
import * as bundleRepo from '../data/bundleRepository';
import type { BundleCreate, BundleUpdate } from '../types/bundle';

export function useBundles() {
  const ctx = useContext(LibraryDataContext);
  if (!ctx) throw new Error('useBundles must be used within LibraryDataProvider');

  const create = useCallback(
    async (input: BundleCreate) => {
      const bundle = await bundleRepo.createBundle(input);
      await ctx.reload();
      return bundle;
    },
    [ctx],
  );

  const update = useCallback(
    async (id: string, patch: BundleUpdate) => {
      const bundle = await bundleRepo.updateBundle(id, patch);
      await ctx.reload();
      return bundle;
    },
    [ctx],
  );

  const remove = useCallback(
    async (id: string) => {
      await bundleRepo.deleteBundle(id);
      await ctx.reload();
    },
    [ctx],
  );

  const reorder = useCallback(
    async (id: string, promptIds: string[]) => {
      const bundle = await bundleRepo.reorderBundle(id, promptIds);
      await ctx.reload();
      return bundle;
    },
    [ctx],
  );

  return {
    bundles: ctx.bundles,
    loading: !ctx.loaded,
    create,
    update,
    remove,
    reorder,
    reload: ctx.reload,
  };
}
