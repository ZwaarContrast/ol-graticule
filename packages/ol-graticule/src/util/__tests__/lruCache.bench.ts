import { bench, describe } from 'vitest';
import { LruCache } from '../lruCache.js';

describe('LruCache hot path', () => {
  bench('get/set under capacity (cache hits)', () => {
    const cache = new LruCache<number, number>(256);
    for (let i = 0; i < 100; i++) cache.set(i, i);
    for (let i = 0; i < 100; i++) cache.get(i);
  });

  bench('promotion + eviction at boundary (steady-state miss path)', () => {
    const cache = new LruCache<number, number>(64);
    for (let i = 0; i < 256; i++) cache.set(i, i);
    for (let i = 192; i < 256; i++) cache.get(i);
  });
});
