import { describe, it, expect } from 'vitest';
import { LruCache } from '../lruCache.js';

describe('LruCache', () => {
  it('returns stored values', () => {
    const c = new LruCache<string, number>(3);
    c.set('a', 1);
    c.set('b', 2);
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBe(2);
    expect(c.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry on overflow', () => {
    const c = new LruCache<string, number>(3);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    // Touch 'a' so it becomes MRU. 'b' is now the LRU.
    c.get('a');
    c.set('d', 4);
    expect(c.get('b')).toBeUndefined(); // evicted
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
    expect(c.get('d')).toBe(4);
  });

  it('does not evict on update of existing key', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 11); // update, not insert
    expect(c.size).toBe(2);
    expect(c.get('a')).toBe(11);
    expect(c.get('b')).toBe(2);
  });

  it('updating a key promotes it to MRU', () => {
    const c = new LruCache<string, number>(3);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.set('a', 11); // touch via update
    c.set('d', 4);  // evicts LRU, which is now 'b'
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(11);
  });

  it('peek does not promote to MRU', () => {
    const c = new LruCache<string, number>(3);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.peek('a'); // no promotion
    c.set('d', 4); // evicts LRU = 'a'
    expect(c.peek('a')).toBeUndefined();
    expect(c.peek('b')).toBe(2);
  });

  it('preserves a stored undefined value distinctly from a miss', () => {
    const c = new LruCache<string, number | undefined>(2);
    c.set('a', undefined);
    expect(c.size).toBe(1);
    // Touching a stored-undefined still works.
    expect(c.get('a')).toBeUndefined();
    expect(c.size).toBe(1);
  });

  it('clear drops all entries', () => {
    const c = new LruCache<string, number>(3);
    c.set('a', 1);
    c.set('b', 2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.get('a')).toBeUndefined();
  });

  it('rejects max ≤ 0', () => {
    expect(() => new LruCache<string, number>(0)).toThrow();
    expect(() => new LruCache<string, number>(-1)).toThrow();
  });

  it('evicts a literal undefined oldest key on overflow', () => {
    const c = new LruCache<number | undefined, number>(2);
    c.set(undefined, 1);
    c.set(1, 2);
    c.set(2, 3);
    expect(c.size).toBe(2);
    expect(c.get(undefined)).toBeUndefined();
    expect(c.get(1)).toBe(2);
    expect(c.get(2)).toBe(3);
  });
});
