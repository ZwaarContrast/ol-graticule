import { bench, describe } from 'vitest';
import { MBSFormatter } from '../MBSFormatter.js';
import { NORD_DE_GUERRE_SCHEME } from '../schemes.js';

const formatter = new MBSFormatter(NORD_DE_GUERRE_SCHEME);

const samples: Array<[number, number]> = [];
for (let i = 0; i < 200; i++) {
  const e = (i * 7913) % 2_000_000;
  const n = (i * 6271) % 2_000_000;
  samples.push([e, n]);
}

// Pre-compute the formatted refs once; the parseCoordinate bench measures
// pure parsing throughput, not parsing-plus-formatting.
const compoundRefs = samples
  .map(([e, n]) => formatter.formatMBS(e, n))
  .filter((r) => /^[a-zA-Z]/.test(r));

describe('MBSFormatter — hot path', () => {
  bench('formatCellLabel ×200', () => {
    for (const [e, n] of samples) formatter.formatCellLabel(e, n);
  });

  bench('formatMBS ×200', () => {
    for (const [e, n] of samples) formatter.formatMBS(e, n);
  });

  bench(`parseCoordinate ×${compoundRefs.length}`, () => {
    for (const r of compoundRefs) formatter.parseCoordinate(r);
  });
});
