import { describe, expect, it } from 'vitest';
import {
  GT_LAT_DEG,
  GT_LON_DEG,
  KT_LAT_DEG,
  KT_LON_DEG,
  MT_LAT_DEG,
  MT_LON_DEG,
  ZZG_BASELINE_LAT,
  ZZG_LAT_DEG,
  ZZG_LON_DEG,
  ZZG_NORTH_LIMIT,
  arbeitstrapezDims,
  meldetrapezDims,
} from '../levels.js';

describe('Luftwaffe level constants', () => {
  it('ZZG = 10° × 10°', () => {
    expect(ZZG_LAT_DEG).toBe(10);
    expect(ZZG_LON_DEG).toBe(10);
  });

  it('Großtrapez = 1° × 1°', () => {
    expect(GT_LAT_DEG).toBe(1);
    expect(GT_LON_DEG).toBe(1);
  });

  it('Mitteltrapez = 15′ × 30′', () => {
    expect(MT_LAT_DEG).toBeCloseTo(15 / 60, 12);
    expect(MT_LON_DEG).toBeCloseTo(30 / 60, 12);
  });

  it('Kleintrapez = 5′ × 10′', () => {
    expect(KT_LAT_DEG).toBeCloseTo(5 / 60, 12);
    expect(KT_LON_DEG).toBeCloseTo(10 / 60, 12);
  });

  it('ZZG limits: north at 89°, baseline at -1°', () => {
    expect(ZZG_NORTH_LIMIT).toBe(89);
    expect(ZZG_BASELINE_LAT).toBe(-1);
  });
});

describe('meldetrapezDims', () => {
  it('post-1943: 3 × 3 subdivision of Kleintrapez', () => {
    const d = meldetrapezDims('post-1943');
    expect(d.rows).toBe(3);
    expect(d.cols).toBe(3);
    expect(d.latDeg * d.rows).toBeCloseTo(KT_LAT_DEG, 12);
    expect(d.lonDeg * d.cols).toBeCloseTo(KT_LON_DEG, 12);
  });

  it('pre-1943: 2 × 2 subdivision of Kleintrapez', () => {
    const d = meldetrapezDims('pre-1943');
    expect(d.rows).toBe(2);
    expect(d.cols).toBe(2);
    expect(d.latDeg * d.rows).toBeCloseTo(KT_LAT_DEG, 12);
    expect(d.lonDeg * d.cols).toBeCloseTo(KT_LON_DEG, 12);
  });
});

describe('arbeitstrapezDims', () => {
  it('post-1943: 3 × 3 subdivision of Meldetrapez', () => {
    const mt = meldetrapezDims('post-1943');
    const at = arbeitstrapezDims('post-1943');
    expect(at.rows).toBe(3);
    expect(at.cols).toBe(3);
    expect(at.latDeg * at.rows).toBeCloseTo(mt.latDeg, 12);
    expect(at.lonDeg * at.cols).toBeCloseTo(mt.lonDeg, 12);
  });

  it('pre-1943: 2 × 2 subdivision of Meldetrapez', () => {
    const mt = meldetrapezDims('pre-1943');
    const at = arbeitstrapezDims('pre-1943');
    expect(at.rows).toBe(2);
    expect(at.cols).toBe(2);
    expect(at.latDeg * at.rows).toBeCloseTo(mt.latDeg, 12);
    expect(at.lonDeg * at.cols).toBeCloseTo(mt.lonDeg, 12);
  });
});
