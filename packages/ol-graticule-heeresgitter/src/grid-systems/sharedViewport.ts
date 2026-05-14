/**
 * Helpers shared by `DhgGridSystem` and `HmnGridSystem`: the world bounding
 * box used to clip far-out viewports before grid generation, and the corner
 * longitudes of the view extent used to pick which DHG zones to render.
 */

import type { Extent } from 'ol/extent';
import type { ProjectionLike } from 'ol/proj';
import { transform } from 'ol/proj';

/**
 * Loose bbox around every plausible DHG metre coordinate. Used to discard
 * viewports that fall entirely outside the operational theatre before any
 * line generation runs.
 */
export const DHG_WORLD_BOX: Extent = [-2_000_000, -1_000_000, 3_000_000, 13_000_000];

/** Stable string key for a view projection, suitable for cache keys. */
export function projectionKey(projection: ProjectionLike): string {
  if (typeof projection === 'string') return projection;
  return projection?.getCode() ?? '';
}

/** Cache key for cursor-formatted coordinates: projection + integer-rounded `(x, y)`. */
export function cursorKey(coordinate: [number, number], projection: ProjectionLike): string {
  return `${projectionKey(projection)}|${Math.round(coordinate[0])}|${Math.round(coordinate[1])}`;
}

/** Longitudes of the four viewport corners, with non-finite values filtered out. */
export function sampleCornerLons(extent: Extent, viewProjection: ProjectionLike): number[] {
  const [minX, minY, maxX, maxY] = extent;
  const corners: ReadonlyArray<[number, number]> = [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
  const out: number[] = [];
  for (const corner of corners) {
    const lon = transform(corner, viewProjection, 'EPSG:4326')[0];
    if (lon !== undefined && Number.isFinite(lon)) out.push(lon);
  }
  return out;
}
