/**
 * Forward encoding: WGS 84 `(lat, lon)` to Heeresmeldenetz reference.
 */

import { forward, forwardInZone, inverse } from '../dhg/projection.js';
import { FALSE_EASTING } from '../dhg/zones.js';
import type { DatumShift, DhgCoord, LatLon } from '../dhg/types.js';
import { clampTenth } from './canonical.js';
import {
  ARBEITSTRAPEZ_M,
  GROSSQUADRAT_M,
  KLEINQUADRAT_M,
  MELDETRAPEZ_M,
  TENTH_M,
} from './levels.js';
import { letterFromIndex } from './letters.js';
import type {
  Arbeitstrapez,
  DecodedHmnRef,
  Grossquadrat,
  HmnEncodeOptions,
} from './types.js';

const ARBEIT_LABELS: readonly Arbeitstrapez[] = ['a', 'b', 'c', 'd'];

/** Full breakdown of a `(lat, lon)` into the HMN hierarchy. */
interface HmnBreakdown {
  coord: DhgCoord;
  grossquadrat: Grossquadrat;
  kleinquadrat: string;
  meldetrapez: number;
  arbeitstrapez: Arbeitstrapez;
  tenths: [number, number];
  /** Easting/Northing of the Arbeitstrapez SW corner, used to rebuild the bbox. */
  arbeitSwE: number;
  arbeitSwN: number;
  /** Easting/Northing of the Kleinquadrat NW corner. */
  kleinNwE: number;
  kleinNwN: number;
  /** Easting/Northing of the Meldetrapez NW corner. */
  meldeNwE: number;
  meldeNwN: number;
}

/** Decompose a DHG coord into its HMN cells. */
export function decomposeHmn(
  point: LatLon,
  kennziffer?: number,
  shift?: DatumShift,
): HmnBreakdown {
  const coord =
    kennziffer === undefined ? forward(point, shift) : forwardInZone(point, kennziffer, shift);

  const eastOffsetFromCm = coord.easting - FALSE_EASTING;
  const gx = Math.floor(eastOffsetFromCm / GROSSQUADRAT_M);
  const gy = Math.floor(coord.northing / GROSSQUADRAT_M);

  const grossNwE = FALSE_EASTING + gx * GROSSQUADRAT_M;
  const grossNwN = (gy + 1) * GROSSQUADRAT_M;

  const kx = Math.floor((coord.easting - grossNwE) / KLEINQUADRAT_M);
  const ky = Math.floor((grossNwN - coord.northing) / KLEINQUADRAT_M);
  const colLetter = letterFromIndex(kx);
  const rowLetter = letterFromIndex(ky);
  if (colLetter === undefined || rowLetter === undefined) {
    throw new RangeError(
      `HMN cell out of Großquadrat range: kx=${kx}, ky=${ky} (likely a coordinate just outside the strip overlap).`,
    );
  }

  const kleinNwE = grossNwE + kx * KLEINQUADRAT_M;
  const kleinNwN = grossNwN - ky * KLEINQUADRAT_M;

  const mx = Math.floor((coord.easting - kleinNwE) / MELDETRAPEZ_M);
  const my = Math.floor((kleinNwN - coord.northing) / MELDETRAPEZ_M);
  const meldetrapez = my * 3 + mx + 1;
  const meldeNwE = kleinNwE + mx * MELDETRAPEZ_M;
  const meldeNwN = kleinNwN - my * MELDETRAPEZ_M;

  const ax = Math.floor((coord.easting - meldeNwE) / ARBEITSTRAPEZ_M);
  const ay = Math.floor((meldeNwN - coord.northing) / ARBEITSTRAPEZ_M);
  const arbeitstrapez = ARBEIT_LABELS[ay * 2 + ax];
  if (arbeitstrapez === undefined) {
    throw new RangeError(`HMN Arbeitstrapez index out of range: ax=${ax}, ay=${ay}`);
  }
  const arbeitNwE = meldeNwE + ax * ARBEITSTRAPEZ_M;
  const arbeitNwN = meldeNwN - ay * ARBEITSTRAPEZ_M;
  const arbeitSwE = arbeitNwE;
  const arbeitSwN = arbeitNwN - ARBEITSTRAPEZ_M;

  const tenthEast = Math.floor((coord.easting - arbeitSwE) / TENTH_M);
  const tenthNorth = Math.floor((coord.northing - arbeitSwN) / TENTH_M);

  return {
    coord,
    grossquadrat: { kennziffer: coord.kennziffer, gx, gy },
    kleinquadrat: `${colLetter}${rowLetter}`,
    meldetrapez,
    arbeitstrapez,
    tenths: [clampTenth(tenthEast), clampTenth(tenthNorth)],
    arbeitSwE,
    arbeitSwN,
    kleinNwE,
    kleinNwN,
    meldeNwE,
    meldeNwN,
  };
}

/** Format an HMN breakdown to canonical text at the requested depth. */
export function formatHmn(
  breakdown: HmnBreakdown,
  options: HmnEncodeOptions = {},
): string {
  const depth = options.depth ?? 5;
  const sep = options.separator ?? ' ';
  let out = breakdown.kleinquadrat;
  if (depth <= 2) return out;
  out += sep + String(breakdown.meldetrapez);
  if (depth === 3) return out;
  out += breakdown.arbeitstrapez;
  if (depth === 4) return out;
  const [te, tn] = breakdown.tenths;
  out += sep + String(te) + String(tn);
  return out;
}

/** Full HMN reference resolved into bounding box, centre, and Großquadrat. */
export function encodeHmn(
  point: LatLon,
  options: HmnEncodeOptions = {},
): DecodedHmnRef {
  const shift = options.datumShift;
  const breakdown = decomposeHmn(point, options.kennziffer, shift);
  const depth = options.depth ?? 5;
  const canonical = formatHmn(breakdown, options);

  const cellSizeM =
    depth === 2
      ? KLEINQUADRAT_M
      : depth === 3
        ? MELDETRAPEZ_M
        : depth === 4
          ? ARBEITSTRAPEZ_M
          : TENTH_M;

  const { swE, swN } = swCornerForDepth(breakdown, depth);
  const cellNwE = swE;
  const cellNwN = swN + cellSizeM;

  const nw = inverse({ ...breakdown.coord, easting: cellNwE, northing: cellNwN }, shift);
  const ne = inverse({ ...breakdown.coord, easting: cellNwE + cellSizeM, northing: cellNwN }, shift);
  const sw = inverse({ ...breakdown.coord, easting: cellNwE, northing: cellNwN - cellSizeM }, shift);
  const se = inverse({ ...breakdown.coord, easting: cellNwE + cellSizeM, northing: cellNwN - cellSizeM }, shift);
  const lats = [nw[0], ne[0], sw[0], se[0]];
  const lons = [nw[1], ne[1], sw[1], se[1]];
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const center = inverse({
    ...breakdown.coord,
    easting: cellNwE + cellSizeM / 2,
    northing: cellNwN - cellSizeM / 2,
  }, shift);

  const ref: DecodedHmnRef = {
    canonical,
    kleinquadrat: breakdown.kleinquadrat,
    grossquadrat: breakdown.grossquadrat,
    depth,
    bbox: [minLon, minLat, maxLon, maxLat],
    center,
  };
  if (depth >= 3) ref.meldetrapez = breakdown.meldetrapez;
  if (depth >= 4) ref.arbeitstrapez = breakdown.arbeitstrapez;
  if (depth >= 5) ref.tenths = breakdown.tenths;
  return ref;
}

interface SwCorner { swE: number; swN: number }

function swCornerForDepth(b: HmnBreakdown, depth: number): SwCorner {
  if (depth === 2) {
    return { swE: b.kleinNwE, swN: b.kleinNwN - KLEINQUADRAT_M };
  }
  if (depth === 3) {
    return { swE: b.meldeNwE, swN: b.meldeNwN - MELDETRAPEZ_M };
  }
  if (depth === 4) return { swE: b.arbeitSwE, swN: b.arbeitSwN };
  const [te, tn] = b.tenths;
  return {
    swE: b.arbeitSwE + te * TENTH_M,
    swN: b.arbeitSwN + tn * TENTH_M,
  };
}

