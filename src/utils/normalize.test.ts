import { describe, it, expect } from 'vitest';
import { normalizeName } from './normalize';

describe('normalizeName', () => {
  it('lowercases', () => {
    expect(normalizeName('FooBar')).toBe('foobar');
  });

  it('trims whitespace', () => {
    expect(normalizeName('  hello  ')).toBe('hello');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeName('a   b\tc\n d')).toBe('a b c d');
  });
});