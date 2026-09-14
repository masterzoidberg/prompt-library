import type { Folder, Prompt, Tag } from '../../types';
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  type ExportPayload,
  validateExport,
} from '../../data/importExport';
import { SYSTEM_FOLDER_ID, SYSTEM_FOLDER_NAME } from '../../config/constants';
import { DEFAULT_SETTINGS } from '../../types/settings';

export const SCALE_FIXTURE_SIZES = [100, 1000, 5000] as const;

const FIXTURE_EXPORTED_AT = '2026-01-15T12:00:00.000Z';
const FIXTURE_START = Date.UTC(2025, 0, 1, 8, 0, 0);

function fixtureTimestamp(offsetSeconds: number): string {
  return new Date(FIXTURE_START + offsetSeconds * 1000).toISOString();
}

function buildFolders(): Folder[] {
  return [
    {
      id: SYSTEM_FOLDER_ID,
      name: SYSTEM_FOLDER_NAME,
      normalizedName: SYSTEM_FOLDER_ID,
      createdAt: fixtureTimestamp(0),
      updatedAt: fixtureTimestamp(0),
    },
    {
      id: 'folder-research',
      name: 'Research & Notes',
      normalizedName: 'research & notes',
      createdAt: fixtureTimestamp(1),
      updatedAt: fixtureTimestamp(1),
    },
    {
      id: 'folder-writing',
      name: 'Writing',
      normalizedName: 'writing',
      createdAt: fixtureTimestamp(2),
      updatedAt: fixtureTimestamp(2),
    },
    {
      id: 'folder-operations',
      name: 'Operations',
      normalizedName: 'operations',
      createdAt: fixtureTimestamp(3),
      updatedAt: fixtureTimestamp(3),
    },
  ];
}

function buildTags(): Tag[] {
  const names = ['AI', 'Code', 'Markdown', 'Research', 'Writing', 'Unicode', 'Planning', 'Review'];
  return names.map((name, index) => ({
    id: `tag-${String(index + 1).padStart(2, '0')}`,
    name,
    normalizedName: name.toLowerCase(),
    createdAt: fixtureTimestamp(10 + index),
    updatedAt: fixtureTimestamp(10 + index),
  }));
}

function buildPrompt(index: number, tags: Tag[]): Prompt {
  const copyCount = index % 23;
  const createdAt = fixtureTimestamp(100 + index);
  const updatedAt = fixtureTimestamp(10_000 + index);
  const longMarkdown = index % 10 === 0;
  const unicode = index % 7 === 0;
  const title = index % 9 === 0 ? 'Shared research prompt' : `Fixture prompt ${String(index + 1).padStart(5, '0')}`;
  const content = longMarkdown
    ? [
        `# Research prompt ${index + 1}`,
        '',
        '## Context',
        '',
        'Summarize the supplied material while preserving evidence, uncertainty, and citations.',
        '',
        '- Separate observations from interpretation.',
        '- Keep Markdown structure intact.',
        '- Never invent missing details.',
        '',
        '```markdown',
        'A fenced example remains literal fixture content.',
        '```',
        unicode ? 'Unicode: café, naïve, 東京, 🚀, —, and →.' : 'ASCII content is intentional here.',
      ].join('\n')
    : `Use this short fixture prompt for deterministic item ${index + 1}.${unicode ? ' café 東京 🚀' : ''}`;
  const promptTags =
    index % tags.length === 0 ? tags.map((tag) => tag.id) : tags.slice(0, (index % tags.length) + 1).map((tag) => tag.id);

  return {
    id: `prompt-${String(index + 1).padStart(5, '0')}`,
    title,
    content,
    description: index % 3 === 0 ? `Deterministic description for fixture item ${index + 1}.` : undefined,
    folderId: [SYSTEM_FOLDER_ID, 'folder-research', 'folder-writing', 'folder-operations'][index % 4],
    tagIds: promptTags,
    isFavorite: index % 11 === 0,
    copyCount,
    createdAt,
    updatedAt,
    lastCopiedAt: copyCount > 0 ? fixtureTimestamp(20_000 + index) : null,
  };
}

export function buildLibraryFixture(promptCount: number): ExportPayload {
  if (!Number.isInteger(promptCount) || promptCount < 1) {
    throw new Error('promptCount must be a positive integer');
  }

  const folders = buildFolders();
  const tags = buildTags();
  const prompts = Array.from({ length: promptCount }, (_, index) => buildPrompt(index, tags));
  const payload: ExportPayload = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: FIXTURE_EXPORTED_AT,
    prompts,
    folders,
    tags,
    settings: { ...DEFAULT_SETTINGS, defaultSort: 'most-copied' },
  };

  // Keep this builder on the same contract boundary as committed backups so future
  // fixture extensions cannot silently drift from the supported v1 reader.
  return validateExport(payload);
}
