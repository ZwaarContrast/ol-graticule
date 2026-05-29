/**
 * Lookup functions for finding Kriegsmarine grid squares by ID; uses pre-built
 * indexes for O(1) lookups.
 *
 * The grid layout this indexes over comes from Jan Kockrow's reconstruction
 * at navalgrid.com (https://www.navalgrid.com/) and cljs-navalgrid
 * (https://github.com/Nylle/cljs-navalgrid). See the package README for the
 * full credit.
 */

import type { RectSquare, PolySquare, Square, SquareGroup, PolygonalDef } from './types.js';
import { largeRegularSquares, largePartialSquares, irregularSquares, polygonalSquares, twoByFiveSquares, partialSquares } from './data.js';
import { shift, fromSquareDef } from './subdivision.js';
import { squareExtent } from './geo.js';

interface GroupEntry {
  group: SquareGroup;
  collection: 'large' | 'irregular' | 'twoByFive' | 'partial';
}

let groupIndex: Map<string, GroupEntry[]> | undefined;
let polyIndex: Map<string, PolygonalDef> | undefined;
let cachedLargeSquares: Square[] | undefined;

const LAT_BAND_DEG = 5;
const LAT_BAND_COUNT = Math.ceil(180 / LAT_BAND_DEG);
let largeSquaresByLatBand: Square[][] | undefined;

function latBandIndex(lat: number): number {
  const clamped = Math.max(-90, Math.min(90, lat));
  const idx = Math.floor((clamped + 90) / LAT_BAND_DEG);
  return idx >= LAT_BAND_COUNT ? LAT_BAND_COUNT - 1 : idx;
}

function getGroupIndex(): Map<string, GroupEntry[]> {
  if (groupIndex) return groupIndex;
  groupIndex = new Map();

  const addGroups = (groups: SquareGroup[], collection: GroupEntry['collection']) => {
    for (const group of groups) {
      for (const id of group.ids) {
        const entry: GroupEntry = { group, collection };
        const existing = groupIndex!.get(id);
        if (existing) {
          existing.push(entry);
        } else {
          groupIndex!.set(id, [entry]);
        }
      }
    }
  };

  addGroups([...largeRegularSquares, ...largePartialSquares], 'large');
  addGroups(irregularSquares, 'irregular');
  addGroups(twoByFiveSquares, 'twoByFive');
  addGroups(partialSquares, 'partial');

  return groupIndex;
}

function getPolyIndex(): Map<string, PolygonalDef> {
  if (polyIndex) return polyIndex;
  polyIndex = new Map();
  for (const def of polygonalSquares) {
    polyIndex.set(def.id, def);
  }
  return polyIndex;
}

function extractFromGroup(ref: string, group: SquareGroup): (RectSquare & { so?: 'h' | 'v' | undefined }) | undefined {
  const { ids, nw, se, o = 'h', sub, so } = group;
  const i = ids.indexOf(ref);
  if (i === -1) return undefined;

  const base: RectSquare = { id: ref, nw, se };
  const shifted = shift(base, o, i);
  return { ...shifted, sub, so };
}

function findInCollection<T>(
  key: string,
  collection: GroupEntry['collection'],
  resolve: (extracted: RectSquare & { so?: 'h' | 'v' | undefined }) => T | undefined,
): T | undefined {
  const entries = getGroupIndex().get(key);
  if (!entries) return undefined;
  for (const entry of entries) {
    if (entry.collection !== collection) continue;
    const extracted = extractFromGroup(key, entry.group);
    if (!extracted) continue;
    const result = resolve(extracted);
    if (result) return result;
  }
  return undefined;
}

function findLarge(ref: string): Square | undefined {
  return findInCollection(ref.slice(0, 2), 'large', (e) => fromSquareDef(ref, e));
}

function findIrregular(ref: string): Square | undefined {
  return findInCollection(ref, 'irregular', (e) => e);
}

function findPolygonal(ref: string): PolySquare | undefined {
  const def = getPolyIndex().get(ref);
  return def ? { id: ref, poly: def.poly } : undefined;
}

/** "AK01" → "AK1", "AK15" → "AK1". */
function twoByFiveSearchKey(ref: string): string | undefined {
  const subs = ref.slice(2);
  if (subs.length === 0) return undefined;
  const large = ref.slice(0, 2);
  if (subs[0] === '0' && subs.length > 1) {
    return large + subs[1];
  }
  return large + subs[0];
}

function findTwoByFive(ref: string): Square | undefined {
  const key = twoByFiveSearchKey(ref);
  if (!key) return undefined;
  return findInCollection(key, 'twoByFive', (e) => fromSquareDef(ref, e));
}

/** Searches each prefix length of `ref` against the partial-square index. */
function findPartial(ref: string): Square | undefined {
  const large = ref.slice(0, 2);
  const subs = ref.slice(2);
  for (let i = 1; i <= subs.length; i++) {
    const r = large + subs.slice(0, i);
    const hit = findInCollection(r, 'partial', (e) => fromSquareDef(ref, e));
    if (hit) return hit;
  }
  return undefined;
}

/** Find a square by its full reference ID (e.g. "BC", "BC6", "BC6175"). */
export function findById(ref: string): Square | undefined {
  return findLarge(ref)
    ?? findIrregular(ref)
    ?? findPolygonal(ref)
    ?? findTwoByFive(ref)
    ?? findPartial(ref);
}

/** Force both indexes (group + polygonal) to build now; idempotent. */
export function ensureIndexed(): void {
  getGroupIndex();
  getPolyIndex();
}

/** Get all large square definitions (rectangular and polygonal); cached. */
export function getAllLargeSquares(): Square[] {
  if (cachedLargeSquares) return cachedLargeSquares;

  const result: Square[] = [];

  const allGroups = [...largeRegularSquares, ...largePartialSquares, ...irregularSquares];
  for (const group of allGroups) {
    for (const id of group.ids) {
      if (id.length !== 2) continue;
      const extracted = extractFromGroup(id, group);
      if (extracted) {
        result.push({ id: extracted.id, nw: extracted.nw, se: extracted.se });
      }
    }
  }

  for (const def of polygonalSquares) {
    if (def.id.length === 2) {
      result.push({ id: def.id, poly: def.poly });
    }
  }

  cachedLargeSquares = result;
  return result;
}

function getLargeSquaresByLatBand(): Square[][] {
  if (largeSquaresByLatBand) return largeSquaresByLatBand;
  const bands: Square[][] = Array.from({ length: LAT_BAND_COUNT }, () => []);
  for (const sq of getAllLargeSquares()) {
    const [, minLat, , maxLat] = squareExtent(sq);
    const lo = latBandIndex(minLat);
    const hi = latBandIndex(maxLat);
    for (let i = lo; i <= hi; i++) {
      const band = bands[i];
      if (band) band.push(sq);
    }
  }
  largeSquaresByLatBand = bands;
  return bands;
}

/** Large squares whose bbox touches the 5° latitude band containing `lat`. */
export function getLargeSquaresNearLat(lat: number): Square[] {
  if (!Number.isFinite(lat)) return getAllLargeSquares();
  return getLargeSquaresByLatBand()[latBandIndex(lat)] ?? [];
}

/** Large squares whose bbox touches any 5° latitude band between `minLat` and `maxLat`. */
export function getLargeSquaresInLatRange(minLat: number, maxLat: number): Square[] {
  if (!Number.isFinite(minLat) || !Number.isFinite(maxLat)) return getAllLargeSquares();

  const lo = latBandIndex(minLat);
  const hi = latBandIndex(maxLat);
  if (lo === hi) return getLargeSquaresNearLat(minLat);

  const bands = getLargeSquaresByLatBand();
  const seen = new Set<string>();
  const out: Square[] = [];
  for (let i = lo; i <= hi; i++) {
    const band = bands[i];
    if (!band) continue;
    for (const sq of band) {
      if (!seen.has(sq.id)) {
        seen.add(sq.id);
        out.push(sq);
      }
    }
  }
  return out;
}