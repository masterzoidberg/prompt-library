import { describe, it, expect } from 'vitest';
import { createSearchIndex, searchPrompts } from './search';
import type { Bundle, Prompt, Folder, Tag } from '../types';
import { buildLibraryFixture } from '../test/builders/libraryBuilder';

const p = (overrides: Partial<Prompt>): Prompt => ({
  id: Math.random().toString(),
  title: 't',
  content: 'c',
  folderId: 'unfiled',
  tagIds: [],
  isFavorite: false,
  copyCount: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  lastCopiedAt: null,
  ...overrides,
});

const folders = new Map<string, Folder>([
  ['unfiled', { id: 'unfiled', name: 'Unfiled', normalizedName: 'unfiled', createdAt: '', updatedAt: '' }],
  ['f1', { id: 'f1', name: 'Writing', normalizedName: 'writing', createdAt: '', updatedAt: '' }],
]);

const tags = new Map<string, Tag>([
  ['t1', { id: 't1', name: 'code', normalizedName: 'code', createdAt: '', updatedAt: '' }],
  ['t2', { id: 't2', name: 'LaunchTag', normalizedName: 'launchtag', createdAt: '', updatedAt: '' }],
]);

const bundles: Bundle[] = [
  {
    id: 'b1',
    name: 'Launch workflow',
    promptIds: ['bundle-match'],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

describe('searchPrompts', () => {
  const prompts: Prompt[] = [
    p({ id: '1', title: 'Hello', content: 'world' }),
    p({ id: '2', title: 'Foo', content: 'Hello there', folderId: 'f1' }),
    p({ id: '3', title: 'Bar', content: 'baz', tagIds: ['t1'] }),
  ];

  it('returns all when query is empty', () => {
    expect(searchPrompts(prompts, '', folders, tags)).toHaveLength(3);
  });

  it('matches title case-insensitively', () => {
    expect(searchPrompts(prompts, 'HELLO', folders, tags).map((p) => p.id)).toEqual(['1', '2']);
  });

  it('matches content', () => {
    expect(searchPrompts(prompts, 'baz', folders, tags).map((p) => p.id)).toEqual(['3']);
  });

  it('matches folder name', () => {
    expect(searchPrompts(prompts, 'writing', folders, tags).map((p) => p.id)).toEqual(['2']);
  });

  it('matches tag name', () => {
    expect(searchPrompts(prompts, 'code', folders, tags).map((p) => p.id)).toEqual(['3']);
  });

  it('ranks exact and prefix titles ahead of title tokens, metadata, and content', () => {
    const rankedPrompts = [
      p({ id: 'content-match', title: 'Unrelated', content: 'launch appears in content' }),
      p({ id: 'metadata-match', title: 'Unrelated', folderId: 'f2' }),
      p({ id: 'title-token-match', title: 'A Launch brief' }),
      p({ id: 'prefix-match', title: 'Launch plan' }),
      p({ id: 'exact-match', title: 'Launch' }),
    ];
    const rankedFolders = new Map(folders).set('f2', {
      id: 'f2',
      name: 'Launch folder',
      normalizedName: 'launch folder',
      createdAt: '',
      updatedAt: '',
    });

    const results = createSearchIndex(rankedPrompts, rankedFolders, tags, []).search('launch');

    expect(results.map((result) => result.prompt.id)).toEqual([
      'exact-match',
      'prefix-match',
      'title-token-match',
      'metadata-match',
      'content-match',
    ]);
    expect(results.map((result) => result.score)).toEqual([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results[1].score).toBeGreaterThan(results[2].score);
    expect(results[2].score).toBeGreaterThan(results[3].score);
    expect(results[3].score).toBeGreaterThan(results[4].score);
  });

  it('indexes tags, type, target tools, description, notes, folders, bundles, and content', () => {
    const indexedPrompts = [
      p({ id: 'tag-match', title: 'Tag result', tagIds: ['t2'] }),
      p({ id: 'type-match', title: 'Type result', type: 'template' }),
      p({ id: 'target-match', title: 'Target result', targetTools: ['codex'] }),
      p({ id: 'description-match', title: 'Description result', description: 'description-needle' }),
      p({ id: 'notes-match', title: 'Notes result', notes: 'notes-needle' }),
      p({ id: 'folder-match', title: 'Folder result', folderId: 'f1' }),
      p({ id: 'bundle-match', title: 'Bundle result' }),
      p({ id: 'content-match', title: 'Content result', content: 'content-needle' }),
    ];

    const index = createSearchIndex(indexedPrompts, folders, tags, bundles);

    expect(index.search('launchtag').map((result) => result.prompt.id)).toEqual(['tag-match']);
    expect(index.search('template').map((result) => result.prompt.id)).toEqual(['type-match']);
    expect(index.search('codex').map((result) => result.prompt.id)).toEqual(['target-match']);
    expect(index.search('description-needle').map((result) => result.prompt.id)).toEqual(['description-match']);
    expect(index.search('notes-needle').map((result) => result.prompt.id)).toEqual(['notes-match']);
    expect(index.search('writing').map((result) => result.prompt.id)).toEqual(['folder-match']);
    expect(index.search('workflow').map((result) => result.prompt.id)).toEqual(['bundle-match']);
    expect(index.search('content-needle').map((result) => result.prompt.id)).toEqual(['content-match']);
  });

  it('returns accurate, safe ranges for repeated and Unicode matches', () => {
    const result = createSearchIndex(
      [p({ id: 'ranges', title: 'Needle needle', content: '東京 🚀 needle' })],
      folders,
      tags,
      [],
    ).search('needle')[0];

    expect(result.matches.filter((match) => match.field === 'title')).toEqual([
      { field: 'title', value: 'Needle needle', start: 0, end: 6 },
      { field: 'title', value: 'Needle needle', start: 7, end: 13 },
    ]);

    const unicodeResult = createSearchIndex(
      [p({ id: 'unicode', title: 'Unicode', content: '東京 🚀 needle' })],
      folders,
      tags,
      [],
    ).search('東京')[0];
    expect(unicodeResult.matches).toContainEqual({
      field: 'content',
      value: '東京 🚀 needle',
      start: 0,
      end: 2,
    });
  });

  it('uses updated time, title, and ID as stable tie-breakers', () => {
    const results = createSearchIndex(
      [
        p({ id: 'b', title: 'Same keyword', updatedAt: '2025-01-01T00:00:00.000Z' }),
        p({ id: 'a', title: 'Same keyword', updatedAt: '2026-01-01T00:00:00.000Z' }),
        p({ id: 'c', title: 'Another keyword', updatedAt: '2026-01-01T00:00:00.000Z' }),
      ],
      folders,
      tags,
      [],
    ).search('keyword');

    expect(results.map((result) => result.prompt.id)).toEqual(['c', 'a', 'b']);
  });

  it('searches the 5,000-asset fixture below the response target', () => {
    const fixture = buildLibraryFixture(5000);
    const index = createSearchIndex(
      fixture.prompts,
      new Map(fixture.folders.map((folder) => [folder.id, folder])),
      new Map(fixture.tags.map((tag) => [tag.id, tag])),
      [],
    );
    const durations: number[] = [];

    for (let i = 0; i < 3; i += 1) {
      index.search(i % 2 === 0 ? 'research' : '東京');
    }
    for (let i = 0; i < 25; i += 1) {
      const startedAt = performance.now();
      index.search(i % 2 === 0 ? 'research' : '東京');
      durations.push(performance.now() - startedAt);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    expect(p95).toBeLessThan(100);
  });
});
