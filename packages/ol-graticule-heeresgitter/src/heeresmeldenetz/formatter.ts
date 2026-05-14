/**
 * Heeresmeldenetz label utilities: a zoom-stepped interval strategy and the
 * hierarchical cell label (`"PE"`, `"PE 5"`, `"PE 5b"`) at each level.
 */

import { SteppingIntervalStrategy } from '@zwaarcontrast/ol-graticule';

import { FALSE_EASTING } from '../dhg/zones.js';
import {
  ARBEITSTRAPEZ_M,
  GROSSQUADRAT_M,
  KLEINQUADRAT_M,
  MELDETRAPEZ_M,
} from './levels.js';
import { letterFromIndex } from './letters.js';

const ARBEIT_LABELS = ['a', 'b', 'c', 'd'] as const;

/**
 * IntervalStrategy returning the smallest cell size ≥ target screen step,
 * picked from {6 km, 2 km, 1 km}. Targets ~`targetScreenPx` between cells.
 */
export class HmnIntervalStrategy extends SteppingIntervalStrategy {
  constructor(targetScreenPx = 80) {
    super([ARBEITSTRAPEZ_M, MELDETRAPEZ_M, KLEINQUADRAT_M], targetScreenPx);
  }
}

/**
 * Full hierarchical cell label at the given interval level.
 *   6 km → `"PE"`
 *   2 km → `"PE 5"`
 *   1 km → `"PE 5b"`
 *
 * `midE`/`midN` are in DHG metres (real Rechtswert / Hochwert in the zone).
 */
export function hmnHierarchicalLabel(midE: number, midN: number, interval: number): string | undefined {
  const eFromCm = midE - FALSE_EASTING;
  const grossNwE = FALSE_EASTING + Math.floor(eFromCm / GROSSQUADRAT_M) * GROSSQUADRAT_M;
  const grossNwN = (Math.floor(midN / GROSSQUADRAT_M) + 1) * GROSSQUADRAT_M;

  const kx = Math.floor((midE - grossNwE) / KLEINQUADRAT_M);
  const ky = Math.floor((grossNwN - midN) / KLEINQUADRAT_M);
  const col = letterFromIndex(kx);
  const row = letterFromIndex(ky);
  if (col === undefined || row === undefined) return undefined;
  const klein = `${col}${row}`;
  if (interval >= KLEINQUADRAT_M) return klein;

  const kleinNwE = grossNwE + kx * KLEINQUADRAT_M;
  const kleinNwN = grossNwN - ky * KLEINQUADRAT_M;
  const mx = Math.floor((midE - kleinNwE) / MELDETRAPEZ_M);
  const my = Math.floor((kleinNwN - midN) / MELDETRAPEZ_M);
  const melde = my * 3 + mx + 1;
  if (interval >= MELDETRAPEZ_M) return `${klein} ${melde}`;

  const meldeNwE = kleinNwE + mx * MELDETRAPEZ_M;
  const meldeNwN = kleinNwN - my * MELDETRAPEZ_M;
  const ax = Math.floor((midE - meldeNwE) / ARBEITSTRAPEZ_M);
  const ay = Math.floor((meldeNwN - midN) / ARBEITSTRAPEZ_M);
  const arbeit = ARBEIT_LABELS[ay * 2 + ax] ?? 'a';
  return `${klein} ${melde}${arbeit}`;
}
