import { bench, describe } from 'vitest';
import { getTransform } from 'ol/proj';
import { BoundedCache } from '../boundedCache.js';
import { LruCache } from '../lruCache.js';
import { RenderCache } from '../renderCache.js';
import { TransformCache, transformBatchCached } from '../transformCache.js';
import { formatDecimal } from '../formatNumber.js';

const N = 2000;
const compute = (v: number): string => `${formatDecimal(v / 1000, 1)} km`;

// Warm: keys repeat, so a populated cache hits. Cold: keys all distinct, so the
// cache always misses and pays get+compute+set. The warm/cold gap is the win;
// a cold result faster than warm means the cache is net overhead for that load.

const WARM_KEYS = Array.from(
  { length: N },
  (_, i) => 100_000 + (i % 16) * 1000,
);
const COLD_KEYS = Array.from({ length: N }, (_, i) => 100_000 + i * 137);

function driveKV(
  cache: {
    get(k: number): string | undefined;
    set(k: number, v: string): void;
  },
  keys: number[],
): void {
  for (const k of keys) {
    const hit = cache.get(k);
    if (hit !== undefined) continue;
    cache.set(k, compute(k));
  }
}

describe('BoundedCache (compute = formatDecimal)', () => {
  bench('warm (repeated keys)', () =>
    driveKV(new BoundedCache<number, string>(), WARM_KEYS),
  );
  bench('cold (all-distinct keys)', () =>
    driveKV(new BoundedCache<number, string>(), COLD_KEYS),
  );
});

describe('LruCache (compute = formatDecimal)', () => {
  bench('warm (repeated keys)', () =>
    driveKV(new LruCache<number, string>(512), WARM_KEYS),
  );
  bench('cold (all-distinct keys)', () =>
    driveKV(new LruCache<number, string>(512), COLD_KEYS),
  );
});

// RenderCache is a single-entry memoizer keyed on (extent, resolution, proj).
// `compute` here stands in for building a frame's render context: derive 256
// values. Hit = same key every call (skip compute); miss = key changes every
// call (recompute). The gap is the per-frame compute the cache elides whenever
// the view is unchanged (cursor move, hover, redraw).
const heavyCompute = (): number => {
  let acc = 0;
  for (let i = 0; i < 256; i++) acc += Math.sqrt(i * 1.000001);
  return acc;
};
const FIXED_EXTENT: [number, number, number, number] = [0, 0, 1000, 1000];

describe('RenderCache (compute = derive 256 values)', () => {
  bench('hit (view unchanged across frames)', () => {
    const cache = new RenderCache<number>();
    for (let i = 0; i < N; i++) {
      cache.get(FIXED_EXTENT, 1, 'EPSG:3857', heavyCompute);
    }
  });
  bench('miss (view changes every frame)', () => {
    const cache = new RenderCache<number>();
    for (let i = 0; i < N; i++) {
      cache.get([i, 0, 1000 + i, 1000], 1, 'EPSG:3857', heavyCompute);
    }
  });
});

// TransformCache guards real proj transforms via transformBatchCached. A frame
// is 200 points; warm reuses the same points each frame (cell edges/labels
// recur), cold feeds fresh points each frame.
const FRAMES = 100;
const PTS = 200;
const toView = getTransform('EPSG:4326', 'EPSG:3857');
const warmFrame: number[] = [];
for (let i = 0; i < PTS; i++)
  warmFrame.push(-5 + (i % 20) * 0.5, 40 + (i % 10) * 0.5);

describe('TransformCache via transformBatchCached (real 4326→3857)', () => {
  bench('warm (same points every frame)', () => {
    const cache = new TransformCache();
    for (let f = 0; f < FRAMES; f++) {
      transformBatchCached(warmFrame, warmFrame.slice(), 2, toView, cache);
    }
  });
  bench('cold (fresh points every frame)', () => {
    const cache = new TransformCache();
    for (let f = 0; f < FRAMES; f++) {
      const frame: number[] = [];
      for (let i = 0; i < PTS; i++)
        frame.push(-5 + f * 0.01 + i * 0.013, 40 + i * 0.011);
      transformBatchCached(frame, frame.slice(), 2, toView, cache);
    }
  });
  bench('no cache (transform every frame)', () => {
    for (let f = 0; f < FRAMES; f++) {
      toView(warmFrame.slice(), warmFrame.slice(), 2);
    }
  });
});
