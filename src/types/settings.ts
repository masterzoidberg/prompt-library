export type Theme = 'system' | 'light' | 'dark';
export type SortKey = 'recently-updated' | 'recently-created' | 'alphabetical' | 'most-copied';
export type ViewMode = 'card';

export interface Settings {
  schemaVersion: number;
  theme: Theme;
  defaultSort: SortKey;
  viewMode: ViewMode;
  confirmBeforeDelete: boolean;
  rememberedVariableValues?: Record<string, string>;
  lastBackupPreparedAt?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  theme: 'system',
  defaultSort: 'recently-updated',
  viewMode: 'card',
  confirmBeforeDelete: true,
};

export function isSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Settings>;
  const remembered = candidate.rememberedVariableValues;
  const validRememberedValues =
    remembered === undefined ||
    (typeof remembered === 'object' &&
      remembered !== null &&
      !Array.isArray(remembered) &&
      Object.values(remembered).every((entry) => typeof entry === 'string'));
  const lastBackupPreparedAt = candidate.lastBackupPreparedAt;
  return (
    typeof candidate.schemaVersion === 'number' &&
    typeof candidate.theme === 'string' &&
    typeof candidate.defaultSort === 'string' &&
    candidate.viewMode === 'card' &&
    typeof candidate.confirmBeforeDelete === 'boolean' &&
    validRememberedValues &&
    (lastBackupPreparedAt === undefined || typeof lastBackupPreparedAt === 'string')
  );
}
