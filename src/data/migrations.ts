import type {
  Folder,
  MigrationJournal,
  MigrationVerification,
  Prompt,
  PromptV1,
  Settings,
  Tag,
} from '../types';
import { DB_VERSION, MIGRATION_JOURNAL_KEY, SETTINGS_KEY } from '../config/constants';
import { validateExport, EXPORT_FORMAT, EXPORT_VERSION } from './importExport';
import { getDb, type PromptDB } from './db';
import { nowIso } from '../utils/date';
import { toPromptV1, withPromptDefaults } from '../types/prompt';

const LEGACY_DATA_VERSION = 1;
const CURRENT_DATA_VERSION = 2;

export type MigrationFailurePoint = 'after-journal' | 'after-transform' | 'before-verify' | 'before-complete';

export interface MigrationOptions {
  failAt?: MigrationFailurePoint;
}

interface V1Snapshot {
  storedPrompts: Array<Prompt | PromptV1>;
  prompts: PromptV1[];
  folders: Folder[];
  tags: Tag[];
  settings: Settings;
  verification: MigrationVerification;
}

interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  run: (db: PromptDB, before: V1Snapshot, options: MigrationOptions) => Promise<MigrationVerification>;
}

function isMigrationJournal(value: unknown): value is MigrationJournal {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MigrationJournal>;
  return (
    candidate.kind === 'migration-journal' &&
    typeof candidate.fromVersion === 'number' &&
    typeof candidate.toVersion === 'number' &&
    (candidate.status === 'in-progress' || candidate.status === 'failed' || candidate.status === 'complete') &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.verification === 'object' &&
    candidate.verification !== null
  );
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function contentHash(snapshot: Omit<V1Snapshot, 'verification' | 'storedPrompts'>): Promise<string> {
  const canonical = stableSerialize({
    prompts: [...snapshot.prompts].sort((left, right) => left.id.localeCompare(right.id)),
    folders: [...snapshot.folders].sort((left, right) => left.id.localeCompare(right.id)),
    tags: [...snapshot.tags].sort((left, right) => left.id.localeCompare(right.id)),
    settings: snapshot.settings,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createVerification(
  prompts: PromptV1[],
  folders: Folder[],
  tags: Tag[],
  settings: Settings,
): Promise<MigrationVerification> {
  return {
    promptCount: prompts.length,
    folderCount: folders.length,
    tagCount: tags.length,
    contentHash: await contentHash({ prompts, folders, tags, settings }),
  };
}

function sameVerification(left: MigrationVerification, right: MigrationVerification): boolean {
  return (
    left.promptCount === right.promptCount &&
    left.folderCount === right.folderCount &&
    left.tagCount === right.tagCount &&
    left.contentHash === right.contentHash
  );
}

async function readV1Snapshot(db: PromptDB): Promise<V1Snapshot> {
  const [storedPrompts, folders, tags, storedSettings] = await Promise.all([
    db.getAll('prompts'),
    db.getAll('folders'),
    db.getAll('tags'),
    db.get('settings', SETTINGS_KEY),
  ]);

  if (!storedSettings || 'kind' in storedSettings) {
    throw new Error('Migration requires valid application settings');
  }

  const prompts = storedPrompts.map(toPromptV1);
  const settings = storedSettings as Settings;
  validateExport({
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: '1970-01-01T00:00:00.000Z',
    prompts,
    folders,
    tags,
    settings,
  });

  const verification = await createVerification(prompts, folders, tags, settings);
  return { storedPrompts, prompts, folders, tags, settings, verification };
}

function abortTransaction(tx: ReturnType<PromptDB['transaction']>): Promise<void> {
  try {
    tx.abort();
  } catch {
    // The transaction may already have completed after a failed read.
  }
  return tx.done.catch(() => undefined);
}

function injectedFailure(failAt: MigrationFailurePoint | undefined, point: MigrationFailurePoint): void {
  if (failAt === point) throw new Error('Injected migration failure');
}

const V1_TO_V2_MIGRATION_STEP: MigrationStep = {
  fromVersion: LEGACY_DATA_VERSION,
  toVersion: CURRENT_DATA_VERSION,
  async run(db, before, options) {
    const tx = db.transaction(['prompts', 'folders', 'tags'], 'readwrite');
    const pendingWrites: Promise<unknown>[] = [];
    try {
      const currentPrompts = await tx.objectStore('prompts').getAll();
      const migratedPrompts = currentPrompts.map(withPromptDefaults);
      const promptStore = tx.objectStore('prompts');
      pendingWrites.push(...migratedPrompts.map((prompt) => promptStore.put(prompt)));
      injectedFailure(options.failAt, 'after-transform');

      const expectedPrompts = before.storedPrompts.map(withPromptDefaults).sort((left, right) => left.id.localeCompare(right.id));
      const actualPrompts = migratedPrompts.slice().sort((left, right) => left.id.localeCompare(right.id));
      if (
        stableSerialize(expectedPrompts) !== stableSerialize(actualPrompts) ||
        stableSerialize(before.prompts.slice().sort((left, right) => left.id.localeCompare(right.id))) !==
          stableSerialize(migratedPrompts.map(toPromptV1).sort((left, right) => left.id.localeCompare(right.id)))
      ) {
        throw new Error('Migration verification failed: prompt defaults or fields changed');
      }

      injectedFailure(options.failAt, 'before-verify');
      injectedFailure(options.failAt, 'before-complete');
      await tx.done;
      await Promise.all(pendingWrites);
      return createVerification(migratedPrompts.map(toPromptV1), before.folders, before.tags, before.settings);
    } catch (cause) {
      // Observe every request rejection after an injected abort so it cannot
      // escape as an unhandled promise while the transaction is rolled back.
      await Promise.allSettled(pendingWrites);
      await abortTransaction(tx);
      throw cause;
    }
  },
};

const MIGRATION_STEPS: readonly MigrationStep[] = [V1_TO_V2_MIGRATION_STEP];

async function writeJournal(db: PromptDB, journal: MigrationJournal): Promise<void> {
  await db.put('settings', journal, MIGRATION_JOURNAL_KEY);
}

export async function getMigrationJournal(): Promise<MigrationJournal | undefined> {
  const db = await getDb();
  const journal = await db.get('settings', MIGRATION_JOURNAL_KEY);
  return isMigrationJournal(journal) ? journal : undefined;
}

export async function runMigrations(options: MigrationOptions = {}): Promise<void> {
  const db = await getDb();
  const existingJournal = await getMigrationJournal();

  if (existingJournal?.status === 'complete' && existingJournal.toVersion === CURRENT_DATA_VERSION) return;

  const fromVersion =
    existingJournal?.status === 'complete'
      ? existingJournal.toVersion
      : existingJournal?.fromVersion ?? LEGACY_DATA_VERSION;
  const step = MIGRATION_STEPS.find((candidate) => candidate.fromVersion === fromVersion);
  if (!step) throw new Error(`No migration path from data version ${fromVersion}`);

  const before = await readV1Snapshot(db);
  const inProgress: MigrationJournal = {
    kind: 'migration-journal',
    fromVersion: step.fromVersion,
    toVersion: step.toVersion,
    status: 'in-progress',
    updatedAt: nowIso(),
    verification: before.verification,
  };

  try {
    await writeJournal(db, inProgress);
    injectedFailure(options.failAt, 'after-journal');

    const expectedVerification = await step.run(db, before, options);
    const after = await readV1Snapshot(db);
    if (!sameVerification(expectedVerification, after.verification)) {
      throw new Error('Migration verification failed after commit: record counts or content hash changed');
    }
    await writeJournal(db, {
      ...inProgress,
      status: 'complete',
      updatedAt: nowIso(),
      verification: after.verification,
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error('Migration failed');
    await writeJournal(db, {
      ...inProgress,
      status: 'failed',
      updatedAt: nowIso(),
      error: error.message,
    });
    throw error;
  }
}

export const __test__ = { CURRENT_DATA_VERSION, LEGACY_DATA_VERSION, DB_VERSION };
