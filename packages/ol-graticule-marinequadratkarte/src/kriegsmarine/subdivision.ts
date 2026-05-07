/** Sub-square calculation and shifting for the Kriegsmarine grid. */

import { normalizeLon } from '@zwaarcontrast/ol-graticule';
import type { RectSquare, LatLon, Square } from './types.js';
import { simpleRhumbDivision, roundTo, smallestLonDiff } from './latlon.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Shift a square's boundaries along an orientation by a given factor. */
export function shift(square: RectSquare, orientation: 'h' | 'v', factor: number): RectSquare {
  const [nwLat, nwLon] = square.nw;
  const [seLat, seLon] = square.se;

  if (orientation === 'h') {
    const dLon = smallestLonDiff(nwLon * DEG_TO_RAD, seLon * DEG_TO_RAD) * RAD_TO_DEG;
    const dist = factor * dLon;
    return {
      ...square,
      nw: [nwLat, normalizeLon(roundTo(3, nwLon + dist))],
      se: [seLat, normalizeLon(roundTo(3, seLon + dist))],
    };
  }

  const dLat = seLat - nwLat;
  const dist = factor * dLat;
  return {
    ...square,
    nw: [roundTo(3, nwLat + dist), nwLon],
    se: [roundTo(3, seLat + dist), seLon],
  };
}

/** Map a sub-square digit to [eastSteps, southSteps]; default 3x3 telephone-keypad layout, or a custom `sub` array. */
export function steps(n: number, sub?: number[][] | undefined): [number, number] | undefined {
  if (sub == null) {
    return [(n - 1) % 3, Math.floor((n - 1) / 3)];
  }
  const flat = sub.flat();
  const idx = flat.indexOf(n);
  if (idx === -1) return undefined;
  const cols = sub[0]!.length;
  return [idx % cols, Math.floor(idx / cols)];
}

/** Get a sub-square of a rectangular parent square. */
export function subSquare(parent: RectSquare, n: number): RectSquare | undefined {
  const { id, nw, se, sub } = parent;
  const [cols, rows] = sub ? [sub[0]!.length, sub.length] : [3, 3];

  const lonPoints = simpleRhumbDivision(nw, [nw[0], se[1]], cols);
  const latPoints = simpleRhumbDivision(nw, [se[0], nw[1]], rows);
  const lonStep: LatLon = lonPoints[1]!;
  const latStep: LatLon = latPoints[1]!;

  const st = steps(n, sub);
  if (!st) return undefined;
  const [h, v] = st;

  let result: RectSquare = {
    id: `${id}${n}`,
    nw,
    se: [latStep[0], lonStep[1]],
  };
  result = shift(result, 'h', h);
  result = shift(result, 'v', v);
  return result;
}

/** Two-by-five sub-square layout. */
function twoByFiveSubs(orientation: 'h' | 'v'): number[][] {
  if (orientation === 'v') {
    return [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]];
  }
  return [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]];
}

/** Parse remaining digits from a reference string after a prefix. */
function parseDigits(ref: string, prefixLen: number): number[] {
  return ref.slice(prefixLen).split('').map(Number);
}

/** Recursively subdivide a regular rectangular square using a digit sequence. */
export function regularSquare(ref: string, def: RectSquare): RectSquare | undefined {
  const digits = parseDigits(ref, def.id.length);
  let square: RectSquare | undefined = def;
  for (const digit of digits) {
    if (!square) return undefined;
    square = subSquare(square, digit);
  }
  return square;
}

/** Handle two-by-five square subdivision. */
export function twoByFiveSquare(ref: string, def: { id?: string | undefined; nw: LatLon; se: LatLon; so: 'h' | 'v' }): RectSquare | undefined {
  const { nw, se, so } = def;
  const [cols, rows] = so === 'v' ? [2, 5] : [5, 2];

  const lonPoints = simpleRhumbDivision(nw, [nw[0], se[1]], cols);
  const latPoints = simpleRhumbDivision(nw, [se[0], nw[1]], rows);
  const lonStep = lonPoints[1]!;
  const latStep = latPoints[1]!;

  const subs = ref.slice(2).split('').map(Number);
  const n = subs[0] === 0 ? 10 : subs[1]!;

  const st = steps(n, twoByFiveSubs(so));
  if (!st) return undefined;
  const [h, v] = st;

  const id = ref.slice(0, 4);
  let result: RectSquare = {
    id,
    nw,
    se: [latStep[0], lonStep[1]],
  };
  result = shift(result, 'h', h);
  result = shift(result, 'v', v);

  if (ref.length > 4) {
    return regularSquare(ref, result);
  }
  return result;
}

/** Process a square definition into its final resolved form. */
export function fromSquareDef(ref: string, def: RectSquare & { so?: 'h' | 'v' | undefined }): Square | undefined {
  if (!def) return undefined;
  if (def.id === ref) return { id: def.id, nw: def.nw, se: def.se };
  if (def.so) return twoByFiveSquare(ref, { ...def, so: def.so });
  const result = regularSquare(ref, def);
  if (!result) return undefined;
  const { sub: _sub, ...clean } = result;
  return clean;
}
