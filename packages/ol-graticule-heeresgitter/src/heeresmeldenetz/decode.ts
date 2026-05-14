/**
 * Parse an HMN reference (e.g. `"PE 1b 52"`) back to a bounding box, centre,
 * and Großquadrat. Because `AA..ZZ` repeats every 150 km in a DHG strip, the
 * caller must supply enough information to disambiguate which Großquadrat
 * the cell is in: either an explicit `Grossquadrat`, or a `near` location.
 */

import { forward, inverse } from '../dhg/projection.js';
import { FALSE_EASTING } from '../dhg/zones.js';
import type { DatumShift, LatLon } from '../dhg/types.js';
import {
  ARBEITSTRAPEZ_M,
  GROSSQUADRAT_M,
  KLEINQUADRAT_M,
  MELDETRAPEZ_M,
  TENTH_M,
} from './levels.js';
import { letterToIndex } from './letters.js';
import type {
  Arbeitstrapez,
  DecodedHmnRef,
  Grossquadrat,
} from './types.js';

const PATTERN = /^\s*([A-HJ-Z])([A-HJ-Z])\s*(?:([1-9])(?:\s*([a-d])(?:\s*(\d{2}))?)?)?\s*$/i;

export interface ParseHmnOptions {
  /**
   * Explicit Großquadrat for disambiguation. Mutually exclusive with `near`.
   */
  grossquadrat?: Grossquadrat;
  /**
   * Location near the target. The library picks the Großquadrat whose
   * resolved cell centre lies closest to `near`. Mutually exclusive with
   * `grossquadrat`.
   */
  near?: LatLon;
  /** Caller-supplied sheet number, round-tripped onto the result. */
  sheetNumber?: string;
  /** Override the WGS 84 to Bessel Potsdam datum shift. Defaults to the active shift. */
  datumShift?: DatumShift;
}

/** Parse an HMN reference. Returns `undefined` if the text or options are invalid. */
export function parseHmn(text: string, options: ParseHmnOptions): DecodedHmnRef | undefined {
  const matched = text.match(PATTERN);
  if (!matched) return undefined;
  const col = matched[1];
  const row = matched[2];
  const meldeStr = matched[3];
  const arbeitStr = matched[4];
  const tenthsStr = matched[5];
  if (!col || !row) return undefined;

  const kx = letterToIndex(col);
  const ky = letterToIndex(row);
  if (kx < 0 || ky < 0) return undefined;

  const meldetrapez = meldeStr ? Number(meldeStr) : undefined;
  const arbeitstrapez = arbeitStr
    ? (arbeitStr.toLowerCase() as Arbeitstrapez)
    : undefined;
  const tenths: [number, number] | undefined = tenthsStr
    ? [Number(tenthsStr[0]), Number(tenthsStr[1])]
    : undefined;

  let depth: 2 | 3 | 4 | 5;
  if (tenths) depth = 5;
  else if (arbeitstrapez) depth = 4;
  else if (meldetrapez !== undefined) depth = 3;
  else depth = 2;

  const grossquadrat = options.grossquadrat ?? grossquadratFor(options.near, options.datumShift);
  if (!grossquadrat) return undefined;

  // Reconstruct the resolved cell's NW corner in DHG metres.
  const grossNwE = FALSE_EASTING + grossquadrat.gx * GROSSQUADRAT_M;
  const grossNwN = (grossquadrat.gy + 1) * GROSSQUADRAT_M;
  const kleinNwE = grossNwE + kx * KLEINQUADRAT_M;
  const kleinNwN = grossNwN - ky * KLEINQUADRAT_M;

  let cellNwE = kleinNwE;
  let cellNwN = kleinNwN;
  let cellSize = KLEINQUADRAT_M;

  if (meldetrapez !== undefined) {
    const mx = (meldetrapez - 1) % 3;
    const my = Math.floor((meldetrapez - 1) / 3);
    cellNwE = kleinNwE + mx * MELDETRAPEZ_M;
    cellNwN = kleinNwN - my * MELDETRAPEZ_M;
    cellSize = MELDETRAPEZ_M;
  }
  if (arbeitstrapez !== undefined) {
    const idx = 'abcd'.indexOf(arbeitstrapez);
    const ax = idx % 2;
    const ay = Math.floor(idx / 2);
    cellNwE = cellNwE + ax * ARBEITSTRAPEZ_M;
    cellNwN = cellNwN - ay * ARBEITSTRAPEZ_M;
    cellSize = ARBEITSTRAPEZ_M;
  }
  if (tenths !== undefined) {
    cellNwE += tenths[0] * TENTH_M;
    cellNwN = cellNwN - ARBEITSTRAPEZ_M + (tenths[1] + 1) * TENTH_M;
    cellSize = TENTH_M;
  }

  const dhgFrame = { kennziffer: grossquadrat.kennziffer, easting: 0, northing: 0 };
  const shift = options.datumShift;

  const nw = inverse({ ...dhgFrame, easting: cellNwE, northing: cellNwN }, shift);
  const ne = inverse({ ...dhgFrame, easting: cellNwE + cellSize, northing: cellNwN }, shift);
  const sw = inverse({ ...dhgFrame, easting: cellNwE, northing: cellNwN - cellSize }, shift);
  const se = inverse({ ...dhgFrame, easting: cellNwE + cellSize, northing: cellNwN - cellSize }, shift);
  const lats = [nw[0], ne[0], sw[0], se[0]];
  const lons = [nw[1], ne[1], sw[1], se[1]];
  const center = inverse({
    ...dhgFrame,
    easting: cellNwE + cellSize / 2,
    northing: cellNwN - cellSize / 2,
  }, shift);

  const klein = col.toUpperCase() + row.toUpperCase();
  const canonical = canonicalize(klein, meldetrapez, arbeitstrapez, tenths);

  const ref: DecodedHmnRef = {
    canonical,
    kleinquadrat: klein,
    grossquadrat,
    depth,
    bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
    center,
  };
  if (meldetrapez !== undefined) ref.meldetrapez = meldetrapez;
  if (arbeitstrapez !== undefined) ref.arbeitstrapez = arbeitstrapez;
  if (tenths !== undefined) ref.tenths = tenths;
  if (options.sheetNumber !== undefined) ref.sheetNumber = options.sheetNumber;
  return ref;
}

function canonicalize(
  klein: string,
  melde: number | undefined,
  arbeit: Arbeitstrapez | undefined,
  tenths: [number, number] | undefined,
): string {
  let out = klein;
  if (melde === undefined) return out;
  out += ' ' + melde;
  if (arbeit === undefined) return out;
  out += arbeit;
  if (tenths === undefined) return out;
  out += ' ' + tenths[0] + tenths[1];
  return out;
}

function grossquadratFor(
  near: LatLon | undefined,
  shift: DatumShift | undefined,
): Grossquadrat | undefined {
  if (!near) return undefined;
  const dhg = forward(near, shift);
  const gx = Math.floor((dhg.easting - FALSE_EASTING) / GROSSQUADRAT_M);
  const gy = Math.floor(dhg.northing / GROSSQUADRAT_M);
  return { kennziffer: dhg.kennziffer, gx, gy };
}
