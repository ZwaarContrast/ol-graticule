import type { LatLon } from '@zwaarcontrast/ol-graticule';

export type { LatLon };

/** A rectangular square defined by NW and SE corners. */
export interface RectSquare {
  id: string;
  nw: LatLon;
  se: LatLon;
  /** Partial square layout, which sub-positions exist. */
  sub?: number[][] | undefined;
}

/** A polygonal square defined by boundary vertices. */
export interface PolySquare {
  id: string;
  poly: LatLon[];
}

/** Result of a lookup: either rectangular or polygonal. */
export type Square = RectSquare | PolySquare;

export function isPolySquare(s: Square): s is PolySquare {
  return 'poly' in s;
}

export function isRectSquare(s: Square): s is RectSquare {
  return 'nw' in s && 'se' in s;
}

/** Group of congruent squares sharing a definition. */
export interface SquareGroup {
  ids: string[];
  nw: LatLon;
  se: LatLon;
  /** Orientation: h=horizontal shift, v=vertical shift. */
  o?: 'h' | 'v' | undefined;
  /** Partial square layout. */
  sub?: number[][] | undefined;
  /** Two-by-five square orientation. */
  so?: 'h' | 'v' | undefined;
}

/** Polygonal square definition in the data layer. */
export interface PolygonalDef {
  id: string;
  poly: LatLon[];
}
