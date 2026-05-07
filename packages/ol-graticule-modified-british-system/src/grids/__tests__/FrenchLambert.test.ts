import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import {
  createFrenchLambert1GridSystem,
  createFrenchLambert2GridSystem,
  createFrenchLambert3GridSystem,
  FRENCH_LAMBERT_1_CRS,
  FRENCH_LAMBERT_2_CRS,
  FRENCH_LAMBERT_3_CRS,
} from '../FrenchLambert';

/**
 * Ground-truth samples from Thierry Arsicaud's translator
 * (https://www.echodelta.net/mbs/eng-translator.php), verified by the
 * origin-derivation script. Each sample is a point in the zone's Lambert
 * metres → the MBS label Thierry assigns.
 */
const samples = [
  {
    name: 'Lambert I — vS 000 000 (SW corner of vS cell)',
    create: createFrenchLambert1GridSystem,
    crs: FRENCH_LAMBERT_1_CRS,
    lambert: [200_000, 100_000] as [number, number],
    expected: 'vS 000 000',
  },
  {
    name: 'Lambert II — vS 000 000',
    create: createFrenchLambert2GridSystem,
    crs: FRENCH_LAMBERT_2_CRS,
    lambert: [200_000, 100_000] as [number, number],
    expected: 'vS 000 000',
  },
  {
    name: 'Lambert III — aT 000 000 (in the northmost first-letter row)',
    create: createFrenchLambert3GridSystem,
    crs: FRENCH_LAMBERT_3_CRS,
    lambert: [300_000, 100_000] as [number, number],
    expected: 'aT 000 000',
  },
];

describe('French Lambert MBS factories', () => {
  for (const { name, create, crs, lambert, expected } of samples) {
    it(`${name}`, () => {
      const grid = create();
      const formatted = grid.formatCoordinate(lambert, crs);
      if (!('combined' in formatted)) throw new Error('expected combined label');
      expect(formatted.combined).toBe(expected);
    });
  }

  /**
   * Primary-source projection checks. EPSG:27561/27562/27563 are the
   * registered IGN NTF (Paris) Lambert Nord/Centre/Sud zones — our proj4
   * strings ARE the EPSG canonical spec. Reference:
   * https://epsg.io/27561 / 27562 / 27563.
   *
   * Each test projects a real point in the zone through our factory's
   * proj4 AND through the canonical EPSG proj4 from epsg.io; the two
   * should agree to sub-metre precision.
   */
  for (const zone of [
    {
      name: 'Lambert I (Nord)',
      create: createFrenchLambert1GridSystem,
      crs: FRENCH_LAMBERT_1_CRS,
      canonical:
        '+proj=lcc +lat_1=49.5 +lat_0=49.5 +lon_0=0 +k_0=0.999877341 +x_0=600000 +y_0=200000 ' +
        '+ellps=clrk80ign +pm=paris +towgs84=-168,-60,320,0,0,0,0 +units=m +no_defs',
      probe: [2.3372, 48.8566] as [number, number], // Paris (Notre-Dame)
    },
    {
      name: 'Lambert II (Centre)',
      create: createFrenchLambert2GridSystem,
      crs: FRENCH_LAMBERT_2_CRS,
      canonical:
        '+proj=lcc +lat_1=46.8 +lat_0=46.8 +lon_0=0 +k_0=0.99987742 +x_0=600000 +y_0=200000 ' +
        '+ellps=clrk80ign +pm=paris +towgs84=-168,-60,320,0,0,0,0 +units=m +no_defs',
      probe: [3.0573, 45.7797] as [number, number], // Clermont-Ferrand
    },
    {
      name: 'Lambert III (Sud)',
      create: createFrenchLambert3GridSystem,
      crs: FRENCH_LAMBERT_3_CRS,
      canonical:
        '+proj=lcc +lat_1=44.1 +lat_0=44.1 +lon_0=0 +k_0=0.999877499 +x_0=600000 +y_0=200000 ' +
        '+ellps=clrk80ign +pm=paris +towgs84=-168,-60,320,0,0,0,0 +units=m +no_defs',
      probe: [5.3698, 43.2965] as [number, number], // Marseille
    },
  ] as const) {
    it(`${zone.name} matches the EPSG canonical proj4 within 1 m`, () => {
      zone.create();
      const [ours_x, ours_y] = proj4('EPSG:4326', zone.crs).forward(zone.probe);
      const [epsg_x, epsg_y] = proj4('EPSG:4326', zone.canonical).forward(zone.probe);
      // The k_0 values differ by ~1 × 10⁻⁹ between our IGN-authoritative
      // value (0.999877340) and EPSG's printed value — this produces sub-mm
      // residual; allow 1 m headroom for any pm/digit-precision noise.
      expect(Math.abs(ours_x - epsg_x)).toBeLessThan(1);
      expect(Math.abs(ours_y - epsg_y)).toBeLessThan(1);
    });
  }

  it('Lambert II — Lyon gets labelled as wX (first letter `w`, not `v`)', () => {
    // Lyon sits east of Paris meridian, in the second 500 km column → first
    // letter W. Sanity-check that the factory's CRS registration is live
    // and the formatter sees the expected Lambert easting.
    const grid = createFrenchLambert2GridSystem();
    // Lyon ≈ 834 km E, 89 km N in Lambert II.
    const formatted = grid.formatCoordinate([834_000, 89_000], FRENCH_LAMBERT_2_CRS);
    if (!('combined' in formatted)) throw new Error('expected combined label');
    expect(formatted.combined).toMatch(/^w[A-Z] \d{3} \d{3}$/);
  });
});
