/**
 * Parse a geographic HMN reference (e.g. `"TD 5b 24"`) back to a bounding
 * box, centre, and Großtrapez. Because `AA..ZZ` repeats every Großtrapez,
 * the caller must supply either an explicit `grosstrapez` or a `near` location.
 */

import {
  ANCHOR_LAT_SEC,
  ANCHOR_LON_SEC,
  ARBEITSTRAPEZ_LAT_SEC,
  ARBEITSTRAPEZ_LON_SEC,
  ARCSEC_PER_DEG,
  GROSSTRAPEZ_LAT_SEC,
  GROSSTRAPEZ_LON_SEC,
  KLEINTRAPEZ_LAT_SEC,
  KLEINTRAPEZ_LON_SEC,
  MELDETRAPEZ_LAT_SEC,
  MELDETRAPEZ_LON_SEC,
  TENTH_LAT_SEC,
  TENTH_LON_SEC,
} from './levels.js';
import { canonicalizeHmnLabel, parseHmnTokens } from '../heeresmeldenetz/canonical.js';
import type {
  DecodedHmnGeoRef,
  Grosstrapez,
  LatLon,
} from './types.js';

export interface ParseHmnGeoOptions {
  /** Explicit Großtrapez for disambiguation. Mutually exclusive with `near`. */
  grosstrapez?: Grosstrapez;
  /**
   * Location near the target. The library picks the Großtrapez containing
   * `near`. Mutually exclusive with `grosstrapez`.
   */
  near?: LatLon;
  /** Caller-supplied sheet number, round-tripped onto the result. */
  sheetNumber?: string;
}

/** Parse a geographic HMN reference. Returns `undefined` if invalid. */
export function parseHmnGeo(
  text: string,
  options: ParseHmnGeoOptions,
): DecodedHmnGeoRef | undefined {
  const tokens = parseHmnTokens(text);
  if (!tokens) return undefined;
  const { col, row, kx, ky, meldetrapez, arbeitstrapez, tenths, depth } = tokens;

  const grosstrapez = options.grosstrapez ?? grosstrapezFor(options.near);
  if (!grosstrapez) return undefined;

  const grossNwLonSec = ANCHOR_LON_SEC + grosstrapez.gx * GROSSTRAPEZ_LON_SEC;
  const grossNwLatSec = ANCHOR_LAT_SEC + (grosstrapez.gy + 1) * GROSSTRAPEZ_LAT_SEC;
  const kleinNwLonSec = grossNwLonSec + kx * KLEINTRAPEZ_LON_SEC;
  const kleinNwLatSec = grossNwLatSec - ky * KLEINTRAPEZ_LAT_SEC;

  let cellNwLonSec = kleinNwLonSec;
  let cellNwLatSec = kleinNwLatSec;
  let cellSizeLonSec = KLEINTRAPEZ_LON_SEC;
  let cellSizeLatSec = KLEINTRAPEZ_LAT_SEC;

  if (meldetrapez !== undefined) {
    const mx = (meldetrapez - 1) % 3;
    const my = Math.floor((meldetrapez - 1) / 3);
    cellNwLonSec = kleinNwLonSec + mx * MELDETRAPEZ_LON_SEC;
    cellNwLatSec = kleinNwLatSec - my * MELDETRAPEZ_LAT_SEC;
    cellSizeLonSec = MELDETRAPEZ_LON_SEC;
    cellSizeLatSec = MELDETRAPEZ_LAT_SEC;
  }
  if (arbeitstrapez !== undefined) {
    const idx = 'abcd'.indexOf(arbeitstrapez);
    const ax = idx % 2;
    const ay = Math.floor(idx / 2);
    cellNwLonSec += ax * ARBEITSTRAPEZ_LON_SEC;
    cellNwLatSec -= ay * ARBEITSTRAPEZ_LAT_SEC;
    cellSizeLonSec = ARBEITSTRAPEZ_LON_SEC;
    cellSizeLatSec = ARBEITSTRAPEZ_LAT_SEC;
  }
  if (tenths !== undefined) {
    const cellSwLatSec = cellNwLatSec - cellSizeLatSec;
    cellNwLonSec += tenths[0] * TENTH_LON_SEC;
    cellNwLatSec = cellSwLatSec + (tenths[1] + 1) * TENTH_LAT_SEC;
    cellSizeLonSec = TENTH_LON_SEC;
    cellSizeLatSec = TENTH_LAT_SEC;
  }

  const minLon = cellNwLonSec / ARCSEC_PER_DEG;
  const maxLat = cellNwLatSec / ARCSEC_PER_DEG;
  const maxLon = (cellNwLonSec + cellSizeLonSec) / ARCSEC_PER_DEG;
  const minLat = (cellNwLatSec - cellSizeLatSec) / ARCSEC_PER_DEG;
  const centerLon = (cellNwLonSec + cellSizeLonSec / 2) / ARCSEC_PER_DEG;
  const centerLat = (cellNwLatSec - cellSizeLatSec / 2) / ARCSEC_PER_DEG;

  const klein = col + row;
  const canonical = canonicalizeHmnLabel(klein, meldetrapez, arbeitstrapez, tenths);

  const ref: DecodedHmnGeoRef = {
    canonical,
    kleintrapez: klein,
    grosstrapez,
    depth,
    bbox: [minLon, minLat, maxLon, maxLat],
    center: [centerLat, centerLon],
  };
  if (meldetrapez !== undefined) ref.meldetrapez = meldetrapez;
  if (arbeitstrapez !== undefined) ref.arbeitstrapez = arbeitstrapez;
  if (tenths !== undefined) ref.tenths = tenths;
  if (options.sheetNumber !== undefined) ref.sheetNumber = options.sheetNumber;
  return ref;
}

function grosstrapezFor(near: LatLon | undefined): Grosstrapez | undefined {
  if (!near) return undefined;
  const lonSec = near[1] * ARCSEC_PER_DEG;
  const latSec = near[0] * ARCSEC_PER_DEG;
  const gx = Math.floor((lonSec - ANCHOR_LON_SEC) / GROSSTRAPEZ_LON_SEC);
  const gy = Math.floor((latSec - ANCHOR_LAT_SEC) / GROSSTRAPEZ_LAT_SEC);
  return { gx, gy };
}
