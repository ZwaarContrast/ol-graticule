import { describe, it, expect } from 'vitest';
import { transform } from 'ol/proj';
import {
  createIrishCassiniGridSystem,
  IRISH_CASSINI_CRS,
} from '../IrishCassini';

/**
 * Ground truth sampled against Thierry Arsicaud's translator. Ireland
 * fits inside a single 500 km first-letter square labelled `i`, so every
 * in-island point should come back with `i` as its first letter.
 */
const samples = [
  {
    name: 'Dublin',
    lonLat: [-6.2603, 53.3498] as [number, number],
  },
  {
    name: 'Cork',
    lonLat: [-8.4756, 51.8985] as [number, number],
  },
  {
    name: 'Belfast',
    lonLat: [-5.9301, 54.5973] as [number, number],
  },
  {
    name: 'Galway',
    lonLat: [-9.0568, 53.2707] as [number, number],
  },
];

describe('Irish Cassini MBS factory', () => {
  for (const { name, lonLat } of samples) {
    it(`${name} labels as an i-prefixed cell`, () => {
      const grid = createIrishCassiniGridSystem();
      const [x, y] = transform(lonLat, 'EPSG:4326', IRISH_CASSINI_CRS);
      const formatted = grid.formatCoordinate([x!, y!], IRISH_CASSINI_CRS);
      if (!('combined' in formatted))
        throw new Error('expected combined label');
      expect(formatted.combined).toMatch(/^i[A-Z] \d{3} \d{3}$/);
    });
  }

  it('rejects a point well outside Ireland', () => {
    const grid = createIrishCassiniGridSystem();
    // Deep Atlantic, beyond the 1-square Irish coverage.
    expect(
      grid.isValidCoordinate!([-2_000_000, -2_000_000], IRISH_CASSINI_CRS),
    ).toBe(false);
  });

  it('reproduces the worked reference on GSGS 3982 Ireland Sheet 3 Dublin', () => {
    // That sheet (2nd ed. 2.1942) works an example in its margin: POINT
    // BALLIVOR, LETTERS I(N), REFERENCE I(N) 6954, and spells out "Full
    // Co-ordinates of BALLIVOR 269254" — 269 km E, 254 km N, unit metre.
    // Ballivor, Co. Meath sits at about 6°57'W, 53°32'N.
    //
    // This pins the false northing, which has been questioned: a proposed
    // y_0 = 425 661 would put Ballivor at 429.8 km N, so the sheet would have
    // printed 269430. The same sheet's west margin agrees with 250 000 — it
    // labels a 300 km northing line just below the 54° parallel, where this
    // definition puts 305.6 km.
    createIrishCassiniGridSystem();
    const [x, y] = transform([-6.95, 53.533], 'EPSG:4326', IRISH_CASSINI_CRS);
    expect(x ?? 0).toBeGreaterThan(269_000);
    expect(x ?? 0).toBeLessThan(270_000);
    expect(y ?? 0).toBeGreaterThan(253_500);
    expect(y ?? 0).toBeLessThan(255_000);
  });

  it('matches the printed margin of GSGS 4136 Ireland One Inch sheet 307', () => {
    // A second, independent series. Sheet 307 (3rd ed., bog overprint 1945)
    // prints its NW corner as W. Lon 7°59' / Lat 55°1', and its west margin
    // carries a full coordinate there: "420,000 m.N.", set just above that
    // latitude tick. This definition puts the corner at 418.8 km N, so the
    // 420 000 line falls 1.2 km above it, as drawn.
    //
    // Note the typography, which is what makes these sheets easy to misread:
    // the label is a small "4" followed by a large "20", and the sheet's own
    // instructions say "Pay no attention to the smaller coordinate figures …
    // PAY ATTENTION TO LARGER MARGINAL FIGURES". Anchor a ladder fit on the
    // large figures alone and the absolute northing is wrong while the easting
    // still matches perfectly.
    createIrishCassiniGridSystem();
    const [x, y] = transform(
      [-(7 + 59 / 60), 55 + 1 / 60],
      'EPSG:4326',
      IRISH_CASSINI_CRS,
    );
    expect(x ?? 0).toBeCloseTo(201_100, -3);
    expect(y ?? 0).toBeGreaterThan(418_000);
    expect(y ?? 0).toBeLessThan(420_000);
  });

  it('puts its 500 km northing line across the top of Ireland', () => {
    // The War Office's 1948 grid-systems diagram draws the Irish Grid's 500 km
    // northing across northern Ireland; this definition puts it at 55.75°N,
    // just off the north coast. y_0 = 425 661 would drop it to 54.17°N, through
    // the middle of the island, contradicting the diagram as well as the sheet.
    createIrishCassiniGridSystem();
    const [, y] = transform([-8, 55.75], 'EPSG:4326', IRISH_CASSINI_CRS);
    expect(y ?? 0).toBeGreaterThan(499_000);
    expect(y ?? 0).toBeLessThan(501_000);
  });
});
