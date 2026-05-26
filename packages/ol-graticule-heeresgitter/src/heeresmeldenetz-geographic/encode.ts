/**
 * Forward encoding: WGS 84 `(lat, lon)` to geographic Heeresmeldenetz reference.
 */

import { ARCSEC_PER_DEG } from './levels.js';
import {
  ANCHOR_LAT_SEC,
  ANCHOR_LON_SEC,
  ARBEITSTRAPEZ_LAT_SEC,
  ARBEITSTRAPEZ_LON_SEC,
  GROSSTRAPEZ_LAT_SEC,
  GROSSTRAPEZ_LON_SEC,
  KLEINTRAPEZ_LAT_SEC,
  KLEINTRAPEZ_LON_SEC,
  MELDETRAPEZ_LAT_SEC,
  MELDETRAPEZ_LON_SEC,
  TENTH_LAT_SEC,
  TENTH_LON_SEC,
} from './levels.js';
import { clampTenth } from '../heeresmeldenetz/canonical.js';
import { letterFromIndex } from '../heeresmeldenetz/letters.js';
import type {
  Arbeitstrapez,
  DecodedHmnGeoRef,
  Grosstrapez,
  HmnGeoEncodeOptions,
  LatLon,
} from './types.js';

const ARBEIT_LABELS: readonly Arbeitstrapez[] = ['a', 'b', 'c', 'd'];

/** Full breakdown of a `(lat, lon)` into the geographic HMN hierarchy. */
interface HmnGeoBreakdown {
  grosstrapez: Grosstrapez;
  kleintrapez: string;
  meldetrapez: number;
  arbeitstrapez: Arbeitstrapez;
  tenths: [number, number];
  /** Arcsecond coordinates (lon east of 0°E, lat north of 0°N), normalised. */
  lonSec: number;
  latSec: number;
  /** NW corner of the Arbeitstrapez, in arcseconds. */
  arbeitNwLonSec: number;
  arbeitNwLatSec: number;
  /** NW corner of the Meldetrapez, in arcseconds. */
  meldeNwLonSec: number;
  meldeNwLatSec: number;
  /** NW corner of the Kleintrapez, in arcseconds. */
  kleinNwLonSec: number;
  kleinNwLatSec: number;
}

/** Decompose a `(lat, lon)` into its geographic HMN cells. */
export function decomposeHmnGeo(point: LatLon): HmnGeoBreakdown {
  const [lat, lon] = point;
  const lonSec = lon * ARCSEC_PER_DEG;
  const latSec = lat * ARCSEC_PER_DEG;

  // The Großtrapez NW corner is its *northern* edge, so `gy + 1` not `gy`.
  const gx = Math.floor((lonSec - ANCHOR_LON_SEC) / GROSSTRAPEZ_LON_SEC);
  const gy = Math.floor((latSec - ANCHOR_LAT_SEC) / GROSSTRAPEZ_LAT_SEC);

  const grossNwLonSec = ANCHOR_LON_SEC + gx * GROSSTRAPEZ_LON_SEC;
  const grossNwLatSec = ANCHOR_LAT_SEC + (gy + 1) * GROSSTRAPEZ_LAT_SEC;

  const kx = Math.floor((lonSec - grossNwLonSec) / KLEINTRAPEZ_LON_SEC);
  const ky = Math.floor((grossNwLatSec - latSec) / KLEINTRAPEZ_LAT_SEC);
  const colLetter = letterFromIndex(kx);
  const rowLetter = letterFromIndex(ky);
  if (colLetter === undefined || rowLetter === undefined) {
    throw new RangeError(
      `Geographic HMN cell out of Großtrapez range: kx=${kx}, ky=${ky}.`,
    );
  }

  const kleinNwLonSec = grossNwLonSec + kx * KLEINTRAPEZ_LON_SEC;
  const kleinNwLatSec = grossNwLatSec - ky * KLEINTRAPEZ_LAT_SEC;

  const mx = Math.floor((lonSec - kleinNwLonSec) / MELDETRAPEZ_LON_SEC);
  const my = Math.floor((kleinNwLatSec - latSec) / MELDETRAPEZ_LAT_SEC);
  const meldetrapez = my * 3 + mx + 1;
  const meldeNwLonSec = kleinNwLonSec + mx * MELDETRAPEZ_LON_SEC;
  const meldeNwLatSec = kleinNwLatSec - my * MELDETRAPEZ_LAT_SEC;

  const ax = Math.floor((lonSec - meldeNwLonSec) / ARBEITSTRAPEZ_LON_SEC);
  const ay = Math.floor((meldeNwLatSec - latSec) / ARBEITSTRAPEZ_LAT_SEC);
  const arbeitstrapez = ARBEIT_LABELS[ay * 2 + ax];
  if (arbeitstrapez === undefined) {
    throw new RangeError(`Geographic HMN Arbeitstrapez index out of range: ax=${ax}, ay=${ay}.`);
  }
  const arbeitNwLonSec = meldeNwLonSec + ax * ARBEITSTRAPEZ_LON_SEC;
  const arbeitNwLatSec = meldeNwLatSec - ay * ARBEITSTRAPEZ_LAT_SEC;

  const arbeitSwLatSec = arbeitNwLatSec - ARBEITSTRAPEZ_LAT_SEC;
  const tenthEast = clampTenth(Math.floor((lonSec - arbeitNwLonSec) / TENTH_LON_SEC));
  const tenthNorth = clampTenth(Math.floor((latSec - arbeitSwLatSec) / TENTH_LAT_SEC));

  return {
    grosstrapez: { gx, gy },
    kleintrapez: `${colLetter}${rowLetter}`,
    meldetrapez,
    arbeitstrapez,
    tenths: [tenthEast, tenthNorth],
    lonSec,
    latSec,
    arbeitNwLonSec,
    arbeitNwLatSec,
    meldeNwLonSec,
    meldeNwLatSec,
    kleinNwLonSec,
    kleinNwLatSec,
  };
}

/** Format a geographic HMN breakdown to canonical text at the requested depth. */
export function formatHmnGeo(
  breakdown: HmnGeoBreakdown,
  options: HmnGeoEncodeOptions = {},
): string {
  const depth = options.depth ?? 5;
  const sep = options.separator ?? ' ';
  let out = breakdown.kleintrapez;
  if (depth <= 2) return out;
  out += sep + String(breakdown.meldetrapez);
  if (depth === 3) return out;
  out += breakdown.arbeitstrapez;
  if (depth === 4) return out;
  const [te, tn] = breakdown.tenths;
  out += sep + String(te) + String(tn);
  return out;
}

/** Full geographic HMN reference resolved into bounding box, centre, and Großtrapez. */
export function encodeHmnGeo(
  point: LatLon,
  options: HmnGeoEncodeOptions = {},
): DecodedHmnGeoRef {
  const breakdown = decomposeHmnGeo(point);
  const depth = options.depth ?? 5;
  const canonical = formatHmnGeo(breakdown, options);

  const { nwLonSec, nwLatSec, sizeLonSec, sizeLatSec } = nwCornerForDepth(breakdown, depth);
  const minLon = nwLonSec / ARCSEC_PER_DEG;
  const maxLat = nwLatSec / ARCSEC_PER_DEG;
  const maxLon = (nwLonSec + sizeLonSec) / ARCSEC_PER_DEG;
  const minLat = (nwLatSec - sizeLatSec) / ARCSEC_PER_DEG;
  const centerLon = (nwLonSec + sizeLonSec / 2) / ARCSEC_PER_DEG;
  const centerLat = (nwLatSec - sizeLatSec / 2) / ARCSEC_PER_DEG;

  const ref: DecodedHmnGeoRef = {
    canonical,
    kleintrapez: breakdown.kleintrapez,
    grosstrapez: breakdown.grosstrapez,
    depth,
    bbox: [minLon, minLat, maxLon, maxLat],
    center: [centerLat, centerLon],
  };
  if (depth >= 3) ref.meldetrapez = breakdown.meldetrapez;
  if (depth >= 4) ref.arbeitstrapez = breakdown.arbeitstrapez;
  if (depth >= 5) ref.tenths = breakdown.tenths;
  return ref;
}

interface CellCorner {
  nwLonSec: number;
  nwLatSec: number;
  sizeLonSec: number;
  sizeLatSec: number;
}

function nwCornerForDepth(b: HmnGeoBreakdown, depth: number): CellCorner {
  if (depth === 2) {
    return {
      nwLonSec: b.kleinNwLonSec,
      nwLatSec: b.kleinNwLatSec,
      sizeLonSec: KLEINTRAPEZ_LON_SEC,
      sizeLatSec: KLEINTRAPEZ_LAT_SEC,
    };
  }
  if (depth === 3) {
    return {
      nwLonSec: b.meldeNwLonSec,
      nwLatSec: b.meldeNwLatSec,
      sizeLonSec: MELDETRAPEZ_LON_SEC,
      sizeLatSec: MELDETRAPEZ_LAT_SEC,
    };
  }
  if (depth === 4) {
    return {
      nwLonSec: b.arbeitNwLonSec,
      nwLatSec: b.arbeitNwLatSec,
      sizeLonSec: ARBEITSTRAPEZ_LON_SEC,
      sizeLatSec: ARBEITSTRAPEZ_LAT_SEC,
    };
  }
  const [te, tn] = b.tenths;
  const arbeitSwLatSec = b.arbeitNwLatSec - ARBEITSTRAPEZ_LAT_SEC;
  const tenthSwLonSec = b.arbeitNwLonSec + te * TENTH_LON_SEC;
  const tenthSwLatSec = arbeitSwLatSec + tn * TENTH_LAT_SEC;
  return {
    nwLonSec: tenthSwLonSec,
    nwLatSec: tenthSwLatSec + TENTH_LAT_SEC,
    sizeLonSec: TENTH_LON_SEC,
    sizeLatSec: TENTH_LAT_SEC,
  };
}

