import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type { TransformFunction } from 'ol/proj';
import type { ProjectionScratch } from './projectionScratch.js';

/** True when `value` is within `epsilon` of a multiple of `majorInterval`. */
export function isOnMajorLine(value: number, majorInterval: number, epsilon: number): boolean {
  return Math.abs(Math.round(value / majorInterval) * majorInterval - value) < epsilon;
}

/** Derive target-CRS units per pixel from the viewport's projected corners. */
export function measureTargetResolution(
  target: Extent,
  toView: TransformFunction,
  resolution: number,
): number | undefined {
  const [tMinX, tMinY, tMaxX, tMaxY] = target;
  const targetWidth = tMaxX - tMinX;
  const [tlx] = toView([tMinX, tMaxY], undefined, 2);
  const [trx] = toView([tMaxX, tMaxY], undefined, 2);
  const [blx] = toView([tMinX, tMinY], undefined, 2);
  const [brx] = toView([tMaxX, tMinY], undefined, 2);
  const viewWidth = Math.max(
    Math.abs((trx ?? 0) - (tlx ?? 0)),
    Math.abs((brx ?? 0) - (blx ?? 0)),
  );
  const viewWidthPx = viewWidth / resolution;
  return viewWidthPx > 0 ? targetWidth / viewWidthPx : undefined;
}

/** Densification count for a grid line, capped at `max` and floored at 4. */
export function densifyCount(extent: Extent, interval: number, max: number): number {
  const span = Math.max(extent[2] - extent[0], extent[3] - extent[1]);
  return Math.min(max, Math.max(4, Math.ceil(span / interval)));
}

/** Two-point LineString for affine views; no densification or transform. */
export function buildStraightGridLine(
  constValue: number,
  sweepStart: number,
  sweepEnd: number,
  axis: 'x' | 'y',
  type: 'major' | 'minor',
): Feature<Geometry> {
  const geometry = new LineString(
    axis === 'y'
      ? [[sweepStart, constValue], [sweepEnd, constValue]]
      : [[constValue, sweepStart], [constValue, sweepEnd]],
  );
  return new Feature<Geometry>({
    geometry,
    gridValue: constValue,
    gridAxis: axis,
    gridLineType: type,
  });
}

/** One line in a batch passed to {@link emitFlatLineFeatures}. */
export interface FlatLineSpec {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Vertex count along the line; ≥ 2. */
  npts: number;
  /** Properties applied to the resulting Feature. */
  props: Record<string, unknown>;
  /** Optional non-linear x-interp (e.g. antimeridian-aware longitude). Default linear. */
  xInterp?: (a: number, b: number, t: number) => number;
}

/**
 * Append axis-aligned grid-line specs from `start` to `end` at `interval` spacing.
 * `axis: 'x'` produces vertical lines (constant x, sweeping y); `axis: 'y'` produces
 * horizontal lines. `skip` returns true to drop a position (e.g. minor coincides with major).
 */
export function pushAxisGridLineSpecs(
  specs: FlatLineSpec[],
  axis: 'x' | 'y',
  start: number,
  end: number,
  interval: number,
  perpStart: number,
  perpEnd: number,
  npts: number,
  type: 'major' | 'minor',
  skip?: (v: number) => boolean,
): void {
  for (let v = start; v <= end; v += interval) {
    if (skip?.(v)) continue;
    if (axis === 'x') {
      specs.push({
        startX: v, startY: perpStart,
        endX: v, endY: perpEnd,
        npts,
        props: { gridValue: v, gridAxis: 'x', gridLineType: type },
      });
    } else {
      specs.push({
        startX: perpStart, startY: v,
        endX: perpEnd, endY: v,
        npts,
        props: { gridValue: v, gridAxis: 'y', gridLineType: type },
      });
    }
  }
}

/**
 * Densify each spec into `scratch`, project once, and append flat-coord
 * `LineString` features to `out`.
 */
export function emitFlatLineFeatures(
  out: Feature<Geometry>[],
  scratch: ProjectionScratch,
  specs: ReadonlyArray<FlatLineSpec>,
  transformFn: TransformFunction,
): void {
  if (specs.length === 0) return;
  scratch.reset();
  const offsets = new Array<number>(specs.length);
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]!;
    offsets[i] = scratch.length;
    const dx = s.endX - s.startX;
    const dy = s.endY - s.startY;
    const denom = s.npts - 1;
    const xInterp = s.xInterp;
    if (xInterp) {
      for (let k = 0; k < s.npts; k++) {
        const t = denom === 0 ? 0 : k / denom;
        scratch.push2(xInterp(s.startX, s.endX, t), s.startY + t * dy);
      }
    } else {
      for (let k = 0; k < s.npts; k++) {
        const t = denom === 0 ? 0 : k / denom;
        scratch.push2(s.startX + t * dx, s.startY + t * dy);
      }
    }
  }
  scratch.transform(transformFn);
  const baseIndex = out.length;
  out.length = baseIndex + specs.length;
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]!;
    const f = new Feature<Geometry>(s.props);
    f.setGeometry(new LineString(scratch.slice(offsets[i]!, s.npts), 'XY'));
    out[baseIndex + i] = f;
  }
}
