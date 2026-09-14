import { describe, it, expect } from 'vitest';
import { sortPrompts } from './sort';
import type { Prompt } from '../types/prompt';

const p = (overrides: Partial<Prompt>): Prompt => ({
  id: '',
  title: '',
  content: '',
  folderId: 'unfiled',
  tagIds: [],
  isFavorite: false,
  copyCount: 0,
  createdAt: '',
  updatedAt: '',
  lastCopiedAt: null,
  ...overrides,
});

describe('sortPrompts', () => {
  const prompts: Prompt[] = [
    p({ id: 'a', title: 'Charlie', updatedAt: '2025-01-03T00:00:00.000Z', createdAt: '2025-01-01T00:00:00.000Z', copyCount: 1 }),
    p({ id: 'b', title: 'Alpha', updatedAt: '2025-01-01T00:00:00.000Z', createdAt: '2025-01-03T00:00:00.000Z', copyCount: 5 }),
    p({ id: 'c', title: 'Bravo', updatedAt: '2025-01-02T00:00:00.000Z', createdAt: '2025-01-02T00:00:00.000Z', copyCount: 3 }),
  ];

  it('sorts by recently-updated desc', () => {
    expect(sortPrompts(prompts, 'recently-updated').map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by recently-created desc', () => {
    expect(sortPrompts(prompts, 'recently-created').map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts alphabetically', () => {
    expect(sortPrompts(prompts, 'alphabetical').map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by most-copied desc', () => {
    expect(sortPrompts(prompts, 'most-copied').map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate input', () => {
    const copy = [...prompts];
    sortPrompts(prompts, 'alphabetical');
    expect(prompts).toEqual(copy);
  });
});