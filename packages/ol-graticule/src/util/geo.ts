import type { Extent } from 'ol/extent';
import type { TransformFunction } from 'ol/proj';

/** Wrap a longitude to [-180, 180]; non-finite values pass through. */
export function normalizeLon(lon: number): number {
  if (!Number.isFinite(lon)) return lon;
  if (lon > 180) return lon - 360 * Math.ceil((lon - 180) / 360);
  if (lon < -180) return lon + 360 * Math.ceil((-180 - lon) / 360);
  return lon;
}

/** Bounding box of a polygon as `[minX, minY, maxX, maxY]`, optionally padded. */
export function extentFromPolygon(
  polygon: ReadonlyArray<readonly [number, number]>,
  pad = 0,
): Extent {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX - pad, minY - pad, maxX + pad, maxY + pad];
}

/**
 * Transform an extent by sampling along all 4 edges, not just corners.
 * Produces an accurate bounding box for non-affine projections. Returns
 * `[NaN, NaN, NaN, NaN]` if every sampled point fails to transform.
 */
export function transformExtentSampled(
  extent: Extent,
  transformFn: TransformFunction,
  samples = 8,
): Extent {
  const [minX, minY, maxX, maxY] = extent;
  let rMinX = Infinity;
  let rMinY = Infinity;
  let rMaxX = -Infinity;
  let rMaxY = -Infinity;

  const update = (xy: number[]): void => {
    const x = xy[0];
    const y = xy[1];
    if (x === undefined || y === undefined) return;
    if (!isFinite(x) || !isFinite(y)) return;
    if (x < rMinX) rMinX = x;
    if (y < rMinY) rMinY = y;
    if (x > rMaxX) rMaxX = x;
    if (y > rMaxY) rMaxY = y;
  };

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = minX + t * (maxX - minX);
    const y = minY + t * (maxY - minY);
    update(transformFn([x, minY], undefined, 2));
    update(transformFn([x, maxY], undefined, 2));
    update(transformFn([minX, y], undefined, 2));
    update(transformFn([maxX, y], undefined, 2));
  }

  if (!isFinite(rMinX)) return [NaN, NaN, NaN, NaN];
  return [rMinX, rMinY, rMaxX, rMaxY];
}
