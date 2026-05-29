import { describe, it, expect } from 'vitest';
import { normalizeLon, extentFromPolygon, transformExtentSampled } from '../geo.js';

describe('normalizeLon', () => {
  it('is the identity inside [-180, 180]', () => {
    expect(normalizeLon(0)).toBe(0);
    expect(normalizeLon(180)).toBe(180);
    expect(normalizeLon(-180)).toBe(-180);
    expect(normalizeLon(45.5)).toBe(45.5);
  });

  it('wraps values just past +180', () => {
    expect(normalizeLon(181)).toBeCloseTo(-179, 10);
    expect(normalizeLon(360)).toBeCloseTo(0, 10);
    expect(normalizeLon(540)).toBeCloseTo(180, 10);
  });

  it('wraps values just past -180', () => {
    expect(normalizeLon(-181)).toBeCloseTo(179, 10);
    expect(normalizeLon(-360)).toBeCloseTo(0, 10);
    expect(normalizeLon(-540)).toBeCloseTo(-180, 10);
  });

  it('passes through NaN and infinities', () => {
    expect(Number.isNaN(normalizeLon(NaN))).toBe(true);
    expect(normalizeLon(Infinity)).toBe(Infinity);
    expect(normalizeLon(-Infinity)).toBe(-Infinity);
  });
});

describe('extentFromPolygon', () => {
  it('computes the bbox of a polygon', () => {
    const poly: [number, number][] = [
      [0, 0],
      [10, 5],
      [3, 8],
    ];
    expect(extentFromPolygon(poly)).toEqual([0, 0, 10, 8]);
  });

  it('applies symmetric padding', () => {
    const poly: [number, number][] = [
      [0, 0],
      [4, 4],
    ];
    expect(extentFromPolygon(poly, 1)).toEqual([-1, -1, 5, 5]);
  });

  it('handles negative coordinates', () => {
    expect(extentFromPolygon([[-5, -10], [3, -1]])).toEqual([-5, -10, 3, -1]);
  });
});

describe('transformExtentSampled', () => {
  it('returns the identical extent for an identity transform', () => {
    const id = (xy: number[]): number[] => [xy[0]!, xy[1]!];
    const ext = transformExtentSampled([0, 0, 10, 10], id, 4);
    expect(ext[0]).toBeCloseTo(0);
    expect(ext[1]).toBeCloseTo(0);
    expect(ext[2]).toBeCloseTo(10);
    expect(ext[3]).toBeCloseTo(10);
  });

  it('captures a non-affine bulge that lives entirely between the corners', () => {
    // Bulge peaks at x = 5 with y_extra = sin(π · 0.5) = 1, so the true
    // transformed maxY is 11. Sampling 32 points along each edge MUST
    // reach within 0.01 of that peak; sampling only the 4 corners (which
    // happens at samples=1) would miss it entirely.
    const bulge = (xy: number[]): number[] => {
      const x = xy[0]!;
      const y = xy[1]!;
      const t = x / 10;
      return [x, y + Math.sin(Math.PI * t)];
    };
    const sampled = transformExtentSampled([0, 0, 10, 10], bulge, 32);
    expect(sampled[3]).toBeCloseTo(11, 1);

    const cornersOnly = transformExtentSampled([0, 0, 10, 10], bulge, 1);
    // At x ∈ {0, 10} the sinusoid is 0, so corners-only sampling reports
    // maxY = 10, missing the bulge entirely.
    expect(cornersOnly[3]).toBeCloseTo(10, 6);
  });

  it('returns NaN-filled extent when every sample fails to transform', () => {
    const fail = (): number[] => [NaN, NaN];
    const ext = transformExtentSampled([0, 0, 10, 10], fail, 4);
    expect(ext.every(Number.isNaN)).toBe(true);
  });

  it('skips samples that yield non-finite coordinates and uses the remaining range', () => {
    // The x = 0 edge fails; every other sample returns (x, y) verbatim,
    // so the extent should be derived from the (x > 0) samples only.
    const partial = (xy: number[]): number[] => {
      const x = xy[0]!;
      if (x === 0) return [Infinity, Infinity];
      return [x, xy[1]!];
    };
    const ext = transformExtentSampled([0, 0, 10, 10], partial, 4);
    expect(ext[0]).toBeCloseTo(2.5, 6); // smallest sampled x with finite output
    expect(ext[1]).toBe(0);
    expect(ext[2]).toBe(10);
    expect(ext[3]).toBe(10);
  });
});
