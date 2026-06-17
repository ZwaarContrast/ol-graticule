import { bench, describe } from 'vitest';
import { DegreeFormatter } from '../DegreeFormatter.js';
import { MetricFormatter } from '../MetricFormatter.js';
import { PixelFormatter } from '../PixelFormatter.js';

// Each formatter caches its `format()` output in a BoundedCache. To measure
// what the cache buys, drive the SAME formatter two ways over an equal call
// count: a warm stream (one value repeated → cache hits) and a cold stream
// (all-distinct values → every call misses and recomputes). The warm/cold gap
// is the cache's contribution. Warm models a static view redrawn each frame
// (edge labels recur); cold models continuous pan (every value fresh).

const N = 2000;
const WARM = Array.from({ length: N }, () => 5.40123);
const COLD = Array.from({ length: N }, (_, i) => 1 + i * 0.00137);

function drive(fn: (value: number) => string, stream: number[]): void {
  let s = '';
  for (const v of stream) s = fn(v);
  if (s.length < 0) throw new Error('unreachable');
}

const dms = new DegreeFormatter('dms');
const dd = new DegreeFormatter('dd');
const ddm = new DegreeFormatter('ddm');
const metric = new MetricFormatter();
const pixel = new PixelFormatter();

describe('DegreeFormatter DMS', () => {
  bench('warm (cache hits)', () => drive((v) => dms.format(v, 'y'), WARM));
  bench('cold (all-distinct, recompute)', () =>
    drive((v) => dms.format(v, 'y'), COLD),
  );
});

describe('DegreeFormatter DD', () => {
  bench('warm (cache hits)', () => drive((v) => dd.format(v, 'y'), WARM));
  bench('cold (all-distinct, recompute)', () =>
    drive((v) => dd.format(v, 'y'), COLD),
  );
});

describe('DegreeFormatter DDM', () => {
  bench('warm (cache hits)', () => drive((v) => ddm.format(v, 'y'), WARM));
  bench('cold (all-distinct, recompute)', () =>
    drive((v) => ddm.format(v, 'y'), COLD),
  );
});

describe('MetricFormatter', () => {
  bench('warm (cache hits)', () => drive((v) => metric.format(v * 1000), WARM));
  bench('cold (all-distinct, recompute)', () =>
    drive((v) => metric.format(v * 1000), COLD),
  );
});

// PixelFormatter wraps a near-trivial `${key} px`; the cache likely earns
// little here, which is exactly what this bench should reveal.
describe('PixelFormatter', () => {
  bench('warm (cache hits)', () => drive((v) => pixel.format(v), WARM));
  bench('cold (all-distinct, recompute)', () =>
    drive((v) => pixel.format(v * 1000), COLD),
  );
});
