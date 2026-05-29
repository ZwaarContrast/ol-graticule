/**
 * Grid reference formatter for the Kriegsmarine Naval Grid (e.g. "BC 6175").
 *
 * The reference syntax and the within-cell subdivision it parses are ported
 * from Jan Kockrow's cljs-navalgrid (https://github.com/Nylle/cljs-navalgrid)
 * and his research at navalgrid.com. See the package README for the full credit.
 */

import Polygon from 'ol/geom/Polygon';

import { BoundedCache, ParseError, normalizeLon } from '@zwaarcontrast/ol-graticule';

import { findById, getLargeSquaresNearLat } from './lookup.js';
import type { RectSquare, LatLon, Square } from './types.js';
import { isPolySquare } from './types.js';
import { rectCrossesAntimeridian, lonSpanDeg, squareExtent } from './geo.js';

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
  const largeSquares = getLargeSquaresNearLat(lat);

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

/**
 * Parse a Kriegsmarine grid-reference string. Lenient: accepts `"BC"`,
 * `"BC 6175"`, `"BC6175"`, `"bc 6 1 7 5"`, case-insensitive. Returns the
 * canonical, whitespace-free form (`"BC6175"`). Throws {@link ParseError}
 * when the input does not match a 2-letter prefix + 0–8 digits.
 */
export function parseGridRef(text: string): string {
  const condensed = text.replace(/\s+/g, '');
  if (condensed.length === 0) throw new ParseError(text, 'empty input');
  const m = condensed.match(/^([a-zA-ZÄÖÜäöü])([a-zA-ZÄÖÜäöü])(\d{0,8})$/);
  if (!m) throw new ParseError(text, 'expected two letters followed by 0–8 digits');
  return m[1]!.toUpperCase() + m[2]!.toUpperCase() + m[3]!;
}

/** Geographic centre (`[lat, lon]`) of `sq`. Bbox centre for polygonal squares. */
function squareCenterLatLon(sq: Square): LatLon {
  if (isPolySquare(sq)) {
    const ext = squareExtent(sq);
    const centerLat = (ext[1] + ext[3]) / 2;
    const centerLon = (ext[0] + ext[2]) / 2;
    return [centerLat, centerLon];
  }
  const { nw, se } = sq;
  const centerLat = (nw[0] + se[0]) / 2;
  const centerLon = rectCrossesAntimeridian(nw, se)
    ? normalizeLon(nw[1] + lonSpanDeg(nw, se) / 2)
    : (nw[1] + se[1]) / 2;
  return [centerLat, centerLon];
}

/**
 * Resolve a Kriegsmarine grid reference to its geographic centre. Accepts the
 * same lenient input forms as {@link parseGridRef}. Returns `[lat, lon]` in
 * WGS84. Throws {@link ParseError} for unparseable input or unknown
 * references.
 */
export function gridRefToCoordinate(text: string): LatLon {
  const ref = parseGridRef(text);
  const sq = findById(ref);
  if (!sq) throw new ParseError(text, `unknown grid reference "${ref}"`);
  return squareCenterLatLon(sq);
}
