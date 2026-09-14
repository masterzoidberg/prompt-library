import { createContext } from 'react';
import type { Prompt, Folder, Tag, Bundle } from '../types';

export interface LibraryDataState {
  prompts: Prompt[];
  bundles: Bundle[];
  folders: Folder[];
  tags: Tag[];
  loaded: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

export const LibraryDataContext = createContext<LibraryDataState | null>(null);
