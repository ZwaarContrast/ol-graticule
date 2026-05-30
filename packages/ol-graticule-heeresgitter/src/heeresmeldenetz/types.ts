import type { Extent } from 'ol/extent';
import type { LatLon } from '@zwaarcontrast/ol-graticule';

import type { DatumShift } from '../dhg/types.js';

export type { LatLon };

/**
 * Großquadrat identity. A 150 km × 150 km tile inside a single DHG strip,
 * anchored to (CM, integer × 150 km Northing from the equator). Synthetic
 * identifier used to disambiguate the `AA..ZZ` repeat-period in HMN text.
 */
export interface Grossquadrat {
  /** DHG zone Kennziffer (1..60). */
  kennziffer: number;
  /** Column index from CM. 0 = first Großquadrat east of CM, −1 = first west, etc. */
  gx: number;
  /** Row index from the equator (Northing 0..150 km → row 0). */
  gy: number;
}

/** Letter for the Arbeitstrapez (2×2 subdivision of a Meldetrapez). */
export type Arbeitstrapez = 'a' | 'b' | 'c' | 'd';

/**
 * Decoded HMN reference: the canonical text, the (lat, lon) of the cell
 * centre, the geographic bounding box of the cell, and the synthetic
 * Großquadrat tile.
 */
export interface DecodedHmnRef {
  /** Canonical whitespace-normalised text, e.g. `"PE 1b 52"`. */
  canonical: string;
  /** Kleinquadrat letter pair, e.g. `"PE"`. */
  kleinquadrat: string;
  /** Meldetrapez digit (1..9), present at depth ≥ 3. */
  meldetrapez?: number;
  /** Arbeitstrapez letter (a..d), present at depth ≥ 4. */
  arbeitstrapez?: Arbeitstrapez;
  /** Tenths offset from the Arbeitstrapez SW corner: `[east, north]`, each 0..9. Present at depth 5. */
  tenths?: [number, number];
  /** Synthetic Großquadrat identifier needed because `AA..ZZ` repeats every 150 km. */
  grossquadrat: Grossquadrat;
  /** Depth resolved: 2 (Kleinquadrat) … 5 (with tenths). */
  depth: 2 | 3 | 4 | 5;
  /** Geographic bounding box of the resolved cell: `[minLon, minLat, maxLon, maxLat]`. */
  bbox: Extent;
  /** Geographic centre of the resolved cell: `[lat, lon]`. */
  center: LatLon;
  /**
   * Caller-supplied sheet number used to disambiguate the Großquadrat repeat.
   * The library does not parse or validate this; it is round-tripped verbatim.
   */
  sheetNumber?: string;
}

export interface HmnEncodeOptions {
  /**
   * Maximum depth to encode.
   *
   *  - `2`: Kleinquadrat only (`"PE"`)
   *  - `3`: + Meldetrapez (`"PE 1"`)
   *  - `4`: + Arbeitstrapez (`"PE 1b"`)
   *  - `5`: + tenths (`"PE 1b 52"`)
   *
   * Default: `5`.
   */
  depth?: 2 | 3 | 4 | 5;
  /** Pin the result to a specific DHG zone (defaults to nearest CM). */
  kennziffer?: number;
  /** Whitespace between groups. Default: a single space. Pass `''` for compact. */
  separator?: string;
  /** Override the WGS 84 to Bessel Potsdam datum shift. Defaults to the active shift. */
  datumShift?: DatumShift;
}
