import { describe, it, expect, vi } from 'vitest';
import { newId } from './id';

describe('newId', () => {
  it('returns a UUID-shaped string', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('returns unique values across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));
    expect(ids.size).toBe(100);
  });

  it('uses crypto.randomUUID when available', () => {
    const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid' as unknown as `${string}-${string}-${string}-${string}-${string}`);
    expect(newId()).toBe('test-uuid');
    spy.mockRestore();
  });
});