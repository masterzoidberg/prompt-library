import { describe, expect, it } from 'vitest';
import { validateExport } from '../../data/importExport';
import { buildLibraryFixture, SCALE_FIXTURE_SIZES } from './libraryBuilder';

describe('library fixture builder', () => {
  it.each(SCALE_FIXTURE_SIZES)('builds and validates a deterministic %s-prompt library', (size) => {
    const fixture = buildLibraryFixture(size);

    expect(fixture.prompts).toHaveLength(size);
    expect(validateExport(fixture)).toEqual(fixture);
    expect(fixture.folders.map((folder) => folder.id)).toContain('unfiled');
    expect(new Set(fixture.prompts.map((prompt) => prompt.title)).size).toBeLessThan(size);
    expect(fixture.prompts.some((prompt) => prompt.content.includes('#'))).toBe(true);
    expect(fixture.prompts.some((prompt) => /東京|🚀|café/.test(prompt.content))).toBe(true);
    expect(fixture.prompts.some((prompt) => prompt.tagIds.length >= 8)).toBe(true);
    expect(fixture.prompts.some((prompt) => prompt.isFavorite)).toBe(true);
    expect(fixture.prompts.some((prompt) => prompt.copyCount > 0 && prompt.lastCopiedAt)).toBe(true);
  });

  it('reproduces the same IDs, timestamps, relationships, and content', () => {
    expect(buildLibraryFixture(100)).toEqual(buildLibraryFixture(100));
  });
});
