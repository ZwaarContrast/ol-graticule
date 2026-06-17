import { bench, describe } from 'vitest';
import { BoundedCache, formatDecimal } from '@zwaarcontrast/ol-graticule';

// Mirrors the body of MBSFormatter / GSGSFormatter `format()`: the only
// difference between the two benches per workload is whether the cache is the
// real BoundedCache or a no-op stub that always misses. Measures what the
// edge-label cache actually buys.

interface NumStringCache {
  get(key: number): string | undefined;
  set(key: number, value: string): void;
}

const noopCache: NumStringCache = {
  get: () => undefined,
  set: () => {},
};

const compute = (value: number): string =>
  `${formatDecimal(value / 1000, 1)} km`;

function runStream(cache: NumStringCache, stream: number[]): void {
  for (const value of stream) {
    const cached = cache.get(value);
    if (cached !== undefined) continue;
    cache.set(value, compute(value));
  }
}

// Static view re-rendered many frames: a handful of distinct edge values recur
// every frame, so the cache is warm and hits dominate.
const STATIC_VALUES = Array.from(
  { length: 12 },
  (_, i) => 100_000 + i * 50_000,
);
const staticStream = Array.from(
  { length: 2000 },
  (_, i) => STATIC_VALUES[i % STATIC_VALUES.length]!,
);

// Continuous pan/zoom: every frame's edge values differ, so the cache never
// hits and only pays get-miss + set overhead.
const panStream = Array.from({ length: 2000 }, (_, i) => 100_000 + i * 137);

describe('edge-label cache — static view (warm, repeated values)', () => {
  bench('BoundedCache', () => {
    runStream(new BoundedCache<number, string>(), staticStream);
  });
  bench('no-op cache (always recompute)', () => {
    runStream(noopCache, staticStream);
  });
});

describe('edge-label cache — panning (all-distinct values)', () => {
  bench('BoundedCache', () => {
    runStream(new BoundedCache<number, string>(), panStream);
  });
  bench('no-op cache (always recompute)', () => {
    runStream(noopCache, panStream);
  });
});
