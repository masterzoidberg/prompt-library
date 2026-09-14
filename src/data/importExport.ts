import type {
  PromptV1,
  Prompt,
  PromptVersion,
  PromptVersionSnapshot,
  Bundle,
  Folder,
  Tag,
  Settings,
} from '../types';
import { isAssetType, isTargetTool, withPromptDefaults } from '../types';
import { SYSTEM_FOLDER_ID, SYSTEM_FOLDER_NAME, SETTINGS_KEY, DB_VERSION } from '../config/constants';
import { DEFAULT_SETTINGS, isSettings } from '../types/settings';
import { normalizeName } from '../utils/normalize';
import { getDb } from './db';
import packageJson from '../../package.json';

export const EXPORT_FORMAT = 'prompt-library-backup';
export const EXPORT_VERSION = 1;
export const CANONICAL_EXPORT_VERSION = 2;
export const APP_VERSION = packageJson.version;

export interface V1ExportPayload {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  prompts: PromptV1[];
  folders: Folder[];
  tags: Tag[];
  settings: Settings;
}

export interface V2ExportData {
  prompts: Prompt[];
  folders: Folder[];
  tags: Tag[];
  settings: Settings;
  promptVersions: PromptVersion[];
  bundles: Bundle[];
}

export interface V2ExportSummary {
  counts: {
    prompts: number;
    folders: number;
    tags: number;
    promptVersions: number;
    bundles: number;
  };
}

export interface V2ExportPayload {
  format: typeof EXPORT_FORMAT;
  formatVersion: typeof CANONICAL_EXPORT_VERSION;
  appVersion: string;
  exportedAt: string;
  data: V2ExportData;
  summary: V2ExportSummary;
  checksum: string;
}

export type ExportPayload = V1ExportPayload | V2ExportPayload;

export interface RestoreSummary {
  prompts: number;
  folders: number;
  tags: number;
  promptVersions: number;
  bundles: number;
}

export interface PreparedRestore {
  payload: ExportPayload;
  preRestoreBackup: V2ExportPayload;
  summary: RestoreSummary;
}

export interface RestoreAcknowledgement {
  preRestoreBackupAcknowledged: true;
}

export class RestoreVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreVerificationError';
  }
}

export class ImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportValidationError';
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function requireString(obj: Record<string, unknown>, key: string, path: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !v) {
    throw new ImportValidationError(`${path}.${key} must be a non-empty string`);
  }
  return v;
}

const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

function isValidIsoTimestamp(value: string): boolean {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, offsetHourText, offsetMinuteText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  if (zone !== 'Z' && (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59)) return false;

  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(0, 0, 0, 0);
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function requireIsoTimestamp(obj: Record<string, unknown>, key: string, path: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || !isValidIsoTimestamp(value)) {
    throw new ImportValidationError(`${path}.${key} must be a valid ISO timestamp`);
  }
  return value;
}

function optionalString(obj: Record<string, unknown>, key: string, path: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new ImportValidationError(`${path}.${key} must be a string`);
  return v;
}

function requireNumber(obj: Record<string, unknown>, key: string, path: string): number {
  const v = obj[key];
  if (typeof v !== 'number') throw new ImportValidationError(`${path}.${key} must be a number`);
  return v;
}

function requireNonNegativeInteger(obj: Record<string, unknown>, key: string, path: string): number {
  const value = requireNumber(obj, key, path);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new ImportValidationError(`${path}.${key} must be a finite, non-negative integer`);
  }
  return value;
}

function requireBoolean(obj: Record<string, unknown>, key: string, path: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') throw new ImportValidationError(`${path}.${key} must be a boolean`);
  return v;
}

function requireArray(obj: Record<string, unknown>, key: string, path: string): unknown[] {
  const v = obj[key];
  if (!Array.isArray(v)) throw new ImportValidationError(`${path}.${key} must be an array`);
  return v;
}

function requireStringRecord(obj: Record<string, unknown>, key: string, path: string): Record<string, string> {
  const value = obj[key];
  if (!isObject(value)) throw new ImportValidationError(`${path}.${key} must be an object`);
  for (const [recordKey, recordValue] of Object.entries(value)) {
    if (typeof recordValue !== 'string') {
      throw new ImportValidationError(`${path}.${key}.${recordKey} must be a string`);
    }
  }
  return { ...value } as Record<string, string>;
}

function requireUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new ImportValidationError(`${label} must be unique: ${value}`);
    seen.add(value);
  }
}

function validatePrompt(
  obj: Record<string, unknown>,
  path: string,
  folderIds: Set<string>,
  tagIds: Set<string>,
): PromptV1 {
  const id = requireString(obj, 'id', path);
  const folderId = requireString(obj, 'folderId', path);
  if (!folderIds.has(folderId)) {
    throw new ImportValidationError(`${path}.folderId does not reference a known folder`);
  }
  const tagIdsArr = requireArray(obj, 'tagIds', path);
  const promptTagIds = tagIdsArr.map((t, index) => {
    if (typeof t !== 'string' || !tagIds.has(t)) {
      throw new ImportValidationError(`${path}.tagIds[${index}] does not reference a known tag`);
    }
    return t;
  });
  requireUnique(promptTagIds, `${path}.tagIds`);
  return {
    id,
    title: requireString(obj, 'title', path),
    content: requireString(obj, 'content', path),
    description: optionalString(obj, 'description', path),
    folderId,
    tagIds: promptTagIds,
    isFavorite: requireBoolean(obj, 'isFavorite', path),
    copyCount: requireNonNegativeInteger(obj, 'copyCount', path),
    createdAt: requireIsoTimestamp(obj, 'createdAt', path),
    updatedAt: requireIsoTimestamp(obj, 'updatedAt', path),
    lastCopiedAt: obj.lastCopiedAt === null ? null : requireIsoTimestamp(obj, 'lastCopiedAt', path),
  };
}

function validateFolder(obj: Record<string, unknown>, path: string): Folder {
  const name = requireString(obj, 'name', path);
  const normalizedName = requireString(obj, 'normalizedName', path);
  if (normalizedName !== normalizeName(name)) {
    throw new ImportValidationError(`${path}.normalizedName must match the normalized name`);
  }
  return {
    id: requireString(obj, 'id', path),
    name,
    normalizedName,
    createdAt: requireIsoTimestamp(obj, 'createdAt', path),
    updatedAt: requireIsoTimestamp(obj, 'updatedAt', path),
  };
}

function validateTag(obj: Record<string, unknown>, path: string): Tag {
  const name = requireString(obj, 'name', path);
  const normalizedName = requireString(obj, 'normalizedName', path);
  if (normalizedName !== normalizeName(name)) {
    throw new ImportValidationError(`${path}.normalizedName must match the normalized name`);
  }
  return {
    id: requireString(obj, 'id', path),
    name,
    normalizedName,
    createdAt: requireIsoTimestamp(obj, 'createdAt', path),
    updatedAt: requireIsoTimestamp(obj, 'updatedAt', path),
  };
}

function validateSettings(obj: Record<string, unknown>, path: string): Settings {
  if (obj.schemaVersion !== 1) {
    throw new ImportValidationError(`${path}.schemaVersion must be 1`);
  }
  if (obj.theme !== 'system' && obj.theme !== 'light' && obj.theme !== 'dark') {
    throw new ImportValidationError(`${path}.theme must be system|light|dark`);
  }
  if (
    obj.defaultSort !== 'recently-updated' &&
    obj.defaultSort !== 'recently-created' &&
    obj.defaultSort !== 'alphabetical' &&
    obj.defaultSort !== 'most-copied'
  ) {
    throw new ImportValidationError(`${path}.defaultSort invalid`);
  }
  if (obj.viewMode !== 'card') {
    throw new ImportValidationError(`${path}.viewMode must be card`);
  }
  const rememberedVariableValues =
    obj.rememberedVariableValues === undefined
      ? undefined
      : requireStringRecord(obj, 'rememberedVariableValues', path);
  const lastBackupPreparedAt =
    obj.lastBackupPreparedAt === undefined
      ? undefined
      : requireIsoTimestamp(obj, 'lastBackupPreparedAt', path);
  return {
    schemaVersion: 1,
    theme: obj.theme,
    defaultSort: obj.defaultSort,
    viewMode: 'card',
    confirmBeforeDelete: requireBoolean(obj, 'confirmBeforeDelete', path),
    ...(rememberedVariableValues === undefined ? {} : { rememberedVariableValues }),
    ...(lastBackupPreparedAt === undefined ? {} : { lastBackupPreparedAt }),
  };
}

function validateV1Export(raw: Record<string, unknown>): V1ExportPayload {
  if ('formatVersion' in raw) {
    throw new ImportValidationError('v1 backups must use the legacy version field');
  }
  if (typeof raw.version !== 'number') throw new ImportValidationError('Missing version');
  if (raw.version !== EXPORT_VERSION) {
    throw new ImportValidationError(`Unsupported backup version: ${String(raw.version)}`);
  }
  if (typeof raw.exportedAt !== 'string') throw new ImportValidationError('Missing exportedAt');
  const exportedAt = requireIsoTimestamp(raw, 'exportedAt', 'root');

  const folderArr = requireArray(raw, 'folders', 'root');
  const tagArr = requireArray(raw, 'tags', 'root');
  const promptArr = requireArray(raw, 'prompts', 'root');

  const folders = folderArr.map((f, i) => {
    if (!isObject(f)) throw new ImportValidationError(`folders[${i}] must be an object`);
    return validateFolder(f, `folders[${i}]`);
  });
  requireUnique(folders.map((folder) => folder.id), 'Folder IDs');
  const folderIds = new Set(folders.map((f) => f.id));
  const systemFolder = folders.find((folder) => folder.id === SYSTEM_FOLDER_ID);
  if (
    !systemFolder ||
    systemFolder.name !== SYSTEM_FOLDER_NAME ||
    systemFolder.normalizedName !== SYSTEM_FOLDER_ID
  ) {
    throw new ImportValidationError(`Missing system folder "${SYSTEM_FOLDER_NAME}" (${SYSTEM_FOLDER_ID})`);
  }
  requireUnique(folders.map((folder) => folder.normalizedName), 'Folder normalized names');

  const tags = tagArr.map((t, i) => {
    if (!isObject(t)) throw new ImportValidationError(`tags[${i}] must be an object`);
    return validateTag(t, `tags[${i}]`);
  });
  requireUnique(tags.map((tag) => tag.id), 'Tag IDs');
  requireUnique(tags.map((tag) => tag.normalizedName), 'Tag normalized names');
  const tagIds = new Set(tags.map((t) => t.id));

  const prompts = promptArr.map((p, i) => {
    if (!isObject(p)) throw new ImportValidationError(`prompts[${i}] must be an object`);
    return validatePrompt(p, `prompts[${i}]`, folderIds, tagIds);
  });
  requireUnique(prompts.map((prompt) => prompt.id), 'Prompt IDs');

  if (!isObject(raw.settings)) throw new ImportValidationError('Missing settings');
  const settings = validateSettings(raw.settings, 'settings');

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt,
    prompts,
    folders,
    tags,
    settings,
  };
}

function validatePromptV2(
  obj: Record<string, unknown>,
  path: string,
  folderIds: Set<string>,
  tagIds: Set<string>,
): Prompt {
  const base = validatePrompt(obj, path, folderIds, tagIds);
  if (!isAssetType(obj.type)) {
    throw new ImportValidationError(`${path}.type must be a supported asset type`);
  }
  const targetTools = requireArray(obj, 'targetTools', path).map((value, index) => {
    if (!isTargetTool(value)) {
      throw new ImportValidationError(`${path}.targetTools[${index}] must be a supported target tool`);
    }
    return value;
  });
  requireUnique(targetTools, `${path}.targetTools`);
  return {
    ...base,
    type: obj.type,
    targetTools,
    notes: optionalString(obj, 'notes', path),
    variableDefaults: requireStringRecord(obj, 'variableDefaults', path),
  };
}

function validateVersionSnapshot(obj: Record<string, unknown>, path: string): PromptVersionSnapshot {
  if (!isAssetType(obj.type)) {
    throw new ImportValidationError(`${path}.type must be a supported asset type`);
  }
  const targetTools = requireArray(obj, 'targetTools', path).map((value, index) => {
    if (!isTargetTool(value)) {
      throw new ImportValidationError(`${path}.targetTools[${index}] must be a supported target tool`);
    }
    return value;
  });
  requireUnique(targetTools, `${path}.targetTools`);
  return {
    title: requireString(obj, 'title', path),
    content: requireString(obj, 'content', path),
    description: optionalString(obj, 'description', path),
    type: obj.type,
    targetTools,
    notes: optionalString(obj, 'notes', path),
    variableDefaults: requireStringRecord(obj, 'variableDefaults', path),
  };
}

function validatePromptVersion(
  obj: Record<string, unknown>,
  path: string,
  promptIds: Set<string>,
): PromptVersion {
  const promptId = requireString(obj, 'promptId', path);
  if (!promptIds.has(promptId)) {
    throw new ImportValidationError(`${path}.promptId does not reference a known prompt`);
  }
  const sequence = requireNonNegativeInteger(obj, 'sequence', path);
  if (sequence < 1) throw new ImportValidationError(`${path}.sequence must be positive`);
  const reason = obj.reason;
  if (reason !== 'edit' && reason !== 'restore') {
    throw new ImportValidationError(`${path}.reason must be edit|restore`);
  }
  if (!isObject(obj.snapshot)) throw new ImportValidationError(`${path}.snapshot must be an object`);
  return {
    id: requireString(obj, 'id', path),
    promptId,
    sequence,
    createdAt: requireIsoTimestamp(obj, 'createdAt', path),
    reason,
    snapshot: validateVersionSnapshot(obj.snapshot, `${path}.snapshot`),
  };
}

function validateBundle(
  obj: Record<string, unknown>,
  path: string,
  promptIds: Set<string>,
): Bundle {
  const memberIds = requireArray(obj, 'promptIds', path).map((value, index) => {
    if (typeof value !== 'string' || !value) {
      throw new ImportValidationError(`${path}.promptIds[${index}] must be a non-empty string`);
    }
    if (!promptIds.has(value)) {
      throw new ImportValidationError(`${path}.promptIds[${index}] does not reference a known prompt`);
    }
    return value;
  });
  requireUnique(memberIds, `${path}.promptIds`);
  return {
    id: requireString(obj, 'id', path),
    name: requireString(obj, 'name', path),
    description: optionalString(obj, 'description', path),
    promptIds: memberIds,
    createdAt: requireIsoTimestamp(obj, 'createdAt', path),
    updatedAt: requireIsoTimestamp(obj, 'updatedAt', path),
  };
}

function validateCounts(obj: Record<string, unknown>, path: string): V2ExportSummary['counts'] {
  return {
    prompts: requireNonNegativeInteger(obj, 'prompts', path),
    folders: requireNonNegativeInteger(obj, 'folders', path),
    tags: requireNonNegativeInteger(obj, 'tags', path),
    promptVersions: requireNonNegativeInteger(obj, 'promptVersions', path),
    bundles: requireNonNegativeInteger(obj, 'bundles', path),
  };
}

function validateV2Export(raw: unknown): V2ExportPayload {
  if (!isObject(raw)) throw new ImportValidationError('Root must be an object');
  if ('version' in raw) {
    throw new ImportValidationError('v2 backups must use the formatVersion field');
  }
  if (raw.formatVersion !== CANONICAL_EXPORT_VERSION) {
    throw new ImportValidationError(`Unsupported backup version: ${String(raw.formatVersion)}`);
  }
  const appVersion = requireString(raw, 'appVersion', 'root');
  const exportedAt = requireIsoTimestamp(raw, 'exportedAt', 'root');
  if (!isObject(raw.data)) throw new ImportValidationError('Missing data');

  const folderArr = requireArray(raw.data, 'folders', 'data');
  const tagArr = requireArray(raw.data, 'tags', 'data');
  const promptArr = requireArray(raw.data, 'prompts', 'data');
  const versionArr = requireArray(raw.data, 'promptVersions', 'data');
  const bundleArr = requireArray(raw.data, 'bundles', 'data');

  const folders = folderArr.map((value, index) => {
    if (!isObject(value)) throw new ImportValidationError(`data.folders[${index}] must be an object`);
    return validateFolder(value, `data.folders[${index}]`);
  });
  requireUnique(folders.map((folder) => folder.id), 'Folder IDs');
  requireUnique(folders.map((folder) => folder.normalizedName), 'Folder normalized names');
  const folderIds = new Set(folders.map((folder) => folder.id));
  const systemFolder = folders.find((folder) => folder.id === SYSTEM_FOLDER_ID);
  if (
    !systemFolder ||
    systemFolder.name !== SYSTEM_FOLDER_NAME ||
    systemFolder.normalizedName !== SYSTEM_FOLDER_ID
  ) {
    throw new ImportValidationError(`Missing system folder "${SYSTEM_FOLDER_NAME}" (${SYSTEM_FOLDER_ID})`);
  }

  const tags = tagArr.map((value, index) => {
    if (!isObject(value)) throw new ImportValidationError(`data.tags[${index}] must be an object`);
    return validateTag(value, `data.tags[${index}]`);
  });
  requireUnique(tags.map((tag) => tag.id), 'Tag IDs');
  requireUnique(tags.map((tag) => tag.normalizedName), 'Tag normalized names');
  const tagIds = new Set(tags.map((tag) => tag.id));

  const prompts = promptArr.map((value, index) => {
    if (!isObject(value)) throw new ImportValidationError(`data.prompts[${index}] must be an object`);
    return validatePromptV2(value, `data.prompts[${index}]`, folderIds, tagIds);
  });
  requireUnique(prompts.map((prompt) => prompt.id), 'Prompt IDs');
  const promptIds = new Set(prompts.map((prompt) => prompt.id));

  const promptVersions = versionArr.map((value, index) => {
    if (!isObject(value)) throw new ImportValidationError(`data.promptVersions[${index}] must be an object`);
    return validatePromptVersion(value, `data.promptVersions[${index}]`, promptIds);
  });
  requireUnique(promptVersions.map((version) => version.id), 'Prompt version IDs');
  const sequences = new Map<string, Set<number>>();
  for (const version of promptVersions) {
    const promptSequences = sequences.get(version.promptId) ?? new Set<number>();
    if (promptSequences.has(version.sequence)) {
      throw new ImportValidationError(`Prompt version sequences must be unique: ${version.promptId}/${version.sequence}`);
    }
    promptSequences.add(version.sequence);
    sequences.set(version.promptId, promptSequences);
  }

  const bundles = bundleArr.map((value, index) => {
    if (!isObject(value)) throw new ImportValidationError(`data.bundles[${index}] must be an object`);
    return validateBundle(value, `data.bundles[${index}]`, promptIds);
  });
  requireUnique(bundles.map((bundle) => bundle.id), 'Bundle IDs');

  if (!isObject(raw.data.settings)) throw new ImportValidationError('Missing data.settings');
  const settings = validateSettings(raw.data.settings, 'data.settings');
  if (!isObject(raw.summary)) throw new ImportValidationError('Missing summary');
  if (!isObject(raw.summary.counts)) throw new ImportValidationError('Missing summary.counts');
  const counts = validateCounts(raw.summary.counts, 'summary.counts');
  const actualCounts = {
    prompts: prompts.length,
    folders: folders.length,
    tags: tags.length,
    promptVersions: promptVersions.length,
    bundles: bundles.length,
  };
  if (JSON.stringify(counts) !== JSON.stringify(actualCounts)) {
    throw new ImportValidationError('summary.counts must match the exported data');
  }
  const checksum = requireString(raw, 'checksum', 'root');
  if (!/^[0-9a-f]{64}$/.test(checksum)) {
    throw new ImportValidationError('root.checksum must be a lowercase SHA-256 digest');
  }

  return {
    format: EXPORT_FORMAT,
    formatVersion: CANONICAL_EXPORT_VERSION,
    appVersion,
    exportedAt,
    data: { prompts, folders, tags, settings, promptVersions, bundles },
    summary: { counts },
    checksum,
  };
}

export function validateExport(raw: unknown): ExportPayload {
  if (!isObject(raw)) throw new ImportValidationError('Root must be an object');
  if (raw.format !== EXPORT_FORMAT)
    throw new ImportValidationError(`Invalid format: expected "${EXPORT_FORMAT}"`);
  if ('version' in raw) return validateV1Export(raw);
  return validateV2Export(raw);
}

function compareIds(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function checksumForData(data: V2ExportData): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableSerialize(data)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hasValidChecksum(payload: V2ExportPayload): Promise<boolean> {
  return payload.checksum === (await checksumForData(payload.data));
}

function restoreSummary(payload: ExportPayload): RestoreSummary {
  if (isV2ExportPayload(payload)) return { ...payload.summary.counts };
  return {
    prompts: payload.prompts.length,
    folders: payload.folders.length,
    tags: payload.tags.length,
    promptVersions: 0,
    bundles: 0,
  };
}

function expectedRestoreData(payload: ExportPayload): V2ExportData {
  if (isV2ExportPayload(payload)) return payload.data;
  return {
    prompts: payload.prompts.map(withPromptDefaults),
    folders: payload.folders,
    tags: payload.tags,
    settings: payload.settings,
    promptVersions: [],
    bundles: [],
  };
}

function canonicalData(data: V2ExportData): V2ExportData {
  return {
    prompts: data.prompts.map(withPromptDefaults).sort(compareIds),
    folders: data.folders.slice().sort(compareIds),
    tags: data.tags.slice().sort(compareIds),
    settings: data.settings,
    promptVersions: data.promptVersions.slice().sort(compareIds),
    bundles: data.bundles.slice().sort(compareIds),
  };
}

async function validateAndVerifyPayload(raw: unknown): Promise<ExportPayload> {
  const payload = validateExport(raw);
  if (isV2ExportPayload(payload) && !(await hasValidChecksum(payload))) {
    throw new ImportValidationError('Backup checksum does not match its data');
  }
  return payload;
}

export async function verifyExportChecksum(payload: V2ExportPayload): Promise<boolean> {
  const validated = validateExport(payload);
  if (!isV2ExportPayload(validated)) throw new ImportValidationError('Expected a v2 backup payload');
  return hasValidChecksum(validated);
}

export function isV2ExportPayload(payload: ExportPayload): payload is V2ExportPayload {
  return 'formatVersion' in payload;
}

export async function prepareRestore(raw: unknown): Promise<PreparedRestore> {
  const payload = await validateAndVerifyPayload(raw);
  const preRestoreBackup = await exportLibrary();
  if (!(await hasValidChecksum(preRestoreBackup))) {
    throw new RestoreVerificationError('Could not verify the pre-restore backup');
  }
  return {
    payload,
    preRestoreBackup,
    summary: restoreSummary(payload),
  };
}

export async function exportLibrary(): Promise<V2ExportPayload> {
  const db = await getDb();
  const [storedPrompts, folders, tags, promptVersions, bundles, storedSettings] = await Promise.all([
    db.getAll('prompts'),
    db.getAll('folders'),
    db.getAll('tags'),
    db.getAll('promptVersions'),
    db.getAll('bundles'),
    db.get('settings', SETTINGS_KEY),
  ]);
  const settings = isSettings(storedSettings) ? storedSettings : DEFAULT_SETTINGS;
  const data: V2ExportData = {
    prompts: storedPrompts.map(withPromptDefaults).sort(compareIds),
    folders: folders.slice().sort(compareIds),
    tags: tags.slice().sort(compareIds),
    settings,
    promptVersions: promptVersions.slice().sort(compareIds),
    bundles: bundles.slice().sort(compareIds),
  };
  const payload: V2ExportPayload = {
    format: EXPORT_FORMAT,
    formatVersion: CANONICAL_EXPORT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    summary: {
      counts: {
        prompts: data.prompts.length,
        folders: data.folders.length,
        tags: data.tags.length,
        promptVersions: data.promptVersions.length,
        bundles: data.bundles.length,
      },
    },
    checksum: '',
  };
  payload.checksum = await checksumForData(data);
  return validateV2Export(payload);
}

export function exportFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `prompt-library-backup-${yyyy}-${mm}-${dd}.json`;
}

export function serializeExport(payload: ExportPayload): string {
  const validated = validateExport(payload);
  return JSON.stringify(validated, null, 2);
}

export async function importLibrary(payload: ExportPayload): Promise<void> {
  const validation = await validateAndVerifyPayload(payload);
  const db = await getDb();
  const tx = db.transaction(['prompts', 'folders', 'tags', 'settings', 'promptVersions', 'bundles'], 'readwrite');
  const transactionDone = tx.done;
  void transactionDone.catch(() => undefined);
  try {
    await tx.objectStore('prompts').clear();
    await tx.objectStore('folders').clear();
    await tx.objectStore('tags').clear();
    await tx.objectStore('promptVersions').clear();
    await tx.objectStore('bundles').clear();

    const data = isV2ExportPayload(validation)
      ? validation.data
      : {
          prompts: validation.prompts,
          folders: validation.folders,
          tags: validation.tags,
          settings: validation.settings,
          promptVersions: [],
          bundles: [],
        };
    for (const p of data.prompts) await tx.objectStore('prompts').put(p);
    for (const f of data.folders) await tx.objectStore('folders').put(f);
    for (const t of data.tags) await tx.objectStore('tags').put(t);
    for (const version of data.promptVersions) await tx.objectStore('promptVersions').put(version);
    for (const bundle of data.bundles) await tx.objectStore('bundles').put(bundle);
    await tx.objectStore('settings').put(data.settings, SETTINGS_KEY);

    await transactionDone;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // IndexedDB already aborts the transaction when a request fails.
    }
    try {
      await transactionDone;
    } catch {
      // Consume the transaction rejection before returning the original write error.
    }
    throw error;
  }
}

export async function restoreLibrary(
  prepared: PreparedRestore,
  acknowledgement: RestoreAcknowledgement,
): Promise<void> {
  if (acknowledgement?.preRestoreBackupAcknowledged !== true) {
    throw new RestoreVerificationError('Explicit pre-restore backup acknowledgement is required');
  }

  const payload = await validateAndVerifyPayload(prepared.payload);
  const preRestoreBackup = validateExport(prepared.preRestoreBackup);
  if (!isV2ExportPayload(preRestoreBackup) || !(await hasValidChecksum(preRestoreBackup))) {
    throw new RestoreVerificationError('The pre-restore backup is not verifiable');
  }

  await importLibrary(payload);

  const restored = await exportLibrary();
  if (
    stableSerialize(canonicalData(restored.data)) !==
    stableSerialize(canonicalData(expectedRestoreData(payload)))
  ) {
    throw new RestoreVerificationError(
      'The restored library did not match the verified backup. Stop using the library and recover from the pre-restore backup.',
    );
  }
}

export function downloadJson(payload: ExportPayload, filename: string): void {
  const blob = new Blob([serializeExport(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const __test__ = { SYSTEM_FOLDER_ID, SYSTEM_FOLDER_NAME, DB_VERSION };
