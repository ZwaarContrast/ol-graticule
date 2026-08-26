/**
 * Geographic Heeresmeldenetz grid system. Renders the lat/lon-bounded
 * variant of the HMN (the one whose sheets self-identify with a
 * `Heeresmeldenetz (geogr.)` header), distinct from the DHG-metric planar
 * variant handled by `HmnGridSystem`.
 *
 * Cells are 6' lon × 4' lat Kleintrapeze, subdivided into 2' × 1'20"
 * Meldetrapeze and 1' × 40" Arbeitstrapeze. Anchor at 0°40'N, 0°E.
 */

import type Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type { ProjectionLike, TransformFunction } from 'ol/proj';
import { transformExtent, getTransform } from 'ol/proj';

import type {
  FlatLineSpec,
  FormattedCoordinate,
  GridCellLabel,
  GridLabel,
  GridSystem,
} from '@zwaarcontrast/ol-graticule';
import {
  BoundedCache,
  ProjectionScratch,
  RenderCache,
  densifyCount,
  emitFlatLineFeatures,
  measureTargetResolution,
  pushAxisGridLineSpecs,
} from '@zwaarcontrast/ol-graticule';

import { cursorKey, toFiniteLonLat } from './sharedViewport.js';
import { encodeHmnGeo } from '../heeresmeldenetz-geographic/encode.js';
import { hmnGeoHierarchicalLabel } from '../heeresmeldenetz-geographic/formatter.js';
import {
  ANCHOR_LAT_SEC,
  ANCHOR_LON_SEC,
  ARBEITSTRAPEZ_LAT_SEC,
  ARBEITSTRAPEZ_LON_SEC,
  ARCSEC_PER_DEG,
  KLEINTRAPEZ_LAT_SEC,
  KLEINTRAPEZ_LON_SEC,
  MELDETRAPEZ_LAT_SEC,
  MELDETRAPEZ_LON_SEC,
} from '../heeresmeldenetz-geographic/levels.js';

/** Cell-size tier expressed in arcseconds (lon × lat). */
interface Tier {
  readonly lonSec: number;
  readonly latSec: number;
  readonly depth: 2 | 3 | 4;
}

const TIER_KLEIN: Tier = {
  lonSec: KLEINTRAPEZ_LON_SEC,
  latSec: KLEINTRAPEZ_LAT_SEC,
  depth: 2,
};
const TIER_MELDE: Tier = {
  lonSec: MELDETRAPEZ_LON_SEC,
  latSec: MELDETRAPEZ_LAT_SEC,
  depth: 3,
};
const TIER_ARBEIT: Tier = {
  lonSec: ARBEITSTRAPEZ_LON_SEC,
  latSec: ARBEITSTRAPEZ_LAT_SEC,
  depth: 4,
};

export interface GeographicHmnGridSystemOptions {
  /**
   * Maximum level to render. Default `4` (Arbeitstrapez).
   *
   *  - `2`: Kleintrapez (6' × 4', letter pairs)
   *  - `3`: + Meldetrapez (2' × 1'20", digits 1..9)
   *  - `4`: + Arbeitstrapez (1' × 40", letters a..d)
   */
  maxDepth?: 2 | 3 | 4;
  /** Densification points per grid line. Default: 60. */
  densificationPoints?: number;
  /** Target screen pixels per cell before subdividing to the next level. Default: 80. */
  targetScreenPx?: number;
  /**
   * Maximum view-projection resolution at which to render anything.
   * Default: 150 m/px, same as `HmnGridSystem`. Cells in both variants
   * are ~6 km, so the same fade-out point makes sense.
   */
  maxRenderResolution?: number;
}

interface RenderContext {
  /** Target extent in lon/lat degrees, intersected with the world box. */
  target: Extent;
  /** Active cell-size tier (Klein / Melde / Arbeit). */
  tier: Tier;
  /** EPSG:4326 → view projection transform. */
  toView: TransformFunction;
  /** Vertices per grid line for densification. */
  npts: number;
  /** Cell size in screen pixels, used as a label fade hint. */
  cellSizePx: number;
}

/**
 * Renders the geographic HMN: lat/lon graticule cells with letter-pair
 * Kleintrapez labels, plus optional Meldetrapez and Arbeitstrapez subdivision
 * lines and labels when zoomed in.
 */
export class GeographicHmnGridSystem implements GridSystem {
  private readonly maxDepth_: 2 | 3 | 4;
  private readonly densificationPoints_: number;
  private readonly targetScreenPx_: number;
  private readonly maxRenderResolution_: number;

  private readonly projScratch_ = new ProjectionScratch();
  private readonly ctxCache_ = new RenderCache<RenderContext | null>();
  private readonly cursorCache_ = new BoundedCache<string, FormattedCoordinate>(512);

  constructor(options: GeographicHmnGridSystemOptions = {}) {
    this.maxDepth_ = options.maxDepth ?? 4;
    this.densificationPoints_ = options.densificationPoints ?? 20;
    this.targetScreenPx_ = options.targetScreenPx ?? 80;
    this.maxRenderResolution_ = options.maxRenderResolution ?? 150;
  }

  getFeatures(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): Feature<Geometry>[] {
    if (resolution > this.maxRenderResolution_) return [];
    const ctx = this.context_(extent, resolution, viewProjection);
    if (!ctx) return [];

    const features: Feature<Geometry>[] = [];
    this.emitLinesAt_(features, ctx, TIER_KLEIN, 'major');
    if (ctx.tier.depth >= 3 && this.maxDepth_ >= 3) {
      this.emitLinesAt_(features, ctx, TIER_MELDE, 'minor');
    }
    if (ctx.tier.depth >= 4 && this.maxDepth_ >= 4) {
      this.emitLinesAt_(features, ctx, TIER_ARBEIT, 'minor');
    }
    return features;
  }

  /** Geographic HMN doesn't print axis labels; cells carry the labels. */
  getLabels(): GridLabel[] {
    return [];
  }

  getCellLabels(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): GridCellLabel[] {
    if (resolution > this.maxRenderResolution_) return [];
    const ctx = this.context_(extent, resolution, viewProjection);
    if (!ctx) return [];

    const labels: GridCellLabel[] = [];
    const { target, tier, toView, cellSizePx } = ctx;
    const [tMinLon, tMinLat, tMaxLon, tMaxLat] = target;

    // Cell centres in arcseconds, snapped to the cell lattice.
    const cellLonSec = tier.lonSec;
    const cellLatSec = tier.latSec;
    const halfLon = cellLonSec / 2;
    const halfLat = cellLatSec / 2;

    const minLonSec = tMinLon * ARCSEC_PER_DEG;
    const maxLonSec = tMaxLon * ARCSEC_PER_DEG;
    const minLatSec = tMinLat * ARCSEC_PER_DEG;
    const maxLatSec = tMaxLat * ARCSEC_PER_DEG;

    const firstColCentre =
      ANCHOR_LON_SEC + Math.ceil((minLonSec - ANCHOR_LON_SEC - halfLon) / cellLonSec) * cellLonSec + halfLon;
    const lastColCentre =
      ANCHOR_LON_SEC + Math.floor((maxLonSec - ANCHOR_LON_SEC - halfLon) / cellLonSec) * cellLonSec + halfLon;
    const firstRowCentre =
      ANCHOR_LAT_SEC + Math.ceil((minLatSec - ANCHOR_LAT_SEC - halfLat) / cellLatSec) * cellLatSec + halfLat;
    const lastRowCentre =
      ANCHOR_LAT_SEC + Math.floor((maxLatSec - ANCHOR_LAT_SEC - halfLat) / cellLatSec) * cellLatSec + halfLat;

    for (let lonSec = firstColCentre; lonSec <= lastColCentre; lonSec += cellLonSec) {
      for (let latSec = firstRowCentre; latSec <= lastRowCentre; latSec += cellLatSec) {
        const text = hmnGeoHierarchicalLabel(lonSec, latSec, tier.depth);
        if (!text) continue;
        const lon = lonSec / ARCSEC_PER_DEG;
        const lat = latSec / ARCSEC_PER_DEG;
        const [vx, vy] = toView([lon, lat], undefined, 2);
        if (vx === undefined || vy === undefined) continue;
        if (!Number.isFinite(vx) || !Number.isFinite(vy)) continue;
        const cellRing = projectCellRing_(toView, lon, lat, halfLon / ARCSEC_PER_DEG, halfLat / ARCSEC_PER_DEG);
        if (!cellRing) continue;
        labels.push({
          point: new Point([vx, vy]),
          text,
          cellSizePx,
          cellRing,
        });
      }
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
    if (!lonLat) {
      result = { combined: '-' };
    } else {
      const ref = encodeHmnGeo([lonLat[1], lonLat[0]], { depth: this.maxDepth_ });
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
    return lonLat !== null && lonLat[1] > -85 && lonLat[1] < 85;
  }

  /** Currently-configured max depth. */
  get maxDepth(): 2 | 3 | 4 {
    return this.maxDepth_;
  }

  private context_(extent: Extent, resolution: number, viewProjection: ProjectionLike): RenderContext | null {
    return this.ctxCache_.get(extent, resolution, viewProjection, () => {
      const toView = getTransform('EPSG:4326', viewProjection);
      const target = transformExtent(extent, viewProjection, 'EPSG:4326');
      if (![target[0], target[1], target[2], target[3]].every(Number.isFinite)) return null;
      // Clamp to a sane global box: the geographic HMN is defined globally
      // but tiles get absurd near the poles where cells are arcminute-wide.
      target[1] = Math.max(target[1], -85);
      target[3] = Math.min(target[3], 85);
      if (target[1] >= target[3] || target[0] >= target[2]) return null;

      const targetResolution = measureTargetResolution(target, toView, resolution) ?? resolution;
      const tier = pickTier_(targetResolution, this.targetScreenPx_, this.maxDepth_);

      // `target` is in degrees, so `targetResolution` is degrees-per-pixel.
      // `cellSizePx` is the cell's on-screen size in pixels, used as a label
      // fade hint and matching the units of the `fadeStops` thresholds.
      const cellDegLat = tier.latSec / ARCSEC_PER_DEG;
      const cellDegLon = tier.lonSec / ARCSEC_PER_DEG;
      const npts = densifyCount(target, Math.max(cellDegLat, cellDegLon), this.densificationPoints_) + 1;
      const cellSizePx = cellDegLat / targetResolution;
      return { target, tier, toView, npts, cellSizePx };
    });
  }

  private emitLinesAt_(
    out: Feature<Geometry>[],
    ctx: RenderContext,
    tier: Tier,
    type: 'major' | 'minor',
  ): void {
    const [tMinLon, tMinLat, tMaxLon, tMaxLat] = ctx.target;

    const lonStepDeg = tier.lonSec / ARCSEC_PER_DEG;
    const latStepDeg = tier.latSec / ARCSEC_PER_DEG;
    const lonAnchor = ANCHOR_LON_SEC / ARCSEC_PER_DEG;
    const latAnchor = ANCHOR_LAT_SEC / ARCSEC_PER_DEG;

    const startLon = lonAnchor + Math.ceil((tMinLon - lonAnchor) / lonStepDeg) * lonStepDeg;
    const endLon = lonAnchor + Math.floor((tMaxLon - lonAnchor) / lonStepDeg) * lonStepDeg;
    const startLat = latAnchor + Math.ceil((tMinLat - latAnchor) / latStepDeg) * latStepDeg;
    const endLat = latAnchor + Math.floor((tMaxLat - latAnchor) / latStepDeg) * latStepDeg;

    // Small relative tolerance absorbs float drift so the last line isn't dropped.
    const lonTol = lonStepDeg * 1e-6;
    const latTol = latStepDeg * 1e-6;

    // Minor lines on a Klein boundary would render the same cells twice.
    const kleinLonDeg = KLEINTRAPEZ_LON_SEC / ARCSEC_PER_DEG;
    const kleinLatDeg = KLEINTRAPEZ_LAT_SEC / ARCSEC_PER_DEG;
    const skipX = type === 'minor'
      ? (lon: number): boolean => onKleinBoundary_(lon - lonAnchor, kleinLonDeg)
      : undefined;
    const skipY = type === 'minor'
      ? (lat: number): boolean => onKleinBoundary_(lat - latAnchor, kleinLatDeg)
      : undefined;

    const specs: FlatLineSpec[] = [];
    pushAxisGridLineSpecs(
      specs, 'x', startLon, endLon + lonTol, lonStepDeg, tMinLat, tMaxLat, ctx.npts, type, skipX,
    );
    pushAxisGridLineSpecs(
      specs, 'y', startLat, endLat + latTol, latStepDeg, tMinLon, tMaxLon, ctx.npts, type, skipY,
    );
    emitFlatLineFeatures(out, this.projScratch_, specs, ctx.toView);
  }
}

function pickTier_(targetResolutionDeg: number, targetScreenPx: number, maxDepth: 2 | 3 | 4): Tier {
  // `targetResolutionDeg` is degrees-per-pixel (because the target extent is
  // in EPSG:4326). Pick the smallest tier whose lat-cell still spans >=
  // `targetScreenPx` on screen. Mirrors `SteppingIntervalStrategy`.
  const candidates: Tier[] = [TIER_KLEIN];
  if (maxDepth >= 3) candidates.push(TIER_MELDE);
  if (maxDepth >= 4) candidates.push(TIER_ARBEIT);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const tier = candidates[i]!;
    const sizePx = (tier.latSec / ARCSEC_PER_DEG) / targetResolutionDeg;
    if (sizePx >= targetScreenPx) return tier;
  }
  return TIER_KLEIN;
}

function projectCellRing_(
  toView: TransformFunction,
  cLon: number,
  cLat: number,
  halfLon: number,
  halfLat: number,
): [number, number][] | null {
  const corners: Array<[number, number]> = [
    [cLon - halfLon, cLat - halfLat],
    [cLon + halfLon, cLat - halfLat],
    [cLon + halfLon, cLat + halfLat],
    [cLon - halfLon, cLat + halfLat],
  ];
  const out: [number, number][] = [];
  for (const c of corners) {
    const [x, y] = toView(c, undefined, 2);
    if (x === undefined || y === undefined) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    out.push([x, y]);
  }
  return out;
}

function onKleinBoundary_(offsetDeg: number, kleinStepDeg: number): boolean {
  const ratio = offsetDeg / kleinStepDeg;
  const rounded = Math.round(ratio);
  return Math.abs(ratio - rounded) < 1e-9;
}

