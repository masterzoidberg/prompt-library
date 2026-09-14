import { describe, expect, it } from 'vitest';
import { diffLines } from './diffService';

describe('diffLines', () => {
  it('returns unchanged lines when both values are equal', () => {
    expect(diffLines('one\ntwo', 'one\ntwo')).toEqual([
      { kind: 'same', text: 'one', oldLine: 1, newLine: 1 },
      { kind: 'same', text: 'two', oldLine: 2, newLine: 2 },
    ]);
  });

  it('reports replacements as removed and added lines', () => {
    expect(diffLines('before\nkeep', 'after\nkeep')).toEqual([
      { kind: 'removed', text: 'before', oldLine: 1 },
      { kind: 'added', text: 'after', newLine: 1 },
      { kind: 'same', text: 'keep', oldLine: 2, newLine: 2 },
    ]);
  });

  it('preserves multiline Unicode and trailing newline content', () => {
    expect(diffLines('café\n東京\n', 'café\n東京\n🚀')).toEqual([
      { kind: 'same', text: 'café', oldLine: 1, newLine: 1 },
      { kind: 'same', text: '東京', oldLine: 2, newLine: 2 },
      { kind: 'removed', text: '', oldLine: 3 },
      { kind: 'added', text: '🚀', newLine: 3 },
    ]);
  });
});
