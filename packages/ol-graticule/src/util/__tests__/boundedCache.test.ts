import { describe, it, expect } from 'vitest';
import { BoundedCache } from '../boundedCache.js';

describe('BoundedCache', () => {
  it('returns stored values', () => {
    const c = new BoundedCache<string, number>();
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const c = new BoundedCache<string, number>();
    expect(c.get('missing')).toBeUndefined();
  });

  it('uses default capacity of 512', () => {
    const c = new BoundedCache<number, number>();
    for (let i = 0; i < 512; i++) c.set(i, i);
    expect(c.get(0)).toBe(0);
    expect(c.get(511)).toBe(511);
    c.set(512, 512);
    expect(c.get(0)).toBeUndefined();
    expect(c.get(512)).toBe(512);
  });

  it('bulk-clears on overflow with custom max', () => {
    const c = new BoundedCache<string, number>(3);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.set('d', 4);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBeUndefined();
    expect(c.get('c')).toBeUndefined();
    expect(c.get('d')).toBe(4);
  });

  it('updating an existing key at capacity does not wipe the cache', () => {
    const c = new BoundedCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 11);
    expect(c.get('a')).toBe(11);
    expect(c.get('b')).toBe(2);
  });
});
