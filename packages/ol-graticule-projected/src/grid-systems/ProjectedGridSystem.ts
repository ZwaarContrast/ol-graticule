import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { get as getProjection } from 'ol/proj';
import { transform, getTransform } from 'ol/proj';
import { getIntersection, isEmpty } from 'ol/extent';
import type { TransformFunction } from 'ol/proj';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type { ProjectionLike } from 'ol/proj';
import type {
  GridSystem,
  GridLabel,
  GridCellLabel,
  IntervalStrategy,
  LabelFormatter,
  FormattedCoordinate,
  FlatLineSpec,
} from '@zwaarcontrast/ol-graticule';
import {
  DegreeIntervals,
  DegreeFormatter,
  MetricIntervals,
  MetricFormatter,
  ProjectionScratch,
  ParseError,
  RenderCache,
  TransformCache,
  emitFlatLineFeatures,
  isOnMajorLine,
  adaptiveAxisTs,
  measureTargetResolution,
  parsePairViaFormatter,
  pushAxisGridLineSpecs,
  transformBatchCached,
  transformExtentSampled,
} from '@zwaarcontrast/ol-graticule';
import { registerCRS } from '../registerCRS.js';
import { LineTransformCache, type LinePolyline } from './lineTransformCache.js';

export interface ProjectedGridSystemOptions {
  /** The target CRS code, e.g. 'EPSG:4326', 'EPSG:27500', 'EPSG:32633' */
  crs: string;
  /**
   * Optional proj4 definition string. If provided, the constructor calls
   * {@link registerCRS} for you (idempotent).
   *
   * Prefer calling `registerCRS(code, proj4Def)` once at application startup
   *, passing it here is a convenience shortcut that still does the same
   * registration exactly once per unique `(code, def)` pair.
   *
   * If omitted, the CRS must already be registered with OL, either built in
   * (EPSG:4326, EPSG:3857) or registered by the host app before the first
   * render.
   */
  proj4Def?: string | undefined;
  /** Override the default interval strategy (auto-detected from CRS units) */
  intervals?: IntervalStrategy | undefined;
  /** Override the default label formatter (auto-detected from CRS units) */
  formatter?: LabelFormatter | undefined;
  /**
   * Maximum points per grid line. Densification is adaptive: straight lines
   * collapse to 2 points, curved lines climb toward this cap. Default: 512.
   */
  densificationPoints?: number | undefined;
  /** Target minimum screen pixels between grid lines (default: 100) */
  targetScreenPx?: number | undefined;
  /**
   * Valid extent for the CRS in its native coordinates [minX, minY, maxX, maxY].
   * Grid lines are clipped to this extent to prevent distorted coordinates
   * outside the CRS's defined bounds.
   *
   * Stored *on this grid-system instance only*, unlike the earlier design,
   * we no longer mutate the shared OL projection, so two `ProjectedGridSystem`
   * instances using the same CRS can declare different effective extents.
   *
   * If omitted, falls back to the projection's built-in extent (if any).
   *
   * For irregular (non-rectangular) coverage areas, wrap this grid system in
   * `PolygonClippedGridSystem` from `@zwaarcontrast/ol-graticule`.
   */
  extent?: Extent | undefined;
  /**
   * Emit the extent rectangle as a `gridLineType: 'boundary'` feature.
   * Defaults to true when `extent` is supplied, false otherwise.
   */
  emitBoundary?: boolean | undefined;
}

interface RenderContext {
  targetExtent: Extent;
  interval: number;
  minorInterval: number | undefined;
  /** Interval on which cell labels are enumerated; falls back to `interval`. */
  cellInterval: number;
  transformFn: TransformFunction;
  /** Parameter samples for vertical lines (constant x, sweeping y). */
  xTs: number[];
  /** Parameter samples for horizontal lines (constant y, sweeping x). */
  yTs: number[];
  /** Zoom band (floor-log2 of view resolution); NaN when uncacheable. */
  band: number;
  /** View resolution at the band's fine edge; drives cached-line sampling. */
  bandResolution: number;
}

// Minor lines within half an interval of a major line are dropped (FP drift slack).
const MAJOR_SKIP_EPSILON_RATIO = 0.5;

// A cached line is sampled over the viewport perp-span grown by this fraction on
// each side, so the viewport can pan ~one span in either direction before the
// window is exceeded and the line re-projected. 1.0 → a 3x-viewport window.
const WINDOW_MARGIN_RATIO = 1.0;

export class ProjectedGridSystem implements GridSystem {
  private readonly crs_: string;
  private readonly intervals_: IntervalStrategy;
  private readonly formatter_: LabelFormatter;
  /** Max uniform segments per grid line (cap on adaptive densification). */
  private readonly densificationPoints_: number;
  /** CRS-space extent override (see {@link ProjectedGridSystemOptions.extent}). */
  private readonly extent_: Extent | undefined;
  private readonly emitBoundary_: boolean;

  /** Memoized render context for the last `(extent, resolution, projection)`. */
  private readonly ctxCache_ = new RenderCache<RenderContext | null>();
  private readonly projScratch_ = new ProjectionScratch();
  private readonly transformCache_ = new TransformCache();
  /** Per-line transformed-polyline cache; reused across pan within a zoom band. */
  private readonly lineCache_ = new LineTransformCache();

  constructor(options: ProjectedGridSystemOptions) {
    this.crs_ = options.crs;
    this.densificationPoints_ = options.densificationPoints ?? 512;
    this.extent_ = options.extent;
    this.emitBoundary_ = options.emitBoundary ?? (options.extent !== undefined);

    if (options.proj4Def !== undefined) {
      registerCRS(this.crs_, options.proj4Def);
    }

    const projection = getProjection(this.crs_);
    if (!projection) {
      throw new Error(
        `CRS ${this.crs_} is not registered. Call registerCRS(code, proj4Def) ` +
        `before constructing ProjectedGridSystem, or pass proj4Def in the options.`,
      );
    }

    const units = projection.getUnits();
    const targetScreenPx = options.targetScreenPx ?? 100;

    if (units === 'degrees') {
      this.intervals_ = options.intervals ?? new DegreeIntervals(targetScreenPx);
      this.formatter_ = options.formatter ?? new DegreeFormatter();
    } else {
      // Linear units (metres, feet, US-survey-feet). `MetricIntervals`'
      // numeric table is interpreted as CRS-native units, so foot-based
      // grids get foot-spaced lines natively; only the label unit differs.
      // Prefer OL's classified `getUnits()`, fall back to `getMetersPerUnit()`
      // for projections defined via `+to_meter=...` where units is blank.
      let displayUnit: 'm' | 'ft' | 'us-ft' = 'm';
      if (units === 'ft' || units === 'us-ft') {
        displayUnit = units;
      } else {
        const mpu = projection.getMetersPerUnit() ?? 1;
        // US survey foot: 1200/3937 ≈ 0.30480060960121924.
        // International foot: exactly 0.3048.
        if (Math.abs(mpu - 0.30480060960121924) < 1e-10) displayUnit = 'us-ft';
        else if (Math.abs(mpu - 0.3048) < 1e-5) displayUnit = 'ft';
      }

      this.intervals_ = options.intervals ?? new MetricIntervals(targetScreenPx);
      this.formatter_ = options.formatter ?? new MetricFormatter({ unit: displayUnit });
    }
  }

  getFeatures(extent: Extent, resolution: number, viewProjection: ProjectionLike): Feature<Geometry>[] {
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    if (!ctx) return [];
    const features: Feature<Geometry>[] = [];

    // Cached path: bounded CRS + a finite zoom band, so each line's transformed
    // polyline can be memoised per (axis, gridValue, band) and re-sliced across
    // pan instead of re-running proj4 every frame. Unbounded CRS (no full extent
    // to window over) falls back to the per-frame transform.
    const crsExtent = this.effectiveExtent_();
    if (crsExtent && Number.isFinite(ctx.band)) {
      this.lineCache_.ensureProjection(projectionKey(viewProjection));
      this.generateLinesCached_(features, ctx, crsExtent, ctx.interval, 'major');
      if (ctx.minorInterval !== undefined) {
        this.generateLinesCached_(features, ctx, crsExtent, ctx.minorInterval, 'minor', ctx.interval);
      }
      if (this.emitBoundary_) {
        this.generateBoundary_(features, ctx);
      }
      return features;
    }

    this.generateLines_(features, ctx, ctx.interval, 'major');
    if (ctx.minorInterval !== undefined) {
      this.generateLines_(features, ctx, ctx.minorInterval, 'minor', ctx.interval);
    }
    if (this.emitBoundary_) {
      this.generateBoundary_(features, ctx);
    }
    return features;
  }

  getLabels(extent: Extent, resolution: number, viewProjection: ProjectionLike): GridLabel[] {
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    if (!ctx) return [];
    const labels: GridLabel[] = [];
    const [tMinX, tMinY, tMaxX, tMaxY] = ctx.targetExtent;
    const { interval, transformFn } = ctx;

    const startX = Math.ceil(tMinX / interval) * interval;
    const endX = Math.floor(tMaxX / interval) * interval;
    const startY = Math.ceil(tMinY / interval) * interval;
    const endY = Math.floor(tMaxY / interval) * interval;

    const xVals: number[] = [];
    for (let x = startX; x <= endX; x += interval) xVals.push(x);
    const yVals: number[] = [];
    for (let y = startY; y <= endY; y += interval) yVals.push(y);
    if (xVals.length === 0 && yVals.length === 0) return labels;

    const flat: number[] = new Array((xVals.length + yVals.length) * 2);
    for (let i = 0; i < xVals.length; i++) {
      flat[i * 2] = xVals[i]!;
      flat[i * 2 + 1] = tMaxY;
    }
    const yBase = xVals.length * 2;
    for (let i = 0; i < yVals.length; i++) {
      flat[yBase + i * 2] = tMinX;
      flat[yBase + i * 2 + 1] = yVals[i]!;
    }
    transformBatchCached(flat, flat, 2, transformFn, this.transformCache_);

    for (let i = 0; i < xVals.length; i++) {
      const value = xVals[i]!;
      const label: GridLabel = {
        point: new Point([flat[i * 2]!, flat[i * 2 + 1]!]),
        text: this.formatter_.format(value, 'x'),
        axis: 'x',
      };
      labels.push(label);
    }
    for (let i = 0; i < yVals.length; i++) {
      const value = yVals[i]!;
      const label: GridLabel = {
        point: new Point([flat[yBase + i * 2]!, flat[yBase + i * 2 + 1]!]),
        text: this.formatter_.format(value, 'y'),
        axis: 'y',
      };
      labels.push(label);
    }
    return labels;
  }

  getCellLabels(extent: Extent, resolution: number, viewProjection: ProjectionLike): GridCellLabel[] {
    if (!this.formatter_.formatCellLabel) return [];
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    if (!ctx) return [];

    const [tMinX, tMinY, tMaxX, tMaxY] = ctx.targetExtent;
    const { cellInterval, transformFn } = ctx;
    const labels: GridCellLabel[] = [];

    // Cell size in pixels, measured at the first cell's bottom edge.
    const [c1x, c1y] = transformFn([tMinX, tMinY], undefined, 2);
    const [c2x, c2y] = transformFn([tMinX + cellInterval, tMinY], undefined, 2);
    const cellSizePx = Math.hypot((c2x ?? 0) - (c1x ?? 0), (c2y ?? 0) - (c1y ?? 0)) / resolution;

    const startX = Math.floor(tMinX / cellInterval) * cellInterval;
    const startY = Math.floor(tMinY / cellInterval) * cellInterval;
    const nCellsX = Math.ceil((tMaxX - startX) / cellInterval);
    const nCellsY = Math.ceil((tMaxY - startY) / cellInterval);

    const texts: string[] = [];
    const flat: number[] = [];
    for (let ix = 0; ix < nCellsX; ix++) {
      const x = startX + ix * cellInterval;
      for (let iy = 0; iy < nCellsY; iy++) {
        const y = startY + iy * cellInterval;
        const midX = x + cellInterval / 2;
        const midY = y + cellInterval / 2;
        const text = this.formatter_.formatCellLabel(midX, midY);
        if (!text) continue;
        texts.push(text);
        flat.push(midX, midY);
      }
    }
    if (texts.length === 0) return labels;

    transformBatchCached(flat, flat, 2, transformFn, this.transformCache_);
    for (let i = 0; i < texts.length; i++) {
      labels.push({
        point: new Point([flat[i * 2]!, flat[i * 2 + 1]!]),
        text: texts[i]!,
        cellSizePx,
      });
    }
    return labels;
  }

  isValidCoordinate(coordinate: [number, number], viewProjection: ProjectionLike): boolean {
    const [cx, cy] = coordinate;
    if (!isFinite(cx) || !isFinite(cy)) return false;

    // proj4 can throw on numerically pathological inputs (points at infinity,
    // undefined on exotic projections). Treat those as "not valid", the
    // alternative is to propagate the error up to pointermove handlers.
    let x: number;
    let y: number;
    try {
      const [tx, ty] = transform(coordinate, viewProjection, this.crs_);
      if (tx === undefined || ty === undefined) return false;
      x = tx;
      y = ty;
    } catch {
      return false;
    }
    if (!isFinite(x) || !isFinite(y)) return false;

    const crsExtent = this.effectiveExtent_();
    if (crsExtent) {
      if (x < crsExtent[0] || x > crsExtent[2] || y < crsExtent[1] || y > crsExtent[3]) {
        return false;
      }
    }

    return true;
  }

  formatCoordinate(coordinate: [number, number], viewProjection: ProjectionLike): FormattedCoordinate {
    if (!this.isValidCoordinate(coordinate, viewProjection)) {
      return { x: '-', y: '-' };
    }
    const [tx, ty] = transform(coordinate, viewProjection, this.crs_);
    if (tx === undefined || ty === undefined) return { x: '-', y: '-' };
    if (this.formatter_.formatCoordinate) {
      return this.formatter_.formatCoordinate(tx, ty);
    }
    return {
      x: this.formatter_.format(tx, 'x'),
      y: this.formatter_.format(ty, 'y'),
    };
  }

  parseCoordinate(text: string, viewProjection: ProjectionLike): [number, number] {
    const [cx, cy] = parsePairViaFormatter(this.formatter_, text);
    const projected = transform([cx, cy], this.crs_, viewProjection);
    const px = projected[0];
    const py = projected[1];
    if (px === undefined || py === undefined || !Number.isFinite(px) || !Number.isFinite(py)) {
      throw new ParseError(text, 'transform produced non-finite coordinate');
    }
    return [px, py];
  }

  private effectiveExtent_(): Extent | undefined {
    if (this.extent_) return this.extent_;
    return getProjection(this.crs_)?.getExtent() ?? undefined;
  }

  /** Null when the view is entirely outside the CRS's valid extent. */
  private renderContext_(extent: Extent, resolution: number, viewProjection: ProjectionLike): RenderContext | null {
    return this.ctxCache_.get(extent, resolution, viewProjection, () => {
      const viewToCrs = getTransform(viewProjection, this.crs_);
      const crsToView = getTransform(this.crs_, viewProjection);

      let targetExtent = transformExtentSampled(extent, viewToCrs);
      if (!isFinite(targetExtent[0]) || !isFinite(targetExtent[1]) ||
          !isFinite(targetExtent[2]) || !isFinite(targetExtent[3])) {
        return null;
      }

      const crsExtent = this.effectiveExtent_();
      if (crsExtent) {
        targetExtent = getIntersection(targetExtent, crsExtent);
        if (isEmpty(targetExtent)) return null;
      }

      // Fallback to the view's pixel resolution if the viewport→CRS transform
      // collapses to zero width at every sampled corner.
      const targetResolution =
        measureTargetResolution(targetExtent, crsToView, resolution) ?? resolution;

      const interval = this.intervals_.getInterval(targetResolution, viewProjection);
      const minorInterval = this.intervals_.getMinorInterval?.(interval);
      const cellInterval =
        this.intervals_.getCellInterval?.(targetResolution, viewProjection) ?? interval;

      const cap = this.densificationPoints_;
      const xTs = adaptiveAxisTs('x', targetExtent, crsToView, resolution, cap);
      const yTs = adaptiveAxisTs('y', targetExtent, crsToView, resolution, cap);

      // Sampling density is stable within a factor-2 zoom band.
      const band =
        Number.isFinite(resolution) && resolution > 0 ? Math.floor(Math.log2(resolution)) : NaN;
      const bandResolution = Number.isFinite(band) ? 2 ** band : resolution;

      return {
        targetExtent, interval, minorInterval, cellInterval,
        transformFn: crsToView, xTs, yTs, band, bandResolution,
      };
    });
  }

  private generateLines_(
    features: Feature<Geometry>[],
    ctx: RenderContext,
    interval: number,
    type: 'major' | 'minor',
    majorInterval?: number | undefined,
  ): void {
    const [tMinX, tMinY, tMaxX, tMaxY] = ctx.targetExtent;
    const startX = Math.ceil(tMinX / interval) * interval;
    const endX = Math.floor(tMaxX / interval) * interval;
    const startY = Math.ceil(tMinY / interval) * interval;
    const endY = Math.floor(tMaxY / interval) * interval;

    const epsilon = interval * MAJOR_SKIP_EPSILON_RATIO;

    const skipMinor = (v: number): boolean =>
      type === 'minor' && majorInterval !== undefined && isOnMajorLine(v, majorInterval, epsilon);

    const specs: FlatLineSpec[] = [];
    pushAxisGridLineSpecs(specs, 'x', startX, endX, interval, tMinY, tMaxY, ctx.xTs, type, skipMinor);
    pushAxisGridLineSpecs(specs, 'y', startY, endY, interval, tMinX, tMaxX, ctx.yTs, type, skipMinor);
    emitFlatLineFeatures(features, this.projScratch_, specs, ctx.transformFn);
  }

  /** Cached counterpart of {@link generateLines_}: one polyline per line, reused. */
  private generateLinesCached_(
    features: Feature<Geometry>[],
    ctx: RenderContext,
    crsExtent: Extent,
    interval: number,
    type: 'major' | 'minor',
    majorInterval?: number | undefined,
  ): void {
    const [tMinX, tMinY, tMaxX, tMaxY] = ctx.targetExtent;
    const epsilon = interval * MAJOR_SKIP_EPSILON_RATIO;
    const skipMinor = (v: number): boolean =>
      type === 'minor' && majorInterval !== undefined && isOnMajorLine(v, majorInterval, epsilon);

    // Vertical lines (constant x): grid values sweep x, the line sweeps y.
    this.cachedAxis_(
      features, ctx, 'x', type, skipMinor, interval,
      tMinX, tMaxX, tMinY, tMaxY, crsExtent[1], crsExtent[3],
    );
    // Horizontal lines (constant y): grid values sweep y, the line sweeps x.
    this.cachedAxis_(
      features, ctx, 'y', type, skipMinor, interval,
      tMinY, tMaxY, tMinX, tMaxX, crsExtent[0], crsExtent[2],
    );
  }

  /**
   * Emit every grid line of one axis from the cache. `gvMin..gvMax` is the
   * visible grid-value range (the constant axis), `vMin..vMax` the viewport span
   * of the swept (perp) axis, `extMin..extMax` the CRS validity on the perp axis.
   * A line not covered by its cached window (new line, band change, or a pan past
   * the margin) is re-sampled over a viewport-plus-margin window and re-projected.
   */
  private cachedAxis_(
    features: Feature<Geometry>[],
    ctx: RenderContext,
    axis: 'x' | 'y',
    type: 'major' | 'minor',
    skip: (v: number) => boolean,
    interval: number,
    gvMin: number, gvMax: number,
    vMin: number, vMax: number,
    extMin: number, extMax: number,
  ): void {
    const start = Math.ceil(gvMin / interval) * interval;
    const end = Math.floor(gvMax / interval) * interval;
    if (start > end) return;

    // Window + shared densification samples, computed once per axis on first miss.
    let wMin = 0;
    let wMax = 0;
    let ts: number[] | null = null;
    const ensureWindow = (): number[] => {
      if (ts === null) {
        const margin = (vMax - vMin) * WINDOW_MARGIN_RATIO;
        wMin = Math.max(extMin, vMin - margin);
        wMax = Math.min(extMax, vMax + margin);
        if (wMax <= wMin) {
          wMin = Math.max(extMin, vMin);
          wMax = Math.min(extMax, vMax);
        }
        const windowExtent: Extent =
          axis === 'x' ? [gvMin, wMin, gvMax, wMax] : [wMin, gvMin, wMax, gvMax];
        ts = adaptiveAxisTs(
          axis, windowExtent, ctx.transformFn, ctx.bandResolution, this.densificationPoints_,
        );
      }
      return ts;
    };

    for (let v = start; v <= end; v += interval) {
      if (skip(v)) continue;
      const key = `${axis}${v}`;
      let entry = this.lineCache_.get(key, ctx.band, vMin, vMax);
      if (entry === undefined) {
        // ensureWindow() populates wMin/wMax, so call it before reading them.
        const windowTs = ensureWindow();
        entry = buildLineWindow(axis, v, ctx.band, wMin, wMax, windowTs, ctx.transformFn);
        this.lineCache_.set(key, entry);
      }
      features.push(sliceLineFeature(entry, axis, v, type, vMin, vMax));
    }
  }

  private generateBoundary_(features: Feature<Geometry>[], ctx: RenderContext): void {
    const crsExtent = this.effectiveExtent_();
    if (!crsExtent) return;
    const [cMinX, cMinY, cMaxX, cMaxY] = crsExtent;
    const [tMinX, tMinY, tMaxX, tMaxY] = ctx.targetExtent;
    // Vertical edges (constant x) sweep y like x-axis lines; horizontal edges
    // (constant y) sweep x like y-axis lines.
    const specs: FlatLineSpec[] = [];
    if (tMinX === cMinX) {
      specs.push({
        startX: cMinX, startY: tMinY, endX: cMinX, endY: tMaxY, ts: ctx.xTs,
        props: { gridValue: cMinX, gridAxis: 'x', gridLineType: 'boundary' },
      });
    }
    if (tMaxX === cMaxX) {
      specs.push({
        startX: cMaxX, startY: tMinY, endX: cMaxX, endY: tMaxY, ts: ctx.xTs,
        props: { gridValue: cMaxX, gridAxis: 'x', gridLineType: 'boundary' },
      });
    }
    if (tMinY === cMinY) {
      specs.push({
        startX: tMinX, startY: cMinY, endX: tMaxX, endY: cMinY, ts: ctx.yTs,
        props: { gridValue: cMinY, gridAxis: 'y', gridLineType: 'boundary' },
      });
    }
    if (tMaxY === cMaxY) {
      specs.push({
        startX: tMinX, startY: cMaxY, endX: tMaxX, endY: cMaxY, ts: ctx.yTs,
        props: { gridValue: cMaxY, gridAxis: 'y', gridLineType: 'boundary' },
      });
    }
    if (specs.length > 0) {
      emitFlatLineFeatures(features, this.projScratch_, specs, ctx.transformFn);
    }
  }
}

/** Stable string key for a view projection, for cache invalidation. */
function projectionKey(projection: ProjectionLike): string {
  return typeof projection === 'string' ? projection : (projection?.getCode() ?? '');
}

/**
 * Sample line `(axis, gridValue)` across `[wMin, wMax]` at `ts` and project it
 * once into a {@link LinePolyline}. `perps` (the CRS perp positions) are kept so
 * a later frame can slice the polyline to a narrower viewport without re-probing.
 */
function buildLineWindow(
  axis: 'x' | 'y',
  gridValue: number,
  band: number,
  wMin: number,
  wMax: number,
  ts: number[],
  transformFn: TransformFunction,
): LinePolyline {
  const n = ts.length;
  const perps = new Array<number>(n);
  const coords = new Array<number>(n * 2);
  const span = wMax - wMin;
  for (let i = 0; i < n; i++) {
    const p = wMin + ts[i]! * span;
    perps[i] = p;
    if (axis === 'x') {
      coords[i * 2] = gridValue;
      coords[i * 2 + 1] = p;
    } else {
      coords[i * 2] = p;
      coords[i * 2 + 1] = gridValue;
    }
  }
  transformFn(coords, coords, 2);
  return { band, pMin: wMin, pMax: wMax, perps, coords };
}

/**
 * Slice a cached polyline to the samples spanning `[vMin, vMax]` (one point kept
 * beyond each edge so the line reaches the viewport border) and wrap it in a
 * grid-line feature. `perps` is ascending, so the bounds are a linear walk.
 */
function sliceLineFeature(
  entry: LinePolyline,
  axis: 'x' | 'y',
  gridValue: number,
  type: 'major' | 'minor',
  vMin: number,
  vMax: number,
): Feature<Geometry> {
  const { perps, coords } = entry;
  const n = perps.length;
  let lo = 0;
  while (lo + 1 < n && perps[lo + 1]! <= vMin) lo++;
  let hi = n - 1;
  while (hi - 1 >= 0 && perps[hi - 1]! >= vMax) hi--;
  if (hi < lo) hi = lo;
  const sliced = coords.slice(lo * 2, (hi + 1) * 2);
  const feature = new Feature<Geometry>({
    gridValue,
    gridAxis: axis,
    gridLineType: type,
  });
  feature.setGeometry(new LineString(sliced, 'XY'));
  return feature;
}

