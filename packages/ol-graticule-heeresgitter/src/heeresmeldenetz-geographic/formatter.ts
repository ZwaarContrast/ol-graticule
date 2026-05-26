/**
 * Geographic HMN label utilities: hierarchical cell label at each level,
 * computed from arcsecond coordinates of the cell centre.
 */

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
} from './levels.js';
import { letterFromIndex } from '../heeresmeldenetz/letters.js';

const ARBEIT_LABELS = ['a', 'b', 'c', 'd'] as const;

/**
 * Render levels: which subdivision to stop at.
 *  - `2`: Kleintrapez (`"TD"`)
 *  - `3`: Kleintrapez + Meldetrapez (`"TD 5"`)
 *  - `4`: + Arbeitstrapez (`"TD 5b"`)
 */
export type HmnGeoRenderDepth = 2 | 3 | 4;

/**
 * Full hierarchical cell label at the given depth, given a cell centre point
 * in arcseconds. Returns undefined if the row/column letter would fall outside
 * the 25-letter alphabet (i.e. the centre is outside any Großtrapez).
 */
export function hmnGeoHierarchicalLabel(
  midLonSec: number,
  midLatSec: number,
  depth: HmnGeoRenderDepth,
): string | undefined {
  const grossNwLonSec =
    ANCHOR_LON_SEC + Math.floor((midLonSec - ANCHOR_LON_SEC) / GROSSTRAPEZ_LON_SEC) * GROSSTRAPEZ_LON_SEC;
  const grossNwLatSec =
    ANCHOR_LAT_SEC + (Math.floor((midLatSec - ANCHOR_LAT_SEC) / GROSSTRAPEZ_LAT_SEC) + 1) * GROSSTRAPEZ_LAT_SEC;

  const kx = Math.floor((midLonSec - grossNwLonSec) / KLEINTRAPEZ_LON_SEC);
  const ky = Math.floor((grossNwLatSec - midLatSec) / KLEINTRAPEZ_LAT_SEC);
  const col = letterFromIndex(kx);
  const row = letterFromIndex(ky);
  if (col === undefined || row === undefined) return undefined;
  const klein = `${col}${row}`;
  if (depth <= 2) return klein;

  const kleinNwLonSec = grossNwLonSec + kx * KLEINTRAPEZ_LON_SEC;
  const kleinNwLatSec = grossNwLatSec - ky * KLEINTRAPEZ_LAT_SEC;
  const mx = Math.floor((midLonSec - kleinNwLonSec) / MELDETRAPEZ_LON_SEC);
  const my = Math.floor((kleinNwLatSec - midLatSec) / MELDETRAPEZ_LAT_SEC);
  const melde = my * 3 + mx + 1;
  if (depth === 3) return `${klein} ${melde}`;

  const meldeNwLonSec = kleinNwLonSec + mx * MELDETRAPEZ_LON_SEC;
  const meldeNwLatSec = kleinNwLatSec - my * MELDETRAPEZ_LAT_SEC;
  const ax = Math.floor((midLonSec - meldeNwLonSec) / ARBEITSTRAPEZ_LON_SEC);
  const ay = Math.floor((meldeNwLatSec - midLatSec) / ARBEITSTRAPEZ_LAT_SEC);
  const arbeit = ARBEIT_LABELS[ay * 2 + ax] ?? 'a';
  return `${klein} ${melde}${arbeit}`;
}
