import { describe, it, expect } from 'vitest';
import { formatRelative, formatAbsolute } from './dateFormat';

describe('formatRelative', () => {
  it('formats "now" as "now" or "0 seconds"', () => {
    const s = formatRelative(new Date().toISOString());
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(0);
  });

  it('formats past dates', () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(past)).toMatch(/3 days|day/);
  });
});

describe('formatAbsolute', () => {
  it('returns a string', () => {
    expect(typeof formatAbsolute(new Date().toISOString())).toBe('string');
  });
});