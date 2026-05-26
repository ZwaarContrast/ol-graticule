import type { LatLon } from '../dhg/types.js';

export type { LatLon };

/**
 * Großtrapez identity. A 2°30' lon × 1°40' lat tile in a lattice stepping by
 * 2°30' lon / 1°40' lat from the anchor at (0°40'N, 0°E). Synthetic identifier
 * used to disambiguate the `AA..ZZ` repeat-period in geographic HMN text.
 */
export interface Grosstrapez {
  /** Column index from 0°E. 0 = first Großtrapez east of 0°E, −1 = first west, etc. */
  gx: number;
  /** Row index from 0°40'N anchor. 0 = first Großtrapez whose south edge is the anchor. */
  gy: number;
}

/** Letter for the Arbeitstrapez (2×2 subdivision of a Meldetrapez). */
export type Arbeitstrapez = 'a' | 'b' | 'c' | 'd';

/**
 * Decoded geographic HMN reference: canonical text, the (lat, lon) of the
 * cell centre, the geographic bounding box, and the synthetic Großtrapez.
 */
export interface DecodedHmnGeoRef {
  /** Canonical whitespace-normalised text, e.g. `"TD 5b 24"`. */
  canonical: string;
  /** Kleintrapez letter pair, e.g. `"TD"`. */
  kleintrapez: string;
  /** Meldetrapez digit (1..9), present at depth ≥ 3. */
  meldetrapez?: number;
  /** Arbeitstrapez letter (a..d), present at depth ≥ 4. */
  arbeitstrapez?: Arbeitstrapez;
  /** Tenths offset from the Arbeitstrapez SW corner: `[east, north]`, each 0..9. Present at depth 5. */
  tenths?: [number, number];
  /** Synthetic Großtrapez identifier needed because `AA..ZZ` repeats every Großtrapez. */
  grosstrapez: Grosstrapez;
  /** Depth resolved: 2 (Kleintrapez) … 5 (with tenths). */
  depth: 2 | 3 | 4 | 5;
  /** Geographic bounding box of the resolved cell: `[minLon, minLat, maxLon, maxLat]`. */
  bbox: [number, number, number, number];
  /** Geographic centre of the resolved cell: `[lat, lon]`. */
  center: LatLon;
  /**
   * Caller-supplied sheet number used to disambiguate the Großtrapez repeat.
   * The library does not parse or validate this; it is round-tripped verbatim.
   */
  sheetNumber?: string;
}

export interface HmnGeoEncodeOptions {
  /**
   * Maximum depth to encode.
   *
   *  - `2`: Kleintrapez only (`"TD"`)
   *  - `3`: + Meldetrapez (`"TD 5"`)
   *  - `4`: + Arbeitstrapez (`"TD 5b"`)
   *  - `5`: + tenths (`"TD 5b 24"`)
   *
   * Default: `5`.
   */
  depth?: 2 | 3 | 4 | 5;
  /** Whitespace between groups. Default: a single space. Pass `''` for compact. */
  separator?: string;
}
