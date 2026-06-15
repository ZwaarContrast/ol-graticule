/**
 * Heeresmeldenetz (HMN) grid system. Renders the orange overprint: 6 km
 * Kleinquadrate at coarse zooms, 2 km Meldetrapeze and 1 km Arbeitstrapeze
 * when zoomed in. Lines align to the DHG km lattice anchored at (CM, integer
 * 150 km Northing).
 */

import type Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type { ProjectionLike, TransformFunction } from 'ol/proj';
import { getIntersection, isEmpty } from 'ol/extent';
import { getTransform } from 'ol/proj';

import type {
  FlatLineSpec,
  FormattedCoordinate,
  GridCellLabel,
  GridLabel,
  GridSystem,
} from '@zwaarcontrast/ol-graticule';
import {
  BoundedCache,
  PolygonClippedGridSystem,
  ProjectionScratch,
  RenderCache,
  TransformCache,
  adaptiveAxisTs,
  emitFlatLineFeatures,
  measureTargetResolution,
  pushAxisGridLineSpecs,
  transformBatchCached,
  transformExtentSampled,
} from '@zwaarcontrast/ol-graticule';

import { DEFAULT_DATUM_SHIFT, registerZone } from '../dhg/projection.js';
import { stripClipPolygon, pointInsideValidity } from '../dhg/stripPolygon.js';
import type { DatumShift } from '../dhg/types.js';
import { FALSE_EASTING, STRIP_OVERLAP_DEG, zoneByKennziffer } from '../dhg/zones.js';
import {
  DHG_WORLD_BOX,
  activeZonesFor,
  cursorKey,
  toFiniteLonLat,
} from './sharedViewport.js';
import {
  HmnIntervalStrategy,
  hmnHierarchicalLabel,
} from '../heeresmeldenetz/formatter.js';
import { encodeHmn } from '../heeresmeldenetz/encode.js';
import {
  ARBEITSTRAPEZ_M,
  KLEINQUADRAT_M,
  MELDETRAPEZ_M,
} from '../heeresmeldenetz/levels.js';

export interface HmnGridSystemOptions {
  /**
   * Maximum level to render. Default `4` (Arbeitstrapez, 1 km cells).
   *
   *  - `2`: Kleinquadrat (6 km, letter pairs)
   *  - `3`: + Meldetrapez (2 km, digits 1..9)
   *  - `4`: + Arbeitstrapez (1 km, letters a..d)
   */
  maxDepth?: 2 | 3 | 4;
  /** Override WGS 84 → Bessel-Potsdam datum shift. */
  datumShift?: DatumShift;
  /** Densification points per grid line. Default: 60. */
  densificationPoints?: number;
  /** Target screen pixels per cell before subdividing to the next level. Default: 80. */
  targetScreenPx?: number;
  /**
   * Behaviour at 6° zone boundaries.
   *  - `'tiled'` (default): every visible zone draws, each clipped to its
   *    own 6° strip.
   *  - `'overlap'`: adjacent zones also render their 30' overlap band.
   *  - `'single'`: only the zone nearest the viewport centre.
   */
  zoneBoundary?: 'tiled' | 'overlap' | 'single';
  /** Maximum view-projection resolution at which to render. Default: 150 m/px. */
  maxRenderResolution?: number;
}

export class HmnGridSystem implements GridSystem {
  private readonly maxDepth_: 2 | 3 | 4;
  private readonly densificationPoints_: number;
  private readonly targetScreenPx_: number;
  private readonly zoneBoundary_: 'tiled' | 'overlap' | 'single';
  private readonly maxRenderResolution_: number;
  private readonly intervals_: HmnIntervalStrategy;
  private readonly datumShift_: DatumShift;

  private readonly delegates_ = new Map<number, GridSystem>();
  private readonly activeZonesCache_ = new RenderCache<number[]>();
  private readonly cursorCache_ = new BoundedCache<string, FormattedCoordinate>(512);

  constructor(options: HmnGridSystemOptions = {}) {
    this.maxDepth_ = options.maxDepth ?? 4;
    this.densificationPoints_ = options.densificationPoints ?? 20;
    this.targetScreenPx_ = options.targetScreenPx ?? 80;
    this.zoneBoundary_ = options.zoneBoundary ?? 'tiled';
    this.maxRenderResolution_ = options.maxRenderResolution ?? 150;
    this.intervals_ = new HmnIntervalStrategy(this.targetScreenPx_);
    this.datumShift_ = options.datumShift ?? DEFAULT_DATUM_SHIFT;
  }

  getFeatures(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): Feature<Geometry>[] {
    if (resolution > this.maxRenderResolution_) return [];
    const features: Feature<Geometry>[] = [];
    for (const k of this.activeZones_(extent, viewProjection)) {
      for (const f of this.delegateFor_(k).getFeatures(extent, resolution, viewProjection)) {
        features.push(f);
      }
    }
    return features;
  }

  /** HMN doesn't print axis labels; DHG underneath carries those. */
  getLabels(_extent: Extent, _resolution: number, _viewProjection: ProjectionLike): GridLabel[] {
    return [];
  }

  getCellLabels(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): GridCellLabel[] {
    if (resolution > this.maxRenderResolution_) return [];
    const labels: GridCellLabel[] = [];
    for (const k of this.activeZones_(extent, viewProjection)) {
      const fromDelegate = this.delegateFor_(k).getCellLabels?.(extent, resolution, viewProjection) ?? [];
      for (const l of fromDelegate) labels.push(l);
    }
    return labels;
  }

  formatCoordinate(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): FormattedCoordinate {
    const cacheKey = cursorKey(coordinate, viewProjection);
    const cached = this.cursorCache_.get(cacheKey);
    if (cached !== undefined) return cached;
    const lonLat = toFiniteLonLat(coordinate, viewProjection);
    let result: FormattedCoordinate;
    if (!lonLat || !pointInsideValidity(lonLat[0], lonLat[1])) {
      result = { combined: '-' };
    } else {
      const ref = encodeHmn([lonLat[1], lonLat[0]], { depth: this.maxDepth_, datumShift: this.datumShift_ });
      result = { combined: ref.canonical };
    }
    this.cursorCache_.set(cacheKey, result);
    return result;
  }

  isValidCoordinate(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): boolean {
    const lonLat = toFiniteLonLat(coordinate, viewProjection);
    return lonLat !== null && pointInsideValidity(lonLat[0], lonLat[1]);
  }

  private activeZones_(extent: Extent, viewProjection: ProjectionLike): number[] {
    return this.activeZonesCache_.get(extent, 0, viewProjection, () =>
      this.computeActiveZones_(extent, viewProjection),
    );
  }

  private computeActiveZones_(extent: Extent, viewProjection: ProjectionLike): number[] {
    return activeZonesFor(extent, viewProjection, this.zoneBoundary_);
  }

  /** Datum shift this instance was constructed with. */
  get datumShift(): DatumShift {
    return this.datumShift_;
  }

  private delegateFor_(kennziffer: number): GridSystem {
    const cached = this.delegates_.get(kennziffer);
    if (cached) return cached;

    const zone = zoneByKennziffer(kennziffer);
    const crs = registerZone(zone, this.datumShift_);
    const inner = new HmnZoneRenderer({
      crs,
      intervals: this.intervals_,
      maxDepth: this.maxDepth_,
      densificationPoints: this.densificationPoints_,
    });
    const overlapDeg = this.zoneBoundary_ === 'overlap' ? STRIP_OVERLAP_DEG : 0;
    const clipped = new PolygonClippedGridSystem({
      source: inner,
      clipPolygon: stripClipPolygon(zone, overlapDeg),
      emitBoundary: true,
    });
    this.delegates_.set(kennziffer, clipped);
    return clipped;
  }

  /** Currently-configured max depth. */
  get maxDepth(): 2 | 3 | 4 {
    return this.maxDepth_;
  }
}

interface HmnZoneRendererOptions {
  crs: string;
  intervals: HmnIntervalStrategy;
  maxDepth: 2 | 3 | 4;
  densificationPoints: number;
}

interface RenderContext {
  /** Target extent in CRS metres. */
  target: Extent;
  /** Active cell-grid interval (1 000 / 2 000 / 6 000). */
  interval: number;
  /** crs → viewProj transform. */
  toView: TransformFunction;
  /** Parameter samples for vertical lines (constant easting, sweeping northing). */
  xTs: number[];
  /** Parameter samples for horizontal lines (constant northing, sweeping easting). */
  yTs: number[];
  /** Cell size in screen pixels, used as a label fade hint. */
  cellSizePx: number;
}

class HmnZoneRenderer implements GridSystem {
  private readonly crs_: string;
  private readonly intervals_: HmnIntervalStrategy;
  private readonly maxDepth_: 2 | 3 | 4;
  private readonly densificationPoints_: number;
  private readonly projScratch_ = new ProjectionScratch();
  private readonly ctxCache_ = new RenderCache<RenderContext | null>();
  private readonly transformCache_ = new TransformCache();

  constructor(options: HmnZoneRendererOptions) {
    this.crs_ = options.crs;
    this.intervals_ = options.intervals;
    this.maxDepth_ = options.maxDepth;
    this.densificationPoints_ = options.densificationPoints;
  }

  getFeatures(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): Feature<Geometry>[] {
    const ctx = this.context_(extent, resolution, viewProjection);
    if (!ctx) return [];

    const features: Feature<Geometry>[] = [];
    this.emitLinesAt_(features, ctx, KLEINQUADRAT_M, 'major');
    if (ctx.interval <= MELDETRAPEZ_M && this.maxDepth_ >= 3) {
      this.emitLinesAt_(features, ctx, MELDETRAPEZ_M, 'minor');
    }
    if (ctx.interval <= ARBEITSTRAPEZ_M && this.maxDepth_ >= 4) {
      this.emitLinesAt_(features, ctx, ARBEITSTRAPEZ_M, 'minor');
    }
    return features;
  }

  getLabels(): GridLabel[] {
    return [];
  }

  getCellLabels(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): GridCellLabel[] {
    const ctx = this.context_(extent, resolution, viewProjection);
    if (!ctx) return [];

    const labels: GridCellLabel[] = [];
    const { target, interval, toView, cellSizePx } = ctx;
    const [tMinE, tMinN, tMaxE, tMaxN] = target;

    const halfInterval = interval / 2;
    const eMin = FALSE_EASTING + Math.floor((tMinE - FALSE_EASTING) / interval) * interval + halfInterval;
    const eMax = FALSE_EASTING + Math.ceil((tMaxE - FALSE_EASTING) / interval) * interval - halfInterval;
    const nMin = Math.floor(tMinN / interval) * interval + halfInterval;
    const nMax = Math.ceil(tMaxN / interval) * interval - halfInterval;

    const texts: string[] = [];
    const flat: number[] = [];
    for (let e = eMin; e <= eMax; e += interval) {
      for (let n = nMin; n <= nMax; n += interval) {
        const text = hmnHierarchicalLabel(e, n, interval);
        if (!text) continue;
        texts.push(text);
        flat.push(
          e, n,
          e - halfInterval, n - halfInterval,
          e + halfInterval, n - halfInterval,
          e + halfInterval, n + halfInterval,
          e - halfInterval, n + halfInterval,
        );
      }
    }
    if (texts.length === 0) return labels;
    transformBatchCached(flat, flat, 2, toView, this.transformCache_);

    for (let i = 0; i < texts.length; i++) {
      const base = i * 10;
      const vx = flat[base]!;
      const vy = flat[base + 1]!;
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) continue;
      const ring: [number, number][] = [];
      let ringOk = true;
      for (let k = 1; k <= 4; k++) {
        const rx = flat[base + k * 2]!;
        const ry = flat[base + k * 2 + 1]!;
        if (!Number.isFinite(rx) || !Number.isFinite(ry)) { ringOk = false; break; }
        ring.push([rx, ry]);
      }
      if (!ringOk) continue;
      labels.push({
        point: new Point([vx, vy]),
        text: texts[i]!,
        cellSizePx,
        cellRing: ring,
      });
    }
    return labels;
  }

  formatCoordinate(_coordinate: [number, number], _viewProjection: ProjectionLike): FormattedCoordinate {
    return { combined: '' };
  }

  private context_(extent: Extent, resolution: number, viewProjection: ProjectionLike): RenderContext | null {
    return this.ctxCache_.get(extent, resolution, viewProjection, () => {
      const toCrs = getTransform(viewProjection, this.crs_);
      const toView = getTransform(this.crs_, viewProjection);
      let target = transformExtentSampled(extent, toCrs);
      if (![target[0], target[1], target[2], target[3]].every(Number.isFinite)) return null;

      target = getIntersection(target, DHG_WORLD_BOX);
      if (isEmpty(target)) return null;

      const targetResolution = measureTargetResolution(target, toView, resolution) ?? resolution;
      const interval = this.intervals_.getInterval(targetResolution);

      const cap = this.densificationPoints_;
      const xTs = adaptiveAxisTs('x', target, toView, resolution, cap);
      const yTs = adaptiveAxisTs('y', target, toView, resolution, cap);

      const cellSizePx = interval / resolution;

      return { target, interval, toView, xTs, yTs, cellSizePx };
    });
  }

  private emitLinesAt_(
    out: Feature<Geometry>[],
    ctx: RenderContext,
    interval: number,
    type: 'major' | 'minor',
  ): void {
    const [tMinE, tMinN, tMaxE, tMaxN] = ctx.target;
    const startE = FALSE_EASTING + Math.ceil((tMinE - FALSE_EASTING) / interval) * interval;
    const endE = FALSE_EASTING + Math.floor((tMaxE - FALSE_EASTING) / interval) * interval;
    const startN = Math.ceil(tMinN / interval) * interval;
    const endN = Math.floor(tMaxN / interval) * interval;

    // Minor lines that coincide with a Klein boundary are dropped so the
    // 6 km grid isn't double-drawn.
    const skipE = type === 'minor'
      ? (e: number): boolean => (e - FALSE_EASTING) % KLEINQUADRAT_M === 0
      : undefined;
    const skipN = type === 'minor'
      ? (n: number): boolean => n % KLEINQUADRAT_M === 0
      : undefined;

    const specs: FlatLineSpec[] = [];
    pushAxisGridLineSpecs(specs, 'x', startE, endE, interval, tMinN, tMaxN, ctx.xTs, type, skipE);
    pushAxisGridLineSpecs(specs, 'y', startN, endN, interval, tMinE, tMaxE, ctx.yTs, type, skipN);
    emitFlatLineFeatures(out, this.projScratch_, specs, ctx.toView);
  }
}

