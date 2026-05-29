import type Feature from 'ol/Feature';
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
  densifyCount,
  measureTargetResolution,
  parsePairViaFormatter,
  pushAxisGridLineSpecs,
  transformBatchCached,
  transformExtentSampled,
} from '@zwaarcontrast/ol-graticule';
import { registerCRS } from '../registerCRS.js';

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
   * Number of intermediate points to insert per grid line for curved rendering.
   * Higher = smoother curves, lower = better performance. Default: 100.
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
  transformFn: TransformFunction;
  densification: number;
}

// Skip minor lines that land on a major line. Projected CRS intervals can
// include awkward fractions that drift in floating-point when stepped through
//, we need a generous threshold.
const MAJOR_SKIP_EPSILON_RATIO = 0.5;

export class ProjectedGridSystem implements GridSystem {
  private readonly crs_: string;
  private readonly intervals_: IntervalStrategy;
  private readonly formatter_: LabelFormatter;
  private readonly densificationPoints_: number;
  /** CRS-space extent override (see {@link ProjectedGridSystemOptions.extent}). */
  private readonly extent_: Extent | undefined;
  private readonly emitBoundary_: boolean;

  /** Memoized render context for the last `(extent, resolution, projection)`. */
  private readonly ctxCache_ = new RenderCache<RenderContext | null>();
  private readonly projScratch_ = new ProjectionScratch();
  private readonly transformCache_ = new TransformCache();

  constructor(options: ProjectedGridSystemOptions) {
    this.crs_ = options.crs;
    this.densificationPoints_ = options.densificationPoints ?? 20;
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
        // else: keep 'm'.
      }

      this.intervals_ = options.intervals ?? new MetricIntervals(targetScreenPx);
      this.formatter_ = options.formatter ?? new MetricFormatter({ unit: displayUnit });
    }
  }

  getFeatures(extent: Extent, resolution: number, viewProjection: ProjectionLike): Feature<Geometry>[] {
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    if (!ctx) return [];
    const features: Feature<Geometry>[] = [];

    this.generateLines_(features, ctx.targetExtent, ctx.interval, 'major', ctx.transformFn, ctx.densification);
    if (ctx.minorInterval !== undefined) {
      this.generateLines_(features, ctx.targetExtent, ctx.minorInterval, 'minor', ctx.transformFn, ctx.densification, ctx.interval);
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
      labels.push({
        point: new Point([flat[i * 2]!, flat[i * 2 + 1]!]),
        text: this.formatter_.format(xVals[i]!, 'x'),
        axis: 'x',
      });
    }
    for (let i = 0; i < yVals.length; i++) {
      labels.push({
        point: new Point([flat[yBase + i * 2]!, flat[yBase + i * 2 + 1]!]),
        text: this.formatter_.format(yVals[i]!, 'y'),
        axis: 'y',
      });
    }
    return labels;
  }

  getCellLabels(extent: Extent, resolution: number, viewProjection: ProjectionLike): GridCellLabel[] {
    if (!this.formatter_.formatCellLabel) return [];
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    if (!ctx) return [];

    const [tMinX, tMinY, tMaxX, tMaxY] = ctx.targetExtent;
    const { interval, transformFn } = ctx;
    const labels: GridCellLabel[] = [];

    // Cell size in pixels, measured at the first cell's bottom edge.
    const [c1x, c1y] = transformFn([tMinX, tMinY], undefined, 2);
    const [c2x, c2y] = transformFn([tMinX + interval, tMinY], undefined, 2);
    const cellSizePx = Math.hypot((c2x ?? 0) - (c1x ?? 0), (c2y ?? 0) - (c1y ?? 0)) / resolution;

    const startX = Math.floor(tMinX / interval) * interval;
    const startY = Math.floor(tMinY / interval) * interval;
    const nCellsX = Math.ceil((tMaxX - startX) / interval);
    const nCellsY = Math.ceil((tMaxY - startY) / interval);

    const texts: string[] = [];
    const flat: number[] = [];
    for (let ix = 0; ix < nCellsX; ix++) {
      const x = startX + ix * interval;
      for (let iy = 0; iy < nCellsY; iy++) {
        const y = startY + iy * interval;
        const midX = x + interval / 2;
        const midY = y + interval / 2;
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

      const densification = densifyCount(targetExtent, interval, this.densificationPoints_);

      return { targetExtent, interval, minorInterval, transformFn: crsToView, densification };
    });
  }

  private generateLines_(
    features: Feature<Geometry>[],
    targetExtent: Extent,
    interval: number,
    type: 'major' | 'minor',
    transformFn: TransformFunction,
    densification: number,
    majorInterval?: number | undefined,
  ): void {
    const [tMinX, tMinY, tMaxX, tMaxY] = targetExtent;
    const startX = Math.ceil(tMinX / interval) * interval;
    const endX = Math.floor(tMaxX / interval) * interval;
    const startY = Math.ceil(tMinY / interval) * interval;
    const endY = Math.floor(tMaxY / interval) * interval;

    const epsilon = interval * MAJOR_SKIP_EPSILON_RATIO;

    const skipMinor = (v: number): boolean =>
      type === 'minor' && majorInterval !== undefined && isOnMajorLine(v, majorInterval, epsilon);

    const npts = densification + 1;
    const specs: FlatLineSpec[] = [];
    pushAxisGridLineSpecs(specs, 'x', startX, endX, interval, tMinY, tMaxY, npts, type, skipMinor);
    pushAxisGridLineSpecs(specs, 'y', startY, endY, interval, tMinX, tMaxX, npts, type, skipMinor);
    emitFlatLineFeatures(features, this.projScratch_, specs, transformFn);
  }

  private generateBoundary_(features: Feature<Geometry>[], ctx: RenderContext): void {
    const crsExtent = this.effectiveExtent_();
    if (!crsExtent) return;
    const [cMinX, cMinY, cMaxX, cMaxY] = crsExtent;
    const [tMinX, tMinY, tMaxX, tMaxY] = ctx.targetExtent;
    const npts = ctx.densification + 1;
    const specs: FlatLineSpec[] = [];
    if (tMinX === cMinX) {
      specs.push({
        startX: cMinX, startY: tMinY, endX: cMinX, endY: tMaxY, npts,
        props: { gridValue: cMinX, gridAxis: 'x', gridLineType: 'boundary' },
      });
    }
    if (tMaxX === cMaxX) {
      specs.push({
        startX: cMaxX, startY: tMinY, endX: cMaxX, endY: tMaxY, npts,
        props: { gridValue: cMaxX, gridAxis: 'x', gridLineType: 'boundary' },
      });
    }
    if (tMinY === cMinY) {
      specs.push({
        startX: tMinX, startY: cMinY, endX: tMaxX, endY: cMinY, npts,
        props: { gridValue: cMinY, gridAxis: 'y', gridLineType: 'boundary' },
      });
    }
    if (tMaxY === cMaxY) {
      specs.push({
        startX: tMinX, startY: cMaxY, endX: tMaxX, endY: cMaxY, npts,
        props: { gridValue: cMaxY, gridAxis: 'y', gridLineType: 'boundary' },
      });
    }
    if (specs.length > 0) {
      emitFlatLineFeatures(features, this.projScratch_, specs, ctx.transformFn);
    }
  }
}

