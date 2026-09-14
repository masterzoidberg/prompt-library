import { useCallback, useContext } from 'react';
import { LibraryDataContext } from './libraryDataContext';
import * as promptRepo from '../data/promptRepository';
import type { PromptCreate, PromptUpdate } from '../types/prompt';

export function usePrompts() {
  const ctx = useContext(LibraryDataContext);
  if (!ctx) throw new Error('usePrompts must be used within LibraryDataProvider');

  const create = useCallback(
    async (input: PromptCreate) => {
      const p = await promptRepo.createPrompt(input);
      await ctx.reload();
      return p;
    },
    [ctx],
  );

  const update = useCallback(
    async (id: string, patch: PromptUpdate) => {
      const p = await promptRepo.updatePrompt(id, patch);
      await ctx.reload();
      return p;
    },
    [ctx],
  );

  const remove = useCallback(
    async (id: string) => {
      await promptRepo.deletePrompt(id);
      await ctx.reload();
    },
    [ctx],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const p = await promptRepo.duplicatePrompt(id);
      await ctx.reload();
      return p;
    },
    [ctx],
  );

  const copy = useCallback(
    async (id: string) => {
      const p = await promptRepo.recordCopy(id);
      await ctx.reload();
      return p;
    },
    [ctx],
  );

  const restoreVersion = useCallback(
    async (promptId: string, versionId: string) => {
      const p = await promptRepo.restorePromptVersion(promptId, versionId);
      await ctx.reload();
      return p;
    },
    [ctx],
  );

  const duplicateVersion = useCallback(
    async (promptId: string, versionId: string) => {
      const p = await promptRepo.duplicatePromptVersion(promptId, versionId);
      await ctx.reload();
      return p;
    },
    [ctx],
  );

  return {
    prompts: ctx.prompts,
    loading: !ctx.loaded,
    create,
    update,
    remove,
    duplicate,
    restoreVersion,
    duplicateVersion,
    copy,
    reload: ctx.reload,
  };
}
