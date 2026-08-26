/**
 * Helpers shared by `DhgGridSystem` and `HmnGridSystem`: the world bounding
 * box used to clip far-out viewports before grid generation, and the corner
 * longitudes of the view extent used to pick which DHG zones to render.
 */

import type { Extent } from 'ol/extent';
import { getCenter } from 'ol/extent';
import type { ProjectionLike } from 'ol/proj';
import { transform } from 'ol/proj';
import { STRIP_OVERLAP_DEG, zoneByKennziffer, zoneForLon } from '../dhg/zones.js';
import { zoneIntersectsValidity } from '../dhg/stripPolygon.js';

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

/** Transform a view coordinate to `[lon, lat]` in EPSG:4326, or `null` if either is non-finite. */
export function toFiniteLonLat(
  coordinate: [number, number],
  viewProjection: ProjectionLike,
): [number, number] | null {
  const lonLat = transform(coordinate, viewProjection, 'EPSG:4326');
  const lon = lonLat[0];
  const lat = lonLat[1];
  if (lon === undefined || lat === undefined) return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
}

/**
 * Kennziffer of every DHG strip the view extent touches. In `single` mode the
 * single centre strip; otherwise every strip whose (optionally overlap-widened)
 * span intersects the extent's longitude range and the validity envelope.
 */
export function activeZonesFor(
  extent: Extent,
  viewProjection: ProjectionLike,
  mode: 'tiled' | 'overlap' | 'single',
): number[] {
  const overlapDeg = mode === 'overlap' ? STRIP_OVERLAP_DEG : 0;
  if (mode === 'single') {
    const centre = getCenter(extent);
    const [centreLon] = transform(centre, viewProjection, 'EPSG:4326');
    const centreZone = zoneForLon(centreLon ?? 0);
    return zoneIntersectsValidity(centreZone, overlapDeg)
      ? [centreZone.kennziffer]
      : [];
  }
  const lons = sampleCornerLons(extent, viewProjection);
  if (lons.length === 0) return [];
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const result: number[] = [];
  for (let k = 1; k <= 60; k++) {
    const zone = zoneByKennziffer(k);
    if (!zoneIntersectsValidity(zone, overlapDeg)) continue;
    const west = zone.cm - 3 - overlapDeg;
    const east = zone.cm + 3 + overlapDeg;
    if (east > minLon && west < maxLon) result.push(k);
  }
  return result;
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
