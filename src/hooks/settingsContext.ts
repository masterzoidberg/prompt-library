import { createContext } from 'react';
import type { Settings } from '../types/settings';

export interface SettingsContextValue {
  settings: Settings | null;
  loading: boolean;
  error: Error | null;
  update: (patch: Partial<Settings>) => Promise<Settings>;
  reload: () => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);
