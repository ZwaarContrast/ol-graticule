import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import type { Transform } from 'ol/transform';
import { straddles, minSpacing, collectLensHoles } from '../lensGeometry.js';

describe('straddles', () => {
  it('is true when c lies between a and b (either order)', () => {
    expect(straddles(0, 10, 5)).toBe(true);
    expect(straddles(10, 0, 5)).toBe(true);
    expect(straddles(0, 10, 0)).toBe(true);
    expect(straddles(0, 10, 10)).toBe(true);
  });

  it('is false outside the interval or when the endpoints are equal', () => {
    expect(straddles(0, 10, 11)).toBe(false);
    expect(straddles(0, 10, -1)).toBe(false);
    expect(straddles(5, 5, 5)).toBe(false);
  });
});

describe('minSpacing', () => {
  it('is NaN with fewer than two values', () => {
    expect(minSpacing([])).toBeNaN();
    expect(minSpacing([42])).toBeNaN();
  });

  it('returns the smallest gap between sorted values', () => {
    expect(minSpacing([0, 100, 250])).toBe(100);
    expect(minSpacing([250, 0, 100])).toBe(100);
  });

  it('ignores near-duplicate values under half a pixel', () => {
    // The 0.2px gap between 100 and 100.2 is treated as noise, leaving 100.
    expect(minSpacing([0, 100, 100.2])).toBe(100);
  });
});

describe('collectLensHoles', () => {
  const identity: Transform = [1, 0, 0, 1, 0, 0];

  function meridian(x: number): Feature {
    const f = new Feature(new LineString([[x, -300], [x, 300]]));
    f.set('gridAxis', 'x');
    return f;
  }
  function parallel(y: number): Feature {
    const f = new Feature(new LineString([[-300, y], [300, y]]));
    f.set('gridAxis', 'y');
    return f;
  }

  it('measures the cell and carves the crossing nearest the cursor', () => {
    const features = [meridian(0), meridian(100), parallel(0), parallel(100)];
    // Cursor just off the (0,0) crossing; reach = max(cell*0.6, 34) = 60px.
    const { holes, cell } = collectLensHoles(
      features, identity, 1, 0, 5, 5, 150, 0.6, 56, 8,
    );
    expect(cell).toBe(100);
    expect(holes).toHaveLength(1);
    expect(holes[0]?.x).toBeCloseTo(0);
    expect(holes[0]?.y).toBeCloseTo(0);
    expect(holes[0]?.strength).toBeGreaterThan(0.9);
  });

  it('lights up multiple crossings when several are within reach', () => {
    const features = [meridian(0), meridian(40), parallel(0), parallel(40)];
    // cell = 40, reach = max(24, 34) = 34px; cursor at the centre of the cell.
    const { holes } = collectLensHoles(features, identity, 1, 0, 20, 20, 150, 0.6, 56, 8);
    expect(holes.length).toBe(4);
  });

  it('returns no holes when the cursor is far from every crossing', () => {
    const features = [meridian(0), meridian(100), parallel(0), parallel(100)];
    const { holes } = collectLensHoles(features, identity, 1, 0, 50, 50, 150, 0.6, 56, 8);
    expect(holes).toHaveLength(0);
  });
});
