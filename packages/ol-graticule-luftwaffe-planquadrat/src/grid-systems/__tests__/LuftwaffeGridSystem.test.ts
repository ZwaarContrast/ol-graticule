import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Point } from 'ol/geom';
import { ParseError, isCombinedFormatted } from '@zwaarcontrast/ol-graticule';
import { LuftwaffeGridSystem } from '../LuftwaffeGridSystem.js';

function latsOfHorizontalLines(grid: LuftwaffeGridSystem, extent: [number, number, number, number], resolution: number): number[] {
  const features = grid.getFeatures(extent, resolution, 'EPSG:4326');
  return features
    .filter((f) => f.get('gridAxis') === 'y')
    .map((f) => f.get('gridValue') as number)
    .sort((a, b) => a - b);
}

function depthsOfHorizontalLines(grid: LuftwaffeGridSystem, extent: [number, number, number, number], resolution: number): Map<number, number> {
  const features = grid.getFeatures(extent, resolution, 'EPSG:4326');
  const out = new Map<number, number>();
  for (const f of features) {
    if (f.get('gridAxis') !== 'y') continue;
    out.set(f.get('gridValue') as number, f.get('gridDepth') as number);
  }
  return out;
}

describe('LuftwaffeGridSystem horizontal line anchor', () => {
  it('GNMV ZZG-depth view emits lines at real ZZG boundaries (-1°, 9°, ...), not multiples of 10°', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const lats = latsOfHorizontalLines(grid, [-180, -89, 180, 89], 0.25);
    expect(lats).toContain(-1);
    expect(lats).toContain(9);
    expect(lats).toContain(19);
    expect(lats).toContain(-11);
    expect(lats).toContain(89);
    expect(lats).not.toContain(0);
    expect(lats).not.toContain(10);
    expect(lats).not.toContain(-10);
  });

  it('JMN JT-depth view emits lines at both ZZG boundaries and inner N/S splits', () => {
    const grid = new LuftwaffeGridSystem({ system: 'jmn' });
    const lats = latsOfHorizontalLines(grid, [-20, 0, 20, 60], 0.1);
    expect(lats).toContain(9);
    expect(lats).toContain(19);
    expect(lats).toContain(29);
    expect(lats).toContain(4);
    expect(lats).toContain(14);
    expect(lats).toContain(24);
    expect(lats).not.toContain(5);
    expect(lats).not.toContain(10);
  });

  it('lat=9 (a ZZG boundary that is also on the GT grid) is tagged as ZZG (depth 0)', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const depths = depthsOfHorizontalLines(grid, [-10, 0, 10, 30], 0.01);
    expect(depths.get(9)).toBe(0);
    expect(depths.get(19)).toBe(0);
    expect(depths.get(5)).toBe(1);
  });
});

describe('LuftwaffeGridSystem cell labels', () => {
  it('places GNMV ZZG label at real cell center (lat=4, not lat=5, for band -1 to 9)', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const labels = grid.getCellLabels([-15, -5, 15, 8], 0.25, 'EPSG:4326');
    const oOst = labels.find((l) => l.text === '00 Ost');
    expect(oOst).toBeDefined();
    const coord = (oOst!.point as Point).getCoordinates();
    expect(coord[1]).toBe(4);
  });

  it('places GNMV ZZG label at center lat=-6 for south band 0 (NW=-1, SW=-11)', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const labels = grid.getCellLabels([-5, -15, 15, -2], 0.25, 'EPSG:4326');
    const oSO = labels.find((l) => l.text === '00 Südost');
    expect(oSO).toBeDefined();
    const coord = (oSO!.point as Point).getCoordinates();
    expect(coord[1]).toBe(-6);
  });
});

describe('LuftwaffeGridSystem JMN era coercion', () => {
  it('ignores era=pre-1943 when system is JMN (JMN only existed in its post-1943 form)', () => {
    const jmnPre = new LuftwaffeGridSystem({ system: 'jmn', era: 'pre-1943' });
    const jmnPost = new LuftwaffeGridSystem({ system: 'jmn', era: 'post-1943' });
    const extent: [number, number, number, number] = [6.8, 50.9, 7.0, 51.0];
    const labelsPre = jmnPre.getCellLabels(extent, 1e-6, 'EPSG:4326').map((l) => l.text).sort();
    const labelsPost = jmnPost.getCellLabels(extent, 1e-6, 'EPSG:4326').map((l) => l.text).sort();
    expect(labelsPre).toEqual(labelsPost);
  });

  it('GNMV still honours era=pre-1943 (regression guard)', () => {
    const gnmvPre = new LuftwaffeGridSystem({ system: 'gnmv', era: 'pre-1943' });
    const text = gnmvPre.formatCoordinate([13.376257, 52.518720], 'EPSG:4326').combined;
    expect(text).toMatch(/(lo|ro|lu|ru)$/);
  });
});

describe('LuftwaffeGridSystem formatCoordinate', () => {
  it('JMN at maxDepth=5 produces a complete reference at Köln', () => {
    const grid = new LuftwaffeGridSystem({ system: 'jmn' });
    const text = grid.formatCoordinate([6.895, 50.991111], 'EPSG:4326').combined;
    expect(text).toBe('05 Ost S NO 3 2 a');
  });

  it('GNMV at maxDepth=5 produces a complete reference at Berlin', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const text = grid.formatCoordinate([13.376257, 52.518720], 'EPSG:4326').combined;
    expect(text).toBe('15 Ost 33 3 9 7 c');
  });

  it('JMN truncates gracefully at maxDepth=1 (no orphan KT/MelT/AT)', () => {
    const grid = new LuftwaffeGridSystem({ system: 'jmn', maxDepth: 1 });
    const text = grid.formatCoordinate([6.895, 50.991111], 'EPSG:4326').combined;
    expect(text).toBe('05 Ost S');
  });

  it('wraps cursor longitude when panned past the antimeridian (lon=-355 ≡ 5°E)', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const wrapped = grid.formatCoordinate([-355, 53.5], 'EPSG:4326').combined;
    const direct = grid.formatCoordinate([5, 53.5], 'EPSG:4326').combined;
    expect(wrapped).toBe(direct);
    expect(wrapped.startsWith('05 Ost')).toBe(true);
  });

  it('wraps cursor longitude when panned past 180° (lon=365 ≡ 5°E)', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const wrapped = grid.formatCoordinate([365, 53.5], 'EPSG:4326').combined;
    expect(wrapped.startsWith('05 Ost')).toBe(true);
  });
});

describe('LuftwaffeGridSystem antimeridian', () => {
  it('emits labels in extents that extend past 180° with text normalized to a valid ZZG', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const labels = grid.getCellLabels([170, 0, 220, 8], 0.25, 'EPSG:4326');

    const byCenterLon = new Map<number, string>();
    for (const l of labels) {
      const c = (l.point as Point).getCoordinates();
      byCenterLon.set(c[0]!, l.text);
    }

    expect(byCenterLon.get(175)).toBe('170 Ost');
    expect(byCenterLon.get(185)).toBe('180 West');
    expect(byCenterLon.get(195)).toBe('170 West');
    expect(byCenterLon.get(205)).toBe('160 West');
    expect(byCenterLon.get(215)).toBe('150 West');
  });

  it('emits labels in extents extending below -180° with text normalized', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const labels = grid.getCellLabels([-220, 0, -170, 8], 0.25, 'EPSG:4326');

    const byCenterLon = new Map<number, string>();
    for (const l of labels) {
      const c = (l.point as Point).getCoordinates();
      byCenterLon.set(c[0]!, l.text);
    }

    expect(byCenterLon.get(-175)).toBe('180 West');
    expect(byCenterLon.get(-185)).toBe('170 Ost');
    expect(byCenterLon.get(-195)).toBe('160 Ost');
    expect(byCenterLon.get(-205)).toBe('150 Ost');
    expect(byCenterLon.get(-215)).toBe('140 Ost');
  });
});

describe('LuftwaffeGridSystem.getLabels', () => {
  it('returns an empty array (no edge labels)', () => {
    const grid = new LuftwaffeGridSystem();
    expect(grid.getLabels([-10, 40, 20, 60], 0.05, 'EPSG:4326')).toEqual([]);
  });
});

describe('LuftwaffeGridSystem.parseCoordinate', () => {
  it('decodes a known GNMV reference (Berlin Reichstag) to the centre of its cell', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const [lon, lat] = grid.parseCoordinate('15 O 33 3 9 7 c', 'EPSG:4326');
    expect(lon).toBeGreaterThan(13.37);
    expect(lon).toBeLessThan(13.39);
    expect(lat).toBeGreaterThan(52.51);
    expect(lat).toBeLessThan(52.53);
  });

  it('decodes 15O to the centre [15, 54] of its [10, 49, 20, 59] bbox', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    const [lon, lat] = grid.parseCoordinate('15O', 'EPSG:4326');
    expect(lon).toBeCloseTo(15, 6);
    expect(lat).toBeCloseTo(54, 6);
  });

  it('throws ParseError on garbage input', () => {
    const grid = new LuftwaffeGridSystem({ system: 'gnmv' });
    expect(() => grid.parseCoordinate('not-a-ref', 'EPSG:4326')).toThrow(ParseError);
  });
});

describe('LuftwaffeGridSystem.parseCoordinate — property: format ↔ parse round-trip', () => {
  function expectRoundTrip(system: 'gnmv' | 'jmn', maxDepth: number, numRuns = 100): void {
    const grid = new LuftwaffeGridSystem({ system, maxDepth });
    fc.assert(
      fc.property(
        fc.double({ min: 40, max: 58, noNaN: true }),
        fc.double({ min: -5, max: 25, noNaN: true }),
        (lat, lon) => {
          const first = grid.formatCoordinate([lon, lat], 'EPSG:4326');
          if (!isCombinedFormatted(first) || first.combined === '-') return;
          const [px, py] = grid.parseCoordinate(first.combined, 'EPSG:4326');
          const second = grid.formatCoordinate([px, py], 'EPSG:4326');
          expect(second).toEqual(first);
        },
      ),
      { numRuns },
    );
  }

  it('GNMV @ maxDepth=5 (Arbeitstrapez) — every formattable point round-trips', () => {
    expectRoundTrip('gnmv', 5);
  });

  it('GNMV @ maxDepth=2 (Mitteltrapez)', () => {
    expectRoundTrip('gnmv', 2);
  });

  it('JMN (post-1943) @ maxDepth=2', () => {
    expectRoundTrip('jmn', 2);
  });
});

describe('LuftwaffeGridSystem.parseCoordinate — property: invalid inputs always throw ParseError', () => {
  const grid = new LuftwaffeGridSystem({ system: 'gnmv' });

  it('throws on lowercase-letter-only strings (no digits, no valid suffix)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz') }),
        (s) => {
          expect(() => grid.parseCoordinate(s, 'EPSG:4326')).toThrow(ParseError);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('throws on punctuation-only strings (no parsable token)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 6, unit: fc.constantFrom(...'!@#$%^&*+=<>?~`|\\') }),
        (s) => {
          expect(() => grid.parseCoordinate(s, 'EPSG:4326')).toThrow(ParseError);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('throws on a leading letter followed by digits (suffix in wrong position)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('O', 'W', 'N', 'S'),
        fc.integer({ min: 1, max: 99 }),
        (suffix, n) => {
          expect(() => grid.parseCoordinate(`${suffix}${n}`, 'EPSG:4326')).toThrow(ParseError);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('throws on the empty string and on whitespace-only input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 6, unit: fc.constantFrom(' ', '\t', '\n') }),
        (s) => {
          expect(() => grid.parseCoordinate(s, 'EPSG:4326')).toThrow(ParseError);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('throws when ZZG latitude-tens exceeds 8 (last digit of the prefix)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 18 }),
        fc.constantFrom('O', 'W', 'SO', 'SW'),
        (lonTens, suffix) => {
          expect(() => grid.parseCoordinate(`${lonTens}9${suffix}`, 'EPSG:4326')).toThrow(ParseError);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('throws when ZZG longitude-tens exceeds 18 (first digits of the prefix)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 19, max: 99 }),
        fc.integer({ min: 0, max: 8 }),
        fc.constantFrom('O', 'W'),
        (lonTens, latTens, suffix) => {
          expect(() => grid.parseCoordinate(`${lonTens}${latTens}${suffix}`, 'EPSG:4326')).toThrow(ParseError);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('throws on ZZG with trailing chars outside the [\\s/,;] separator set', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 4, unit: fc.constantFrom(...'!@#$%^&*+=<>?~`|\\') }),
        (garbage) => {
          expect(() => grid.parseCoordinate(`15O${garbage}`, 'EPSG:4326')).toThrow(ParseError);
        },
      ),
      { numRuns: 100 },
    );
  });
});
