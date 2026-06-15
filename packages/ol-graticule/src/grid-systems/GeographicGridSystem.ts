import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { transformExtent, getTransform, transform } from 'ol/proj';
import type { TransformFunction } from 'ol/proj';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type { ProjectionLike } from 'ol/proj';
import type { GridSystem, GridLabel, IntervalStrategy, LabelFormatter, FormattedCoordinate } from '../types.js';
import { DegreeIntervals } from '../intervals/DegreeIntervals.js';
import { DegreeFormatter } from '../formatters/DegreeFormatter.js';
import { RenderCache } from '../util/renderCache.js';
import {
  emitFlatLineFeatures,
  isOnMajorLine,
  adaptiveAxisTs,
  measureTargetResolution,
  pushAxisGridLineSpecs,
  type FlatLineSpec,
} from '../util/gridlines.js';
import { ProjectionScratch } from '../util/projectionScratch.js';
import { TransformCache, transformBatchCached } from '../util/transformCache.js';
import { normalizeLon } from '../util/geo.js';
import { ParseError } from '../util/ParseError.js';
import { parsePairViaFormatter } from '../util/parseCoordinatePair.js';

const MAJOR_SKIP_EPSILON_RATIO = 0.5;

export interface GeographicGridSystemOptions {
  /** Override the default DegreeIntervals strategy */
  intervals?: IntervalStrategy | undefined;
  /** Override the default DegreeFormatter */
  formatter?: LabelFormatter | undefined;
  /** Target minimum screen pixels between grid lines (default: 100) */
  targetScreenPx?: number | undefined;
  /** Intermediate points per grid line for curved rendering (default: 50). */
  densificationPoints?: number | undefined;
}

interface RenderContext {
  target: Extent;
  interval: number;
  minorInterval: number | undefined;
  transformFn: TransformFunction;
  /** Parameter samples for vertical lines (constant lon, sweeping lat). */
  xTs: number[];
  /** Parameter samples for horizontal lines (constant lat, sweeping lon). */
  yTs: number[];
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

/** Draws a latitude/longitude graticule (EPSG:4326) on any OpenLayers view projection. */
export class GeographicGridSystem implements GridSystem {
  private readonly intervals_: IntervalStrategy;
  private readonly formatter_: LabelFormatter;
  private readonly densificationPoints_: number;

  private readonly ctxCache_ = new RenderCache<RenderContext>();
  private readonly projScratch_ = new ProjectionScratch();
  private readonly transformCache_ = new TransformCache();

  constructor(options?: GeographicGridSystemOptions) {
    const targetScreenPx = options?.targetScreenPx ?? 100;
    this.intervals_ = options?.intervals ?? new DegreeIntervals(targetScreenPx);
    this.formatter_ = options?.formatter ?? new DegreeFormatter();
    this.densificationPoints_ = options?.densificationPoints ?? 20;
  }

  getFeatures(extent: Extent, resolution: number, viewProjection: ProjectionLike): Feature<Geometry>[] {
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    const features: Feature<Geometry>[] = [];

    this.generateLines_(features, ctx, ctx.interval, 'major');
    if (ctx.minorInterval !== undefined) {
      this.generateLines_(features, ctx, ctx.minorInterval, 'minor', ctx.interval);
    }
    return features;
  }

  getLabels(extent: Extent, resolution: number, viewProjection: ProjectionLike): GridLabel[] {
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    const { target, interval, transformFn, startX, endX, startY, endY } = ctx;
    const [tMinX, , , tMaxY] = target;
    const labels: GridLabel[] = [];

    const xCount = Math.max(0, Math.floor((endX - startX) / interval) + 1);
    const yCount = Math.max(0, Math.floor((endY - startY) / interval) + 1);
    if (xCount === 0 && yCount === 0) return labels;

    const flat: number[] = new Array((xCount + yCount) * 2);
    for (let i = 0; i < xCount; i++) {
      flat[i * 2] = startX + i * interval;
      flat[i * 2 + 1] = tMaxY;
    }
    const yBase = xCount * 2;
    for (let i = 0; i < yCount; i++) {
      flat[yBase + i * 2] = tMinX;
      flat[yBase + i * 2 + 1] = startY + i * interval;
    }
    transformBatchCached(flat, flat, 2, transformFn, this.transformCache_);

    for (let i = 0; i < xCount; i++) {
      labels.push({
        point: new Point([flat[i * 2]!, flat[i * 2 + 1]!]),
        text: this.formatter_.format(normalizeLon(startX + i * interval), 'x'),
        axis: 'x',
      });
    }
    for (let i = 0; i < yCount; i++) {
      labels.push({
        point: new Point([flat[yBase + i * 2]!, flat[yBase + i * 2 + 1]!]),
        text: this.formatter_.format(startY + i * interval, 'y'),
        axis: 'y',
      });
    }
    return labels;
  }

  formatCoordinate(coordinate: [number, number], viewProjection: ProjectionLike): FormattedCoordinate {
    const toDeg = getTransform(viewProjection, 'EPSG:4326');
    const [rawLon, lat] = toDeg(coordinate, undefined, 2);
    if (rawLon === undefined || lat === undefined) {
      return { x: '-', y: '-' };
    }
    const lon = normalizeLon(rawLon);
    if (this.formatter_.formatCoordinate) {
      return this.formatter_.formatCoordinate(lon, lat);
    }
    return {
      x: this.formatter_.format(lon, 'x'),
      y: this.formatter_.format(lat, 'y'),
    };
  }

  parseCoordinate(text: string, viewProjection: ProjectionLike): [number, number] {
    const [lon, lat] = parsePairViaFormatter(this.formatter_, text);
    const projected = transform([lon, lat], 'EPSG:4326', viewProjection);
    const px = projected[0];
    const py = projected[1];
    if (px === undefined || py === undefined || !Number.isFinite(px) || !Number.isFinite(py)) {
      throw new ParseError(text, 'transform produced non-finite coordinate');
    }
    return [px, py];
  }

  private renderContext_(extent: Extent, resolution: number, viewProjection: ProjectionLike): RenderContext {
    return this.ctxCache_.get(extent, resolution, viewProjection, () => {
      const target = transformExtent(extent, viewProjection, 'EPSG:4326');
      const transformFn = getTransform('EPSG:4326', viewProjection);
      const fallback = target[2] - target[0];
      const targetResolution = measureTargetResolution(target, transformFn, resolution) ?? fallback;
      const interval = this.intervals_.getInterval(targetResolution, viewProjection);
      const minorInterval = this.intervals_.getMinorInterval?.(interval);

      // Place points only where lines curve in view: in a Mercator view lat/lon
      // lines are axis-aligned and collapse to 2 points; oblique or wide views
      // bend them.
      const cap = this.densificationPoints_;
      const xTs = adaptiveAxisTs('x', target, transformFn, resolution, cap);
      const yTs = adaptiveAxisTs('y', target, transformFn, resolution, cap);

      const startX = Math.ceil(target[0] / interval) * interval;
      const endX = Math.floor(target[2] / interval) * interval;
      const startY = Math.ceil(target[1] / interval) * interval;
      const endY = Math.floor(target[3] / interval) * interval;

      return { target, interval, minorInterval, transformFn, xTs, yTs, startX, endX, startY, endY };
    });
  }

  private generateLines_(
    features: Feature<Geometry>[],
    ctx: RenderContext,
    interval: number,
    type: 'major' | 'minor',
    majorInterval?: number,
  ): void {
    const { transformFn, xTs, yTs, target } = ctx;
    const [tMinX, tMinY, tMaxX, tMaxY] = target;
    const startX = Math.ceil(tMinX / interval) * interval;
    const endX = Math.floor(tMaxX / interval) * interval;
    const startY = Math.ceil(tMinY / interval) * interval;
    const endY = Math.floor(tMaxY / interval) * interval;

    const epsilon = interval * MAJOR_SKIP_EPSILON_RATIO;
    const onMajor = (v: number): boolean =>
      majorInterval !== undefined && isOnMajorLine(v, majorInterval, epsilon);

    const specs: FlatLineSpec[] = [];
    const skip = type === 'minor' ? onMajor : undefined;
    pushAxisGridLineSpecs(specs, 'x', startX, endX, interval, tMinY, tMaxY, xTs, type, skip);
    pushAxisGridLineSpecs(specs, 'y', startY, endY, interval, tMinX, tMaxX, yTs, type, skip);
    emitFlatLineFeatures(features, this.projScratch_, specs, transformFn);
  }
}
