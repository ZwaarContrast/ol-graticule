import { bench, describe } from 'vitest';
import { DegreeFormatter } from '../DegreeFormatter.js';
import { MetricFormatter } from '../MetricFormatter.js';
import { PixelFormatter } from '../PixelFormatter.js';

const degValues: number[] = [];
const linearValues: number[] = [];
for (let i = 0; i < 200; i++) {
  // Stay strictly inside [-89.5, 89.5] and offset by a value that never
  // rounds the DDM minute up to 60 (which the formatter does not roll
  // over). The bench measures throughput, not edge-case correctness.
  degValues.push(-89.5 + (i / 200) * 179 + 0.1234);
  linearValues.push(i * 13_753.91);
}
const degDms = new DegreeFormatter('dms');
const degDd = new DegreeFormatter('dd');
const degDdm = new DegreeFormatter('ddm');
const metricM = new MetricFormatter();
const pixel = new PixelFormatter();

const dmsTexts = degValues.map((v) => degDms.format(v, 'y'));
const ddTexts = degValues.map((v) => degDd.format(v, 'y'));
const ddmTexts = degValues.map((v) => degDdm.format(v, 'y'));
const metricTexts = linearValues.map((v) => metricM.format(v, 'x'));

describe('DegreeFormatter — format ×200 (steady-state with cache hits)', () => {
  // After the first iteration, all 200 values sit in the formatter's
  // BoundedCache, so subsequent runs measure the realistic frame-to-frame
  // path where edge labels typically repeat.
  bench('dms format', () => {
    for (const v of degValues) degDms.format(v, 'y');
  });
  bench('dd format', () => {
    for (const v of degValues) degDd.format(v, 'y');
  });
  bench('ddm format', () => {
    for (const v of degValues) degDdm.format(v, 'y');
  });
});

describe('DegreeFormatter — format ×200 (cold, fresh formatter per iteration)', () => {
  // Constructing a new formatter forces cache misses on every value so
  // we measure the raw format algorithm. Compare with the cached bench
  // above to see the cache headroom.
  bench('dms format cold', () => {
    const fresh = new DegreeFormatter('dms');
    for (const v of degValues) fresh.format(v, 'y');
  });
  bench('dd format cold', () => {
    const fresh = new DegreeFormatter('dd');
    for (const v of degValues) fresh.format(v, 'y');
  });
  bench('ddm format cold', () => {
    const fresh = new DegreeFormatter('ddm');
    for (const v of degValues) fresh.format(v, 'y');
  });
});

describe('DegreeFormatter — parse ×200', () => {
  bench('dms parse', () => {
    for (const t of dmsTexts) degDms.parse(t, 'y');
  });
  bench('dd parse', () => {
    for (const t of ddTexts) degDd.parse(t, 'y');
  });
  bench('ddm parse', () => {
    for (const t of ddmTexts) degDdm.parse(t, 'y');
  });
});

describe('MetricFormatter — ×200', () => {
  // format() caches per value; this is the steady-state path.
  bench('format (cached)', () => {
    for (const v of linearValues) metricM.format(v, 'x');
  });
  bench('format (cold)', () => {
    const fresh = new MetricFormatter();
    for (const v of linearValues) fresh.format(v, 'x');
  });
  bench('parse', () => {
    for (const t of metricTexts) metricM.parse(t, 'x');
  });
});

describe('PixelFormatter — ×200', () => {
  bench('format', () => {
    for (const v of linearValues) pixel.format(v, 'x');
  });
});
