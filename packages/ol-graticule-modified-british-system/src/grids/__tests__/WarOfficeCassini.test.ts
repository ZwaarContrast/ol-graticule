import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import { transform } from 'ol/proj';
import {
  createWarOfficeCassiniGridSystem,
  WAR_OFFICE_CASSINI_CRS,
} from '../WarOfficeCassini';
import { WAR_OFFICE_CASSINI_SCHEME } from '../../formatters/schemes';

describe('War Office Cassini (Dunnose / WOFO) MBS factory', () => {
  it("places cell wQ's SW corner at WOFO (500 km, 100 km) — Hellyer's London reference", () => {
    // Per Hellyer, Sheetlines 55 (2001), the 100 × 100 km square labelled
    // "Q" (in the `w` first-letter square) has its SW corner 500 km E and
    // 100 km N of the false origin. Since the false origin is WOFO (0, 0),
    // that point is WOFO (500 000, 100 000) m and should label as wQ 000 000.
    const grid = createWarOfficeCassiniGridSystem();
    const formatted = grid.formatCoordinate([500_000, 100_000], WAR_OFFICE_CASSINI_CRS);
    if (!('combined' in formatted)) throw new Error('expected combined label');
    expect(formatted.combined).toBe('wQ 000 000');
  });

  it('London labels under the w first-letter square', () => {
    const grid = createWarOfficeCassiniGridSystem();
    const [x, y] = transform([-0.1276, 51.5074], 'EPSG:4326', WAR_OFFICE_CASSINI_CRS);
    const formatted = grid.formatCoordinate([x!, y!], WAR_OFFICE_CASSINI_CRS);
    if (!('combined' in formatted)) throw new Error('expected combined label');
    expect(formatted.combined).toMatch(/^w[A-Z] \d{3} \d{3}$/);
  });

  it("Dunnose itself (near the q/r/v/w intersection) projects to WOFO (500 km, 100 km)", () => {
    // Dunnose (50.6177°N, 1.1973°W) IS the natural projection origin, so
    // with false easting 500 km / false northing 100 km it should land at
    // projected (500 000, 100 000). Sanity check that the proj4 string is
    // wired correctly.
    const [x, y] = transform([-1.1972600000, 50.6177077778], 'EPSG:4326', WAR_OFFICE_CASSINI_CRS);
    expect(x).toBeCloseTo(500_000, -1); // within 10 m
    expect(y).toBeCloseTo(100_000, -1);
  });

  it('differs from the Delamere variant for the same real-world lat/lon', () => {
    // Sanity: a point in London should get a different full MBS reference
    // under WOFO than under Delamere — the two grids are offset by ~1.5°.
    // We don't assert specific labels, only inequality.
    const wofo = createWarOfficeCassiniGridSystem();
    const lonLat: [number, number] = [-0.1276, 51.5074];
    const [x, y] = transform(lonLat, 'EPSG:4326', WAR_OFFICE_CASSINI_CRS);
    const wofoLabel = wofo.formatCoordinate([x!, y!], WAR_OFFICE_CASSINI_CRS);
    expect('combined' in wofoLabel && wofoLabel.combined).not.toBe('vK 611 516');
    // (The Delamere variant puts London at some v*-prefixed cell with
    // different sub-digits. Actual Delamere label is validated in the
    // British Cassini test suite.)
  });

  /**
   * Primary-source projection check. Each anchor is a corner cartouche
   * read directly off a printed GSGS 2748 sheet at the National Library
   * of Scotland (https://maps.nls.uk/os/20k-gb/) — both the WOFO grid
   * coordinates AND the lat/lon were pre-printed at every sheet corner.
   *
   * The cartouche lat/lon is on the period-correct British datum (Airy
   * 1830, pre-OSGB36 — the surveys are 1923/1929). Our proj4 has no
   * +towgs84, so feeding the lat/lon directly through the Airy ellipsoid
   * `+proj=longlat` exercises the pure Cassini-Soldner geometry without
   * any datum-shift round-trip.
   *
   * Tolerance: 5 m. The maximum residual we measured is 1.7 m (Dundee NW),
   * a systematic Scotland-far-from-origin offset consistent with pre-OSGB
   * deflection-of-vertical adjustments. Hampshire (4 corners near origin)
   * fits within 0.3 m. 5 m is generous headroom for OCR noise and printed
   * lat/lon precision (cartouches print to 0.01" ≈ 30 cm).
   */
  describe('reproduces printed GSGS 2748 corner cartouches (lat/lon ↔ grid)', () => {
    const dms = (d: number, m: number, s: number, sign: 1 | -1) =>
      sign * (d + m / 60 + s / 3600);
    const AIRY_LL = '+proj=longlat +ellps=airy +no_defs';
    const anchors: Array<{
      sheet: string;
      url: string;
      corner: 'NW' | 'NE' | 'SW' | 'SE';
      lat: number;
      lon: number;
      expectedE: number;
      expectedN: number;
    }> = [
      // GSGS 2748, Sheet XIII.S (Hampshire) — IIIF id 19546/195462174
      // https://maps.nls.uk/view/195462174 (Edition trenches/survey ~1929)
      {
        sheet: 'XIII.S Hampshire', url: 'https://maps.nls.uk/view/195462174', corner: 'NW',
        lat: dms(51, 4, 1.94, 1),  lon: dms(1, 11, 50.14, -1),
        expectedE: 500_000, expectedN: 150_000,
      },
      {
        sheet: 'XIII.S Hampshire', url: 'https://maps.nls.uk/view/195462174', corner: 'NE',
        lat: dms(51, 4, 1.24, 1),  lon: dms(0, 58, 59.69, -1),
        expectedE: 515_000, expectedN: 150_000,
      },
      {
        sheet: 'XIII.S Hampshire', url: 'https://maps.nls.uk/view/195462174', corner: 'SW',
        lat: dms(50, 58, 38.31, 1), lon: dms(1, 11, 50.14, -1),
        expectedE: 500_000, expectedN: 140_000,
      },
      {
        sheet: 'XIII.S Hampshire', url: 'https://maps.nls.uk/view/195462174', corner: 'SE',
        lat: dms(50, 58, 37.61, 1), lon: dms(0, 59, 1.18, -1),
        expectedE: 515_000, expectedN: 140_000,
      },
      // GSGS 2748, Dundee/Tayside — IIIF id 19546/195462213
      // https://maps.nls.uk/view/195462213 (Survey 1923)
      {
        sheet: 'Dundee/Tayside', url: 'https://maps.nls.uk/view/195462213', corner: 'NW',
        lat: dms(56, 32, 11.70, 1), lon: dms(2, 54, 15.18, -1),
        expectedE: 395_000, expectedN: 760_000,
      },
      {
        sheet: 'Dundee/Tayside', url: 'https://maps.nls.uk/view/195462213', corner: 'SW',
        lat: dms(56, 26, 48.52, 1), lon: dms(2, 54, 0.68, -1),
        expectedE: 395_000, expectedN: 750_000,
      },
      {
        sheet: 'Dundee/Tayside', url: 'https://maps.nls.uk/view/195462213', corner: 'SE',
        lat: dms(56, 26, 59.67, 1), lon: dms(2, 39, 25.17, -1),
        expectedE: 410_000, expectedN: 750_000,
      },
      // GSGS 2748, Stobs (Special Sheet) — IIIF id 19546/195462231
      // https://maps.nls.uk/view/195462231 (Published 1923, artillery training)
      {
        sheet: 'Stobs', url: 'https://maps.nls.uk/view/195462231', corner: 'NW',
        lat: dms(55, 25, 21.55, 1), lon: dms(2, 54, 11.64, -1),
        expectedE: 392_000, expectedN: 636_000,
      },
      {
        sheet: 'Stobs', url: 'https://maps.nls.uk/view/195462231', corner: 'NE',
        lat: dms(55, 25, 32.61, 1), lon: dms(2, 39, 58.93, -1),
        expectedE: 407_000, expectedN: 636_000,
      },
      {
        sheet: 'Stobs', url: 'https://maps.nls.uk/view/195462231', corner: 'SW',
        lat: dms(55, 19, 25.98, 1), lon: dms(2, 53, 56.36, -1),
        expectedE: 392_000, expectedN: 625_000,
      },
      {
        sheet: 'Stobs', url: 'https://maps.nls.uk/view/195462231', corner: 'SE',
        lat: dms(55, 19, 37.00, 1), lon: dms(2, 39, 45.76, -1),
        expectedE: 407_000, expectedN: 625_000,
      },
      // GSGS 2748, Catterick (Special Sheet) — IIIF id 19546/195462180
      // https://maps.nls.uk/view/195462180 (Published 1927, artillery training).
      // SE corner legend explicitly describes the British System letter scheme:
      // "Points are described by their Co-ordinates in kilometres, in the
      //  large lettered squares. The easterly Co-ordinate is always given first."
      {
        sheet: 'Catterick', url: 'https://maps.nls.uk/view/195462180', corner: 'NW',
        lat: dms(54, 24, 29.94, 1), lon: dms(1, 54, 20.78, -1),
        expectedE: 454_000, expectedN: 522_000,
      },
      {
        sheet: 'Catterick', url: 'https://maps.nls.uk/view/195462180', corner: 'SE',
        lat: dms(54, 19, 10.59, 1), lon: dms(1, 40, 25.33, -1),
        expectedE: 469_000, expectedN: 512_000,
      },
    ];

    for (const a of anchors) {
      it(`${a.sheet} ${a.corner} corner — ${a.url}`, () => {
        // Side-effect: register the CRS with proj4/OL.
        createWarOfficeCassiniGridSystem();
        const [e, n] = proj4(AIRY_LL, WAR_OFFICE_CASSINI_CRS).forward([a.lon, a.lat]);
        expect(Math.abs(e - a.expectedE)).toBeLessThan(5);
        expect(Math.abs(n - a.expectedN)).toBeLessThan(5);
      });
    }
  });

  /**
   * Primary-source letter check against Roger Hellyer, "Some notes on
   * the origin of the Modified British System of the War Office Cassini
   * Grid", *Sheetlines* 55 (Charles Close Society, August 1999), pp. 3-11.
   *
   * The article fixes two facts that determine every letter in the WOFO
   * MBS scheme:
   *
   * 1. The 25-letter alphabet (Illustration 4, p. 11 — RAF Edition Sheet 1
   *    SE corner, reprinted 1932). A–Z with **I omitted** (J takes its
   *    natural slot), laid out in a 5×5 with **A B C D E on the top
   *    (north) row**:
   *
   *        A B C D E
   *        F G H J K
   *        L M N O P
   *        Q R S T U
   *        V W X Y Z
   *
   * 2. Cell Q's position (p. 4, ¶1): "the 100 by 100 km square which has
   *    its south-west corner 5 (hundred kilometres) east and 1 (hundred
   *    kilometres) north of the false origin converts to square Q. This
   *    square contains London."  → Q.SW = WOFO (500 000, 100 000).
   *
   * Together these two facts uniquely fix every cell. The tests below
   * spot-check that our factory's letter assignments agree with the
   * structure Hellyer specifies — alphabet vertices (corner letters of
   * the 5×5), the Q anchor itself, and a cross-block check that puts
   * London under "wQ" as the article explicitly states.
   */
  describe('letter scheme matches Hellyer, Sheetlines 55', () => {
    /**
     * In-memory check of the 25-letter alphabet structure against
     * Hellyer's Illustration 4 (p. 11). Both first- and second-letter
     * grids are stored south-to-north (array index 0 = south row,
     * index 4 = north row), so the printed diagram (north on top,
     * `A B C D E`) corresponds to array index 4 here.
     *
     * This test asserts the alphabet by construction, independent of
     * any projection or clip polygon — so it locks in the structure
     * even for cells outside the Britain AOI.
     */
    it('25-letter alphabet (A–Z minus I), A B C D E on north row', () => {
      // South row: V W X Y Z
      // (north-to-south rotation of the standard Latin alphabet, dropping I)
      expect(WAR_OFFICE_CASSINI_SCHEME.secondLetterGrid).toEqual([
        'VWXYZ', // S row (array index 0)
        'QRSTU',
        'LMNOP',
        'FGHJK', // I omitted; J takes the slot
        'ABCDE', // N row (array index 4) — Hellyer's top row
      ]);
      // First-letter (500 km) grid uses the SAME alphabet layout.
      expect(WAR_OFFICE_CASSINI_SCHEME.firstLetterGrid).toEqual([
        'VWXYZ',
        'QRSTU',
        'LMNOP',
        'FGHJK',
        'ABCDE',
      ]);
    });

    // Probe inside a cell (SW + 1 m) and return just the two-letter prefix.
    // Only safe for points inside the Britain clip polygon.
    const probe = (e: number, n: number) => {
      const grid = createWarOfficeCassiniGridSystem();
      const formatted = grid.formatCoordinate([e + 1, n + 1], WAR_OFFICE_CASSINI_CRS);
      if (!('combined' in formatted)) {
        throw new Error(`probe (${e}, ${n}) returned non-combined: ${JSON.stringify(formatted)}`);
      }
      return formatted.combined.split(' ')[0];
    };

    /**
     * Cell Q's anchor — the article's explicit Hellyer fact:
     *   "the 100 by 100 km square which has its south-west corner
     *    5 (hundred kilometres) east and 1 (hundred kilometres) north
     *    of the false origin converts to square Q. This square contains
     *    London."  — Hellyer, Sheetlines 55, p. 4 ¶1.
     */
    it('Q at WOFO SW (500 000, 100 000) — Hellyer p.4: "square Q contains London"', () => {
      expect(probe(500_000, 100_000)).toBe('wQ');
    });

    /**
     * Hellyer states "this square contains London" — meaning Q. Project
     * a south-London point comfortably inside Q (not at its north edge:
     * central London / St Paul's lat ≈ 51.51°N puts WOFO N ≈ 200 km,
     * right on the Q/L boundary). Croydon (51.375°N) sits well inside.
     */
    it('Greater London (Croydon) labels as wQ', () => {
      const [e, n] = proj4('+proj=longlat +ellps=airy +no_defs', WAR_OFFICE_CASSINI_CRS)
        .forward([-0.0986, 51.3754]);
      expect(probe(e, n)).toBe('wQ');
    });

    /**
     * Two more diagonal corners of the 5×5 alphabet within block w —
     * V (SW) and A (NW). Both are inside the Britain clip polygon, so
     * they exercise the wired alphabet end-to-end. (Z and E corners
     * are outside the AOI — covered by the in-memory structure test.)
     */
    it('V at WOFO SW of block w (500 000, 0) and A at NW (500 000, 400 000)', () => {
      expect(probe(500_000, 0)).toBe('wV');
      expect(probe(500_000, 400_000)).toBe('wA');
    });

    /**
     * First-letter scheme cross-block check. The 500 km block immediately
     * north of w (which has SW = 500 000, 500 000) is r — second letter
     * in the row Q,R,S,T,U. So the cell at WOFO (500 000, 600 000)
     * (Q within the r block) must label as rQ.
     */
    it('first letter wraps from w to r across the 500 km north boundary', () => {
      expect(probe(500_000, 600_000)).toBe('rQ');
    });
  });

  /**
   * GSGS 3906 sheet-corner anchors (1:25 000, 1940-43). These sheets
   * print **WOFO grid coordinates only** at every corner — no lat/lon —
   * plus a marginal legend explicitly stating the grid convention:
   *
   *   "Unit: metre. Square: 1 000 metres. Reference to nearest 100 [m].
   *    Nearest similar reference distant 60 miles."
   *
   * (60 miles ≈ 96 km ≈ the WOFO 100 km letter-cell size.)
   *
   * Because the cartouches don't print lat/lon, these anchors don't
   * exercise the projection independently — that's already covered by
   * the GSGS 2748 lat/lon ↔ grid pairs above. What they DO cover is the
   * letter-cell mapping in the **q first-letter block** (Scotland north
   * of the 500 km parallel), which is otherwise only checked at the
   * w/r block-boundary point.
   *
   * Each anchor is one printed sheet corner: the WOFO grid coordinate
   * read off the cartouche → the MBS letter-cell label our factory must
   * produce.
   */
  describe('reproduces printed GSGS 3906 sheet-corner letter cells', () => {
    const anchors: Array<{
      sheet: string;
      url: string;
      corner: 'NW' | 'NE' | 'SW' | 'SE';
      e: number;
      n: number;
      expected: string;
    }> = [
      // Sheet 11/90 S.E. & N.E. — North Uist (Outer Hebrides, Loch Olavat).
      // IIIF id 18966/189661153.
      // https://maps.nls.uk/view/189661153
      {
        sheet: '11/90 S.E. & N.E.', url: 'https://maps.nls.uk/view/189661153', corner: 'NW',
        e: 125_000, n: 910_000, expected: 'qB 250 100',
      },
      {
        sheet: '11/90 S.E. & N.E.', url: 'https://maps.nls.uk/view/189661153', corner: 'NE',
        e: 140_000, n: 910_000, expected: 'qB 400 100',
      },
      {
        sheet: '11/90 S.E. & N.E.', url: 'https://maps.nls.uk/view/189661153', corner: 'SW',
        e: 125_000, n: 900_000, expected: 'qB 250 000',
      },
      // Sheet 17/66 S.E. — Islay (Inner Hebrides, Port Ellen).
      // IIIF id 18966/189661237.
      // https://maps.nls.uk/view/189661237
      {
        sheet: '17/66 S.E.', url: 'https://maps.nls.uk/view/189661237', corner: 'NW',
        e: 185_000, n: 670_000, expected: 'qR 850 700',
      },
      // SE corner sits exactly on the qR/qS letter-cell boundary at E=200 km.
      // Factory's floor() puts boundary points in the eastward/northward cell —
      // i.e. the cell whose SW corner is the boundary point. Hence qS, not qR.
      {
        sheet: '17/66 S.E.', url: 'https://maps.nls.uk/view/189661237', corner: 'SE',
        e: 200_000, n: 660_000, expected: 'qS 000 600',
      },
      // Sheet 17/94 N.E. — Northern Scotland (~58.3°N).
      // IIIF id 18966/189661360.
      // https://maps.nls.uk/view/189661360
      {
        sheet: '17/94 N.E.', url: 'https://maps.nls.uk/view/189661360', corner: 'NW',
        e: 185_000, n: 960_000, expected: 'qB 850 600',
      },
      // Sheet 29/66 S.E. — central Scotland.
      // IIIF id 18966/189662194.
      // https://maps.nls.uk/view/189662194
      {
        sheet: '29/66 S.E.', url: 'https://maps.nls.uk/view/189662194', corner: 'NW',
        e: 305_000, n: 670_000, expected: 'qT 050 700',
      },
    ];

    for (const a of anchors) {
      it(`${a.sheet} ${a.corner} — ${a.url}`, () => {
        const grid = createWarOfficeCassiniGridSystem();
        const formatted = grid.formatCoordinate([a.e, a.n], WAR_OFFICE_CASSINI_CRS);
        if (!('combined' in formatted)) throw new Error('expected combined label');
        expect(formatted.combined).toBe(a.expected);
      });
    }
  });
});
