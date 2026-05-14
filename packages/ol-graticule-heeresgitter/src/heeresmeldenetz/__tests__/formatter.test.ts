import { describe, expect, it } from 'vitest';

import { FALSE_EASTING } from '../../dhg/zones.js';
import {
  ARBEITSTRAPEZ_M,
  KLEINQUADRAT_M,
  MELDETRAPEZ_M,
} from '../levels.js';
import {
  HmnIntervalStrategy,
  hmnHierarchicalLabel,
} from '../formatter.js';

describe('HmnIntervalStrategy', () => {
  const strategy = new HmnIntervalStrategy(80);

  it('returns the 6 km Kleinquadrat at coarse resolutions', () => {
    // resolution × targetScreenPx (80) ≈ desired metres-per-step
    expect(strategy.getInterval(100)).toBe(KLEINQUADRAT_M); // 100 × 80 = 8 km → 6 km bucket
  });

  it('returns the 2 km Meldetrapez at mid resolutions', () => {
    expect(strategy.getInterval(20)).toBe(MELDETRAPEZ_M); // 20 × 80 = 1.6 km → 2 km bucket
  });

  it('returns the 1 km Arbeitstrapez at fine resolutions', () => {
    expect(strategy.getInterval(5)).toBe(ARBEITSTRAPEZ_M); // 5 × 80 = 400 m → 1 km bucket
  });

  it('caps at the smallest cell size at very fine resolutions', () => {
    expect(strategy.getInterval(0.01)).toBe(ARBEITSTRAPEZ_M);
  });
});

describe('hmnHierarchicalLabel', () => {
  // Anchor: a known Kleinquadrat NW corner in zone 5. (E=500000=CM,
  // N=5478000=row 12 of Großquadrat (0, 36)). Inside this cell, gx=0/gy=12
  // → Kleinquadrat column letter A, row letter N (with I-skip, N is index 12).
  const cellMidE = FALSE_EASTING + KLEINQUADRAT_M / 2; // 503 000
  const cellMidN = 5_478_000 - KLEINQUADRAT_M / 2;     // 5 475 000

  it('returns the 2-letter Kleinquadrat at 6 km interval', () => {
    expect(hmnHierarchicalLabel(cellMidE, cellMidN, KLEINQUADRAT_M)).toBe('AN');
  });

  it('returns Kleinquadrat + Meldetrapez digit at 2 km interval', () => {
    // Centre of the Kleinquadrat is at the centre of Meldetrapez 5 (the middle of the 3×3 grid).
    expect(hmnHierarchicalLabel(cellMidE, cellMidN, MELDETRAPEZ_M)).toBe('AN 5');
  });

  it('returns Kleinquadrat + Meldetrapez + Arbeitstrapez at 1 km interval', () => {
    // Inside Meldetrapez 5 the centre point is on the dividing line, which
    // rounds into the SE quadrant 'd' (the +500/+500 offset from Meldetrapez NW).
    const sample = hmnHierarchicalLabel(cellMidE + 500, cellMidN - 500, ARBEITSTRAPEZ_M);
    expect(sample).toBe('AN 5d');
  });

  it('uses the Großquadrat anchor west of any easting (eastings always have a column letter)', () => {
    // Eastings past the Großquadrat just wrap into the next 150 km tile, so a
    // far-east coordinate still gets a valid 2-letter label.
    const farEastE = FALSE_EASTING + 30 * KLEINQUADRAT_M;
    const label = hmnHierarchicalLabel(farEastE, cellMidN, KLEINQUADRAT_M);
    expect(label).toMatch(/^[A-HJ-Z]{2}$/);
  });
});
