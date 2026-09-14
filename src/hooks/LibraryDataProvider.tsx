import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Prompt, Folder, Tag, Bundle } from '../types';
import { LibraryDataContext, type LibraryDataState } from './libraryDataContext';
import * as promptRepo from '../data/promptRepository';
import * as folderRepo from '../data/folderRepository';
import * as tagRepo from '../data/tagRepository';
import * as bundleRepo from '../data/bundleRepository';

function toError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

export function LibraryDataProvider({ children }: { children: ReactNode }) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    try {
      const [p, f, t, b] = await Promise.all([
        promptRepo.listPrompts(),
        folderRepo.listFolders(),
        tagRepo.listTags(),
        bundleRepo.listBundles(),
      ]);
      setPrompts(p);
      setBundles(b);
      setFolders(f);
      setTags(t);
      setError(null);
      setLoaded(true);
    } catch (cause) {
      const loadError = toError(cause, 'Failed to load library data');
      setError(loadError);
      throw loadError;
    }
  }, []);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  const value = useMemo<LibraryDataState>(
    () => ({ prompts, bundles, folders, tags, loaded, error, reload }),
    [prompts, bundles, folders, tags, loaded, error, reload],
  );

  return <LibraryDataContext.Provider value={value}>{children}</LibraryDataContext.Provider>;
}
