import { describe, it, expect, vi } from 'vitest';
import { RenderCache } from '../renderCache.js';
import type { Extent } from 'ol/extent';

describe('RenderCache', () => {
  const extentA: Extent = [0, 0, 100, 100];
  const extentB: Extent = [0, 0, 200, 200];

  it('computes the value on first call and caches it on second', () => {
    const cache = new RenderCache<number>();
    const compute = vi.fn().mockReturnValue(42);
    expect(cache.get(extentA, 1, 'EPSG:3857', compute)).toBe(42);
    expect(cache.get(extentA, 1, 'EPSG:3857', compute)).toBe(42);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('invalidates when extent changes', () => {
    const cache = new RenderCache<number>();
    const compute = vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2);
    expect(cache.get(extentA, 1, 'EPSG:3857', compute)).toBe(1);
    expect(cache.get(extentB, 1, 'EPSG:3857', compute)).toBe(2);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('hits cache when extent drifts by less than one pixel', () => {
    const cache = new RenderCache<number>();
    const compute = vi.fn().mockReturnValue(7);
    const resolution = 10;
    cache.get(extentA, resolution, 'EPSG:3857', compute);
    const subPixel: Extent = [0.5, -0.5, 100.1, 99.9];
    expect(cache.get(subPixel, resolution, 'EPSG:3857', compute)).toBe(7);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('misses cache when any extent coord drifts by a full pixel', () => {
    const cache = new RenderCache<number>();
    const compute = vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2);
    const resolution = 10;
    cache.get(extentA, resolution, 'EPSG:3857', compute);
    const driftedX: Extent = [10, 0, 110, 100];
    cache.get(driftedX, resolution, 'EPSG:3857', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('invalidates when resolution changes', () => {
    const cache = new RenderCache<number>();
    const compute = vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2);
    cache.get(extentA, 1, 'EPSG:3857', compute);
    cache.get(extentA, 2, 'EPSG:3857', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('invalidates when projection changes', () => {
    const cache = new RenderCache<number>();
    const compute = vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2);
    cache.get(extentA, 1, 'EPSG:3857', compute);
    cache.get(extentA, 1, 'EPSG:4326', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('caches null/undefined values (no spurious recomputation)', () => {
    const cache = new RenderCache<number | null>();
    const compute = vi.fn().mockReturnValue(null);
    expect(cache.get(extentA, 1, 'EPSG:3857', compute)).toBeNull();
    expect(cache.get(extentA, 1, 'EPSG:3857', compute)).toBeNull();
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('drops the cache on invalidate()', () => {
    const cache = new RenderCache<number>();
    const compute = vi.fn().mockReturnValue(1);
    cache.get(extentA, 1, 'EPSG:3857', compute);
    cache.invalidate();
    cache.get(extentA, 1, 'EPSG:3857', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
