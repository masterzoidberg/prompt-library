export type Theme = 'system' | 'light' | 'dark';
export type SortKey = 'recently-updated' | 'recently-created' | 'alphabetical' | 'most-copied';
export type ViewMode = 'card';
export type InterfaceFontFamily = 'system-sans' | 'serif' | 'monospace';
export type PromptFontFamily = 'same-as-interface' | InterfaceFontFamily;
export type PromptLineSpacing = 'compact' | 'normal' | 'relaxed';

export type TypographySettings = {
  interfaceFontFamily: InterfaceFontFamily;
  interfaceFontSize: number;
  promptFontFamily: PromptFontFamily;
  promptFontSize: number;
  promptLineSpacing: PromptLineSpacing;
};

export interface Settings {
  schemaVersion: number;
  theme: Theme;
  defaultSort: SortKey;
  viewMode: ViewMode;
  confirmBeforeDelete: boolean;
  interfaceFontFamily: InterfaceFontFamily;
  interfaceFontSize: number;
  promptFontFamily: PromptFontFamily;
  promptFontSize: number;
  promptLineSpacing: PromptLineSpacing;
  rememberedVariableValues?: Record<string, string>;
  lastBackupPreparedAt?: string;
}

export type LegacyCompatibleSettings = Omit<Settings, keyof TypographySettings> &
  Partial<TypographySettings>;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  theme: 'system',
  defaultSort: 'recently-updated',
  viewMode: 'card',
  confirmBeforeDelete: true,
  interfaceFontFamily: 'system-sans',
  interfaceFontSize: 16,
  promptFontFamily: 'monospace',
  promptFontSize: 14,
  promptLineSpacing: 'normal',
};

export function isInterfaceFontFamily(value: unknown): value is InterfaceFontFamily {
  return value === 'system-sans' || value === 'serif' || value === 'monospace';
}

export function isPromptFontFamily(value: unknown): value is PromptFontFamily {
  return value === 'same-as-interface' || isInterfaceFontFamily(value);
}

export function isPromptLineSpacing(value: unknown): value is PromptLineSpacing {
  return value === 'compact' || value === 'normal' || value === 'relaxed';
}

export function isInterfaceFontSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 13 && value <= 20;
}

export function isPromptFontSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 12 && value <= 24;
}

function isBaseSettings(value: unknown): value is Omit<Settings, keyof TypographySettings> & Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
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
    candidate.schemaVersion === 1 &&
    (candidate.theme === 'system' || candidate.theme === 'light' || candidate.theme === 'dark') &&
    (candidate.defaultSort === 'recently-updated' ||
      candidate.defaultSort === 'recently-created' ||
      candidate.defaultSort === 'alphabetical' ||
      candidate.defaultSort === 'most-copied') &&
    candidate.viewMode === 'card' &&
    typeof candidate.confirmBeforeDelete === 'boolean' &&
    validRememberedValues &&
    (lastBackupPreparedAt === undefined || typeof lastBackupPreparedAt === 'string')
  );
}

export function isSettings(value: unknown): value is LegacyCompatibleSettings {
  if (!isBaseSettings(value)) return false;
  const candidate = value as Partial<TypographySettings>;
  return (
    (candidate.interfaceFontFamily === undefined || isInterfaceFontFamily(candidate.interfaceFontFamily)) &&
    (candidate.interfaceFontSize === undefined || isInterfaceFontSize(candidate.interfaceFontSize)) &&
    (candidate.promptFontFamily === undefined || isPromptFontFamily(candidate.promptFontFamily)) &&
    (candidate.promptFontSize === undefined || isPromptFontSize(candidate.promptFontSize)) &&
    (candidate.promptLineSpacing === undefined || isPromptLineSpacing(candidate.promptLineSpacing))
  );
}

export function normalizeSettings(value: unknown): Settings {
  if (!isBaseSettings(value)) return { ...DEFAULT_SETTINGS };
  const candidate = value as LegacyCompatibleSettings;
  return {
    ...DEFAULT_SETTINGS,
    ...candidate,
    interfaceFontFamily: isInterfaceFontFamily(candidate.interfaceFontFamily)
      ? candidate.interfaceFontFamily
      : DEFAULT_SETTINGS.interfaceFontFamily,
    interfaceFontSize: isInterfaceFontSize(candidate.interfaceFontSize)
      ? candidate.interfaceFontSize
      : DEFAULT_SETTINGS.interfaceFontSize,
    promptFontFamily: isPromptFontFamily(candidate.promptFontFamily)
      ? candidate.promptFontFamily
      : DEFAULT_SETTINGS.promptFontFamily,
    promptFontSize: isPromptFontSize(candidate.promptFontSize)
      ? candidate.promptFontSize
      : DEFAULT_SETTINGS.promptFontSize,
    promptLineSpacing: isPromptLineSpacing(candidate.promptLineSpacing)
      ? candidate.promptLineSpacing
      : DEFAULT_SETTINGS.promptLineSpacing,
  };
}
