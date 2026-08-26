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

const AXIS_PROBE_BUCKETS = 8;

/** The coarse probe under-counts a hook sharp within one bucket; bias points up to stay sub-pixel. */
const HOOK_OVERSAMPLE = 1.6;

/**
 * Sample parameters (`t` from 0 to 1) for densifying every grid line of one
 * axis, clustering points where the lines bend in view and using just `[0, 1]`
 * where they stay straight.
 *
 * Every line on an axis bends the same way (all constant-easting lines hook at
 * the same northing), so we probe the curve once and reuse the result for the
 * whole axis. The sweep is split into buckets; each bucket gets points in
 * proportion to how far its segment sags in view, so a sharp hook is sampled
 * densely without over-sampling the straight stretches.
 *
 * `axis: 'x'` sizes vertical lines (constant x, sweeping y), `axis: 'y'`
 * horizontal. `transformFn` maps CRS to view, `resolution` is view units per
 * pixel, `cap` bounds the point count.
 */
export function adaptiveAxisTs(
  axis: 'x' | 'y',
  extent: Extent,
  transformFn: TransformFunction,
  resolution: number,
  cap: number,
  // Max view-space deviation of the densified polyline from the true curve.
  maxDevPx = 0.5,
): number[] {
  const tol = maxDevPx * resolution;
  const sag = probeAxisSag(axis, extent, transformFn);
  // Points per bucket scale with √(sag / tol): sag shrinks with spacing².
  const pointsPerBucket = sag.map((s) => HOOK_OVERSAMPLE * Math.sqrt(s / tol));
  const total = pointsPerBucket.reduce((a, b) => a + b, 0);
  if (total <= 1) return [0, 1]; // straight (or degenerate): just the endpoints
  const count = Math.min(cap, Math.ceil(total));
  return distributeByDensity(pointsPerBucket, count);
}

/** Max view-space sag of each curvature bucket, probed on three representative lines of the axis. */
function probeAxisSag(
  axis: 'x' | 'y',
  extent: Extent,
  transformFn: TransformFunction,
): number[] {
  const [minX, minY, maxX, maxY] = extent;
  const probeConsts = axis === 'x'
    ? [minX, (minX + maxX) / 2, maxX]
    : [minY, (minY + maxY) / 2, maxY];
  const sweepStart = axis === 'x' ? minY : minX;
  const sweepEnd = axis === 'x' ? maxY : maxX;
  const buckets = AXIS_PROBE_BUCKETS;
  const sampleCount = buckets * 2 + 1;
  const probeBuffer = new Array<number>(sampleCount * 2);
  const sag = new Array<number>(buckets).fill(0);

  for (const constValue of probeConsts) {
    for (let k = 0; k < sampleCount; k++) {
      const t = sweepStart + (sweepEnd - sweepStart) * (k / (sampleCount - 1));
      probeBuffer[k * 2] = axis === 'x' ? constValue : t;
      probeBuffer[k * 2 + 1] = axis === 'x' ? t : constValue;
    }
    transformFn(probeBuffer, probeBuffer, 2);
    for (let b = 0; b < buckets; b++) {
      // each bucket spans 3 consecutive samples: start, mid, end
      const x0 = probeBuffer[4 * b], y0 = probeBuffer[4 * b + 1];
      const xm = probeBuffer[4 * b + 2], ym = probeBuffer[4 * b + 3];
      const x1 = probeBuffer[4 * b + 4], y1 = probeBuffer[4 * b + 5];
      if (x0 === undefined || y0 === undefined || xm === undefined || ym === undefined ||
          x1 === undefined || y1 === undefined ||
          !Number.isFinite(x0) || !Number.isFinite(xm) || !Number.isFinite(x1)) {
        continue;
      }
      // sag: how far the mid sample bows off the start-to-end chord (its curvature)
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const bucketSag = len < 1e-9
        ? Math.hypot(xm - x0, ym - y0)
        : Math.abs(dx * (ym - y0) - dy * (xm - x0)) / len;
      if (bucketSag > (sag[b] ?? 0)) sag[b] = bucketSag;
    }
  }
  return sag;
}

/** Place `count` samples (t in [0, 1]) across the buckets in proportion to `weights`. */
function distributeByDensity(weights: number[], count: number): number[] {
  const buckets = weights.length;
  const cumulative = [0];
  let running = 0;
  for (const w of weights) { running += w; cumulative.push(running); }
  const total = running;

  const ts = [0];
  for (let j = 1; j < count; j++) {
    const target = (j * total) / count;
    let b = 0;
    while (b < buckets - 1 && (cumulative[b + 1] ?? Infinity) < target) b++;
    const lo = cumulative[b] ?? 0;
    const span = (cumulative[b + 1] ?? lo) - lo;
    const within = span > 1e-12 ? (target - lo) / span : 0;
    ts.push((b + within) / buckets);
  }
  ts.push(1);
  return ts;
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

/** Evenly-spaced parameter samples `[0, 1/n, …, 1]` for `n` segments (n ≥ 1). */
export function uniformTs(segments: number): number[] {
  const n = Math.max(1, Math.floor(segments));
  return Array.from({ length: n + 1 }, (_, i) => i / n);
}

/** One line in a batch passed to {@link emitFlatLineFeatures}. */
export interface FlatLineSpec {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Parameter samples (0..1) at which to densify this line; from {@link adaptiveAxisTs} or {@link uniformTs}. */
  ts: number[];
  /** Properties applied to the resulting Feature. */
  props: Record<string, unknown>;
  /** Optional non-linear x-interp (e.g. antimeridian-aware longitude). Default linear. */
  xInterp?: (a: number, b: number, t: number) => number;
}

/**
 * Append axis-aligned grid-line specs from `start` to `end` at `interval`
 * spacing, each densified at the shared `ts` samples (one array per axis from
 * {@link adaptiveAxisTs}). `axis: 'x'` produces vertical lines (constant x,
 * sweeping y); `axis: 'y'` produces horizontal lines. `skip` returns true to
 * drop a position (e.g. minor coincides with major).
 */
export function pushAxisGridLineSpecs(
  specs: FlatLineSpec[],
  axis: 'x' | 'y',
  start: number,
  end: number,
  interval: number,
  perpStart: number,
  perpEnd: number,
  ts: number[],
  type: 'major' | 'minor',
  skip?: (v: number) => boolean,
): void {
  for (let v = start; v <= end; v += interval) {
    if (skip?.(v)) continue;
    if (axis === 'x') {
      specs.push({
        startX: v, startY: perpStart,
        endX: v, endY: perpEnd,
        ts,
        props: { gridValue: v, gridAxis: 'x', gridLineType: type },
      });
    } else {
      specs.push({
        startX: perpStart, startY: v,
        endX: perpEnd, endY: v,
        ts,
        props: { gridValue: v, gridAxis: 'y', gridLineType: type },
      });
    }
  }
}

/**
 * Densify each spec at its own `ts` samples, project once (batched), and append
 * flat-coord `LineString` features to `out`. With per-axis `ts` from
 * {@link adaptiveAxisTs}, points cluster where a line curves and collapse to 2
 * where it's straight.
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
  const counts = new Array<number>(specs.length);
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]!;
    offsets[i] = scratch.length;
    counts[i] = s.ts.length;
    const dx = s.endX - s.startX;
    const dy = s.endY - s.startY;
    const xInterp = s.xInterp;
    for (const t of s.ts) {
      scratch.push2(
        xInterp ? xInterp(s.startX, s.endX, t) : s.startX + t * dx,
        s.startY + t * dy,
      );
    }
  }
  scratch.transform(transformFn);
  const baseIndex = out.length;
  out.length = baseIndex + specs.length;
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]!;
    const f = new Feature<Geometry>(s.props);
    f.setGeometry(new LineString(scratch.slice(offsets[i]!, counts[i]!), 'XY'));
    out[baseIndex + i] = f;
  }
}

