import { get as getProjection } from 'ol/proj';
import type { Extent } from 'ol/extent';
import type { ProjectionLike } from 'ol/proj';

/** A wrapping projection's extent and wrap width (map units), or null if it does
 * not wrap in x. */
export function wrapParams(
  projection: ProjectionLike,
): { projExtent: Extent; worldWidth: number } | null {
  const projObj = typeof projection === 'string' ? getProjection(projection) : projection;
  const projExtent = projObj?.getExtent();
  if (!projExtent || !projObj?.canWrapX()) return null;
  const worldWidth = projExtent[2] - projExtent[0];
  if (worldWidth <= 0) return null;
  return { projExtent, worldWidth };
}

/**
 * The x-offsets (map units) of every world copy `extent` touches, given the
 * projection's `projExtent` and wrap `worldWidth`. Always returns at least [0].
 */
export function worldOffsets(extent: Extent, projExtent: Extent, worldWidth: number): number[] {
  const minN = Math.floor((extent[0] - projExtent[2]) / worldWidth) + 1;
  const maxN = Math.floor((extent[2] - projExtent[0]) / worldWidth);
  const offsets: number[] = [];
  for (let n = minN; n <= maxN; n++) offsets.push(n * worldWidth);
  return offsets.length > 0 ? offsets : [0];
}

/** Visible world x-offsets for `extent` under `projection` (just [0] if it does
 * not wrap). */
export function visibleWorldOffsets(extent: Extent, projection: ProjectionLike): number[] {
  const wrap = wrapParams(projection);
  if (!wrap) return [0];
  return worldOffsets(extent, wrap.projExtent, wrap.worldWidth);
}

/** The x-offset of the world copy a map coordinate sits in, or 0 when the
 * projection does not wrap. */
export function worldOffsetOf(coordinateX: number, projection: ProjectionLike): number {
  const wrap = wrapParams(projection);
  if (!wrap) return 0;
  return wrap.worldWidth * Math.round(coordinateX / wrap.worldWidth);
}

/**
 * Collapse a (possibly multi-world) view extent to the single base-world x-span
 * the grid system should generate for, so callers can then repeat it across the
 * visible world copies. Leaves the extent unchanged for non-wrapping projections.
 */
export function canonicalizeExtent(extent: Extent, projection: ProjectionLike): Extent {
  const wrap = wrapParams(projection);
  if (!wrap) return extent;
  const { projExtent, worldWidth } = wrap;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const offset of worldOffsets(extent, projExtent, worldWidth)) {
    const copyMin = Math.max(extent[0], projExtent[0] + offset);
    const copyMax = Math.min(extent[2], projExtent[2] + offset);
    if (copyMin < copyMax) {
      minX = Math.min(minX, copyMin - offset);
      maxX = Math.max(maxX, copyMax - offset);
    }
  }

  if (!isFinite(minX)) return extent;
  return [minX, extent[1], maxX, extent[3]];
}
