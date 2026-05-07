import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import { transform } from 'ol/proj';
import {
  createBritishCassiniGridSystem,
  BRITISH_CASSINI_CRS,
} from '../BritishCassini';

/**
 * Ground truth: a handful of British cities cross-referenced against
 * Thierry Arsicaud's translator. Each entry is a real location, the MBS
 * first letter Thierry assigns, and the expected second-letter pattern.
 */
const samples = [
  {
    name: 'Delamere Forest (grid origin vicinity)',
    lonLat: [-2.68432278, 53.2214650] as [number, number],
    // Delamere sits near the false origin (500 km E, 100 km N) inside cell vE.
    expected: /^v[A-Z] \d{3} \d{3}$/,
  },
  {
    name: 'London',
    lonLat: [-0.1276, 51.5074] as [number, number],
    // London is in the SE, in the 'v' or 'w' first-letter square.
    expected: /^[vw][A-Z] \d{3} \d{3}$/,
  },
  {
    name: 'Edinburgh',
    lonLat: [-3.1883, 55.9533] as [number, number],
    // Edinburgh is north of Delamere, should land in the 'q' first-letter row.
    expected: /^q[A-Z] \d{3} \d{3}$/,
  },
];

describe('British Cassini MBS factory', () => {
  for (const { name, lonLat, expected } of samples) {
    it(`${name} labels as an MBS cell`, () => {
      const grid = createBritishCassiniGridSystem();
      const [x, y] = transform(lonLat, 'EPSG:4326', BRITISH_CASSINI_CRS);
      const formatted = grid.formatCoordinate([x!, y!], BRITISH_CASSINI_CRS);
      if (!('combined' in formatted)) throw new Error('expected combined label');
      expect(formatted.combined).toMatch(expected);
    });
  }

  it('reports offshore coordinates as invalid', () => {
    const grid = createBritishCassiniGridSystem();
    // Mid-Atlantic, well outside the bbox AOI.
    expect(grid.isValidCoordinate!([-500_000, -500_000], BRITISH_CASSINI_CRS)).toBe(false);
  });

  /**
   * Primary-source projection anchors from Roger Hellyer, "198 years and
   * 153 meridians, 152 defunct", *Sheetlines* (Charles Close Society),
   * https://ccs-web.s3.eu-west-2.amazonaws.com/153Meridians.pdf.
   *
   * Hellyer publishes explicit sheet-corner values **in feet east/north
   * of Delamere** for several named OS sheets. Each anchor below is one
   * such corner, converted from feet → factory-CRS metres via:
   *
   *   factoryX = 500 000 + e_ft × 0.3048      (Cassini-Delamere x_0 = +500 km)
   *   factoryY = 100 000 + n_ft × 0.3048      (Cassini-Delamere y_0 = +100 km)
   *
   * The corresponding lat/lon is the inverse-Cassini-Delamere of (e_ft,
   * n_ft) on the Airy 1830 ellipsoid, computed once and pinned here.
   * Projecting that lat/lon through the factory must reproduce Hellyer's
   * tabulated corner to the metre — this catches any drift in the proj4
   * string (origin lat/lon, ellipsoid, false offsets, units).
   *
   * If a future change to {@link BRITISH_CASSINI_PROJ4} silently shifts
   * the projection (e.g. swapping Airy 1830 for OSGB36's WGS84-aligned
   * ellipsoid), every anchor below will fail.
   */
  const AIRY_LL = '+proj=longlat +ellps=airy +no_defs';

  describe('reproduces Hellyer sheet-corner Delamere ft values (Sheetlines, "153 Meridians")', () => {
    const anchors: Array<{
      sheet: string;
      corner: 'NW' | 'NE' | 'SW' | 'SE';
      lat: number;
      lon: number;
      expectedX: number;
      expectedY: number;
    }> = [
      // OS Popular Edition E&W Sheet 44 — Northwich & Macclesfield (1923).
      // https://maps.nls.uk/view/239259997
      // Hellyer feet:   W: -3 690   E: +138 870   N: +48 940   S: -46 100
      {
        sheet: 'Pop. Ed. 44 (Macclesfield)', corner: 'NW',
        lat: 53.355510, lon: -2.701216,
        expectedX: 500_000 + (-3_690 * 0.3048), expectedY: 100_000 + ( 48_940 * 0.3048),
      },
      {
        sheet: 'Pop. Ed. 44 (Macclesfield)', corner: 'NE',
        lat: 53.353818, lon: -2.048580,
        expectedX: 500_000 + (138_870 * 0.3048), expectedY: 100_000 + ( 48_940 * 0.3048),
      },
      {
        sheet: 'Pop. Ed. 44 (Macclesfield)', corner: 'SW',
        lat: 53.095193, lon: -2.701114,
        expectedX: 500_000 + (-3_690 * 0.3048), expectedY: 100_000 + (-46_100 * 0.3048),
      },
      {
        sheet: 'Pop. Ed. 44 (Macclesfield)', corner: 'SE',
        lat: 53.093517, lon: -2.052423,
        expectedX: 500_000 + (138_870 * 0.3048), expectedY: 100_000 + (-46_100 * 0.3048),
      },
    ];

    for (const a of anchors) {
      it(`${a.sheet} ${a.corner} — Hellyer Delamere ft → factory metres`, () => {
        // Side-effect: register the CRS with proj4/OL.
        createBritishCassiniGridSystem();
        const [x, y] = proj4(AIRY_LL, BRITISH_CASSINI_CRS).forward([a.lon, a.lat]);
        expect(Math.abs(x - a.expectedX)).toBeLessThan(1); // 1 m tolerance
        expect(Math.abs(y - a.expectedY)).toBeLessThan(1);
      });
    }
  });

  /**
   * Independent primary-source check that the FACTORY's projection of
   * a known latitude lands at the same Delamere N where the PRINTED
   * face of Pop. Ed. Sheet 44 (1923) draws that latitude.
   *
   * NOTE — these rows (A, D, G) are NOT cells the factory emits. The
   * factory's cell scheme is the MBS 100 km lattice ("vE", "wQ", ...).
   * The rows A-J belong to the **on-face 2-mile lettered grid** that
   * the OS overprinted on Pop. Ed. Sheet 44 (and on every Pop. Ed.
   * Scotland sheet, plus E&W sheets 35-47). They share the underlying
   * Cassini-Delamere projection — that's why we can use them as
   * primary-source anchors for the projection itself.
   *
   * How the test works:
   *
   * 1. The printed sheet's LEFT EDGE labels a parallel `Lat. nn°mm'`
   *    at the exact pixel where each round-arcminute parallel meets
   *    the edge. Adjacent to each label is the row letter (A, D, G
   *    here) of the 2-mile grid that contains that intersection.
   * 2. Hellyer's "153 Meridians" anchors the 2-mile grid: Sheet 44 N
   *    edge is at Delamere N = +48 940 ft, rows go south at 10 560 ft
   *    per row, lettered A B C D E F G H J (I omitted).
   * 3. Combining (1)+(2): each labelled parallel must project, through
   *    the factory's Cassini-Delamere proj4 string, to a Delamere N
   *    inside the printed row's N-range.
   *
   * If the factory's lat_0 or ellipsoid drifts (e.g. swap Airy 1830
   * for OSGB36's WGS84-aligned), the projected N for `lat 53°20'`
   * shifts and lands in row B or row C instead of row A — test fails.
   *
   * Anchors below were read off the 1300×4400 px left-edge IIIF crop
   * (folder 23925, id 239259997).
   */
  describe("factory's projection of printed Sheet 44 parallel labels lands in the correct printed row", () => {
    // Sheet 44 row N-edges in factory metres (top→bottom). Hellyer values.
    const rowYBoundsM = [48940, 38380, 27820, 17260, 6700, -3860, -14420, -24980, -35540, -46100]
      .map(ft => 100_000 + ft * 0.3048);
    const rowLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'];
    const rowYRange = (letter: string) => {
      const i = rowLetters.indexOf(letter);
      // Higher index = further south = lower factory_y. rowYBoundsM is monotone-decreasing.
      return [rowYBoundsM[i + 1]!, rowYBoundsM[i]!] as const;
    };

    // Label positions read off the printed left edge of Sheet 44.
    const parallels: Array<{ latDeg: number; latMin: number; expectedRow: string }> = [
      { latDeg: 53, latMin: 20, expectedRow: 'A' }, // "Lat. 53°20'" annotated alongside row A
      { latDeg: 53, latMin: 15, expectedRow: 'D' }, // "15'" annotated alongside row D
      { latDeg: 53, latMin: 10, expectedRow: 'G' }, // "Lat. 53°10'" annotated alongside row G
    ];

    for (const { latDeg, latMin, expectedRow } of parallels) {
      it(`Lat. ${latDeg}°${latMin}' projects into Sheet 44 printed row ${expectedRow}`, () => {
        createBritishCassiniGridSystem();
        // Take a longitude on the sheet's western edge. The exact lon doesn't
        // matter for Cassini N (sub-foot variation across the sheet width);
        // pick any lon inside Sheet 44.
        const lon = -2.5; // somewhere in central Cheshire
        const lat = latDeg + latMin / 60;
        const [, y] = proj4(AIRY_LL, BRITISH_CASSINI_CRS).forward([lon, lat]);
        const [yLo, yHi] = rowYRange(expectedRow);
        expect(y).toBeGreaterThan(yLo);
        expect(y).toBeLessThan(yHi);
      });
    }
  });
});
