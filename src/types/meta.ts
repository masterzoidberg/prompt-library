export type MigrationJournalStatus = 'in-progress' | 'failed' | 'complete';

export interface MigrationVerification {
  promptCount: number;
  folderCount: number;
  tagCount: number;
  contentHash: string;
}

export interface MigrationJournal {
  kind: 'migration-journal';
  fromVersion: number;
  toVersion: number;
  status: MigrationJournalStatus;
  updatedAt: string;
  verification: MigrationVerification;
  error?: string;
}
