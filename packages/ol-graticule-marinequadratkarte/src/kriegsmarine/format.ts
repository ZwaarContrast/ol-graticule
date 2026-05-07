/** Grid reference formatter for the Kriegsmarine Naval Grid (e.g. "BC 6175"). */

import Polygon from 'ol/geom/Polygon';

import { BoundedCache, normalizeLon } from '@zwaarcontrast/ol-graticule';

import { findById, getAllLargeSquares } from './lookup.js';
import type { RectSquare, LatLon } from './types.js';
import { isPolySquare } from './types.js';

const polyCache = new WeakMap<LatLon[], Polygon>();

function polygonGeom(polygon: LatLon[]): Polygon {
  let geom = polyCache.get(polygon);
  if (!geom) {
    const closed: [number, number][] = polygon.map((p) => [p[1], p[0]]);
    closed.push(closed[0]!);
    geom = new Polygon([closed]);
    polyCache.set(polygon, geom);
  }
  return geom;
}

/** Point-in-polygon test; input is [lat, lon]. */
function pointInPolygon(point: LatLon, polygon: LatLon[]): boolean {
  return polygonGeom(polygon).intersectsCoordinate([point[1], point[0]]);
}

/** Check if a lat/lon point is inside a rectangular square; handles antimeridian-crossing rects. */
function pointInRect(point: LatLon, square: RectSquare): boolean {
  const [lat, lon] = point;
  const [nwLat, nwLon] = square.nw;
  const [seLat, seLon] = square.se;

  if (lat > nwLat || lat < seLat) return false;

  if ((nwLon === 180 && seLon === -180) || (nwLon === -180 && seLon === 180)) {
    return true;
  }

  if (nwLon > seLon) {
    return lon >= nwLon || lon <= seLon;
  }

  return lon >= nwLon && lon <= seLon;
}

/** Candidate child refs of `parentRef`: digits 1–9, plus the two-by-five "XY0Z" 10th slot for length-3 parents. */
export function childRefCandidates(parentRef: string): string[] {
  const out: string[] = new Array(9);
  for (let d = 1; d <= 9; d++) out[d - 1] = parentRef + d;

  if (parentRef.length === 3) {
    const lastChar = parentRef.charCodeAt(2);
    if (lastChar >= 0x31 && lastChar <= 0x39) {
      out.push(parentRef.slice(0, 2) + '0' + parentRef[2]);
    }
  }
  return out;
}

/** Resolve a [lat, lon] coordinate to the deepest Kriegsmarine grid reference up to `maxDepth` subdivisions. */
export function coordinateToGridRef(point: LatLon, maxDepth: number = 4): string | undefined {
  const [lat, lon] = point;
  const normalized: LatLon = [lat, normalizeLon(lon)];
  const largeSquares = getAllLargeSquares();

  let containingId: string | undefined;
  for (const sq of largeSquares) {
    const hit = isPolySquare(sq) ? pointInPolygon(normalized, sq.poly) : pointInRect(normalized, sq);
    if (hit) {
      containingId = sq.id;
      break;
    }
  }

  if (!containingId) return undefined;

  let ref = containingId;
  for (let depth = 0; depth < maxDepth; depth++) {
    let found = false;
    for (const subRef of childRefCandidates(ref)) {
      const sub = findById(subRef);
      if (!sub) continue;
      const hit = isPolySquare(sub) ? pointInPolygon(normalized, sub.poly) : pointInRect(normalized, sub);
      if (hit) {
        ref = subRef;
        found = true;
        break;
      }
    }
    if (!found) break;
  }

  return ref;
}

/** Format a grid reference string for display ("BC6175" → "BC 6175"). */
const gridRefCache = new BoundedCache<string, string>(4096);

export function formatGridRef(ref: string): string {
  const cached = gridRefCache.get(ref);
  if (cached !== undefined) return cached;
  const result = ref.length <= 2 ? ref : `${ref.slice(0, 2)} ${ref.slice(2)}`;
  gridRefCache.set(ref, result);
  return result;
}
