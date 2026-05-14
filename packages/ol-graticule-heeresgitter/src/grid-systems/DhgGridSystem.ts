/**
 * Deutsches Heeresgitter (DHG) grid system. One renderer per visible DHG zone,
 * km grid anchored to the 500 000 m false easting, clipped to the zone's 6° band.
 */

import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type { ProjectionLike, TransformFunction } from 'ol/proj';
import { getCenter, getIntersection, isEmpty } from 'ol/extent';
import { getTransform, transform } from 'ol/proj';

import type {
  FormattedCoordinate,
  FlatLineSpec,
  GridLabel,
  GridSystem,
} from '@zwaarcontrast/ol-graticule';
import {
  BoundedCache,
  PolygonClippedGridSystem,
  ProjectionScratch,
  RenderCache,
  SteppingIntervalStrategy,
  densifyCount,
  emitFlatLineFeatures,
  measureTargetResolution,
  pushAxisGridLineSpecs,
  transformExtentSampled,
} from '@zwaarcontrast/ol-graticule';

import { formatEasting, formatNorthing } from '../dhg/encode.js';
import { DEFAULT_DATUM_SHIFT, registerZone } from '../dhg/projection.js';
import {
  stripClipPolygon,
  zoneIntersectsValidity,
  pointInsideValidity,
  VALIDITY_EAST_LON,
  VALIDITY_NORTH_LAT,
  VALIDITY_SOUTH_LAT,
  VALIDITY_WEST_LON,
} from '../dhg/stripPolygon.js';
import type { DatumShift } from '../dhg/types.js';
import { FALSE_EASTING, STRIP_OVERLAP_DEG, zoneByKennziffer, zoneForLon } from '../dhg/zones.js';
import { DHG_WORLD_BOX, cursorKey, projectionKey, sampleCornerLons } from './sharedViewport.js';

const KM = 1_000;
const DHG_INTERVALS = [KM, 2 * KM, 6 * KM, 30 * KM, 150 * KM];

export type DhgZoneBoundaryMode = 'tiled' | 'overlap' | 'single';

export interface DhgGridSystemOptions {
  /**
   * Behaviour at 6° zone boundaries.
   *  - `'tiled'` (default): hard cuts at exact 6° meridians, one grid per strip.
   *  - `'overlap'`: adjacent zones both render in the 30' overlap band, like
   *    wartime sheets that straddle a strip boundary.
   *  - `'single'`: only the zone nearest the viewport centre.
   */
  zoneBoundary?: DhgZoneBoundaryMode;
  /** Override the WGS 84 → Bessel-Potsdam datum shift. */
  datumShift?: DatumShift;
  /** Densification points per grid line. Default: 60. */
  densificationPoints?: number;
  /** Target screen pixels between adjacent grid lines. Default: 80. */
  targetScreenPx?: number;
  /** Force short-form km labels (last 2 digits only). Default: long form. */
  labelForm?: 'long' | 'short';
  /**
   * Maximum view-projection resolution at which to draw the km grid.
   * Above this, the overview (zone outlines + Kennziffer labels) takes over.
   * Default 2000 m/px (~zoom 6).
   */
  maxRenderResolution?: number;
  /**
   * Maximum view-projection resolution at which to draw the Kennziffer
   * overview labels. Strip-boundary lines always render so the user can see
   * the 6° structure at any zoom; labels are gated to avoid clutter once
   * strips become only a few pixels wide. Default 6000 m/px (≈ zoom 5).
   */
  overviewLabelMaxResolution?: number;
}

export class DhgGridSystem implements GridSystem {
  private readonly zoneBoundary_: DhgZoneBoundaryMode;
  private readonly densificationPoints_: number;
  private readonly targetScreenPx_: number;
  private readonly labelForm_: 'long' | 'short';
  private readonly maxRenderResolution_: number;
  private readonly overviewLabelMaxResolution_: number;
  private readonly intervals_: SteppingIntervalStrategy;
  private readonly datumShift_: DatumShift;

  private readonly delegates_ = new Map<number, GridSystem>();
  private readonly renderers_ = new Map<number, DhgZoneRenderer>();
  private readonly stripOutlines_ = new Map<number, [number, number][] | null>();
  private stripOutlineProjKey_ = '';
  private readonly overviewLabels_ = new BoundedCache<string, [number, number]>(512);
  private readonly cursorCache_ = new BoundedCache<string, FormattedCoordinate>(512);
  private readonly activeZonesCache_ = new RenderCache<number[]>();

  constructor(options: DhgGridSystemOptions = {}) {
    this.zoneBoundary_ = options.zoneBoundary ?? 'tiled';
    this.densificationPoints_ = options.densificationPoints ?? 60;
    this.targetScreenPx_ = options.targetScreenPx ?? 80;
    this.labelForm_ = options.labelForm ?? 'long';
    this.maxRenderResolution_ = options.maxRenderResolution ?? 2000;
    this.overviewLabelMaxResolution_ = options.overviewLabelMaxResolution ?? 6000;
    this.intervals_ = new SteppingIntervalStrategy(DHG_INTERVALS, this.targetScreenPx_);
    this.datumShift_ = options.datumShift ?? DEFAULT_DATUM_SHIFT;
  }

  getFeatures(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): Feature<Geometry>[] {
    const detailed = resolution <= this.maxRenderResolution_;
    const features: Feature<Geometry>[] = [];
    for (const kennziffer of this.activeZones_(extent, viewProjection)) {
      if (detailed) {
        for (const f of this.delegateFor_(kennziffer).getFeatures(extent, resolution, viewProjection)) {
          features.push(f);
        }
      } else {
        const outline = this.buildStripOutline_(kennziffer, viewProjection);
        if (outline) features.push(outline);
      }
    }
    return features;
  }

  getLabels(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): GridLabel[] {
    const detailed = resolution <= this.maxRenderResolution_;
    const labels: GridLabel[] = [];
    const active = this.activeZones_(extent, viewProjection);
    if (detailed) {
      let yAxisOwner: number | undefined;
      let westCm = Infinity;
      for (const k of active) {
        const cm = zoneByKennziffer(k).cm;
        if (cm < westCm) {
          westCm = cm;
          yAxisOwner = k;
        }
      }
      for (const kennziffer of active) {
        for (const l of this.delegateFor_(kennziffer).getLabels(extent, resolution, viewProjection)) {
          if (l.axis === 'y' && kennziffer !== yAxisOwner) continue;
          labels.push(l);
        }
      }
    } else if (resolution <= this.overviewLabelMaxResolution_) {
      for (const kennziffer of active) {
        const label = this.buildOverviewLabel_(kennziffer, extent, viewProjection);
        if (label) labels.push(label);
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
    const result = this.computeFormatCoordinate_(coordinate, viewProjection);
    this.cursorCache_.set(cacheKey, result);
    return result;
  }

  private computeFormatCoordinate_(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): FormattedCoordinate {
    const lonLat = transform(coordinate, viewProjection, 'EPSG:4326');
    const lon = lonLat[0];
    const lat = lonLat[1];
    if (
      lon === undefined || lat === undefined ||
      !Number.isFinite(lon) || !Number.isFinite(lat) ||
      !pointInsideValidity(lon, lat)
    ) {
      return { x: '-', y: '-' };
    }
    const zone = zoneForLon(lon);
    const renderer = this.rendererFor_(zone.kennziffer);
    return renderer.formatCoordinate(coordinate, viewProjection);
  }

  /** Datum shift this instance was constructed with. */
  get datumShift(): DatumShift {
    return this.datumShift_;
  }

  isValidCoordinate(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): boolean {
    const lonLat = transform(coordinate, viewProjection, 'EPSG:4326');
    const lon = lonLat[0];
    const lat = lonLat[1];
    if (lon === undefined || lat === undefined) return false;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
    return pointInsideValidity(lon, lat);
  }

  get zoneBoundaryMode(): DhgZoneBoundaryMode {
    return this.zoneBoundary_;
  }

  private activeZones_(extent: Extent, viewProjection: ProjectionLike): number[] {
    return this.activeZonesCache_.get(extent, 0, viewProjection, () =>
      this.computeActiveZones_(extent, viewProjection),
    );
  }

  private computeActiveZones_(extent: Extent, viewProjection: ProjectionLike): number[] {
    const overlapDeg = this.zoneBoundary_ === 'overlap' ? STRIP_OVERLAP_DEG : 0;
    if (this.zoneBoundary_ === 'single') {
      const centreZone = this.centreZone_(extent, viewProjection);
      return zoneIntersectsValidity(centreZone, overlapDeg) ? [centreZone.kennziffer] : [];
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

  private centreZone_(extent: Extent, viewProjection: ProjectionLike) {
    const centre = getCenter(extent);
    const [centreLon] = transform(centre, viewProjection, 'EPSG:4326');
    return zoneForLon(centreLon ?? 0);
  }

  /** Strip outline (6° rectangle, clipped to validity envelope) projected to view CRS. */
  private buildStripOutline_(
    kennziffer: number,
    viewProjection: ProjectionLike,
  ): Feature<Geometry> | null {
    const ring = this.stripOutlineRing_(kennziffer, viewProjection);
    if (!ring) return null;
    const zone = zoneByKennziffer(kennziffer);
    const feature = new Feature<Geometry>({ geometry: new LineString(ring) });
    feature.set('gridLineType', 'boundary');
    feature.set('gridAxis', 'x');
    feature.set('gridValue', zone.cm);
    return feature;
  }

  private stripOutlineRing_(
    kennziffer: number,
    viewProjection: ProjectionLike,
  ): [number, number][] | null {
    const projKey = projectionKey(viewProjection);
    if (projKey !== this.stripOutlineProjKey_) {
      this.stripOutlines_.clear();
      this.stripOutlineProjKey_ = projKey;
    }
    if (this.stripOutlines_.has(kennziffer)) {
      return this.stripOutlines_.get(kennziffer) ?? null;
    }
    const ring = projectStripOutlineRing_(kennziffer, viewProjection);
    this.stripOutlines_.set(kennziffer, ring);
    return ring;
  }

  /** Kennziffer label at (strip CM, viewport-centre lat clamped to validity). */
  private buildOverviewLabel_(
    kennziffer: number,
    extent: Extent,
    viewProjection: ProjectionLike,
  ): GridLabel | null {
    const zone = zoneByKennziffer(kennziffer);
    const centreLatLon = transform(getCenter(extent), viewProjection, 'EPSG:4326');
    let lat = centreLatLon[1] ?? 50;
    if (!Number.isFinite(lat)) lat = 50;
    const pad = 5;
    if (lat < VALIDITY_SOUTH_LAT + pad) lat = VALIDITY_SOUTH_LAT + pad;
    if (lat > VALIDITY_NORTH_LAT - pad) lat = VALIDITY_NORTH_LAT - pad;
    const quantLat = Math.round(lat);
    const key = `${projectionKey(viewProjection)}|${kennziffer}|${quantLat}`;
    let point = this.overviewLabels_.get(key);
    if (!point) {
      const [vx, vy] = transform([zone.cm, quantLat], 'EPSG:4326', viewProjection);
      if (vx === undefined || vy === undefined) return null;
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) return null;
      point = [vx, vy];
      this.overviewLabels_.set(key, point);
    }
    return {
      point: new Point([point[0], point[1]]),
      text: String(kennziffer),
      axis: 'x',
    };
  }

  private delegateFor_(kennziffer: number): GridSystem {
    const cached = this.delegates_.get(kennziffer);
    if (cached) return cached;

    const zone = zoneByKennziffer(kennziffer);
    const renderer = this.rendererFor_(kennziffer);
    const overlapDeg = this.zoneBoundary_ === 'overlap' ? STRIP_OVERLAP_DEG : 0;
    const delegate = new PolygonClippedGridSystem({
      source: renderer,
      clipPolygon: stripClipPolygon(zone, overlapDeg),
      emitBoundary: true,
    });
    this.delegates_.set(kennziffer, delegate);
    return delegate;
  }

  private rendererFor_(kennziffer: number): DhgZoneRenderer {
    const cached = this.renderers_.get(kennziffer);
    if (cached) return cached;
    const zone = zoneByKennziffer(kennziffer);
    const crs = registerZone(zone, this.datumShift_);
    const renderer = new DhgZoneRenderer({
      crs,
      kennziffer,
      intervals: this.intervals_,
      densificationPoints: this.densificationPoints_,
      labelForm: this.labelForm_,
    });
    this.renderers_.set(kennziffer, renderer);
    return renderer;
  }
}

interface DhgZoneRendererOptions {
  crs: string;
  kennziffer: number;
  intervals: SteppingIntervalStrategy;
  densificationPoints: number;
  labelForm: 'long' | 'short';
}

interface RenderContext {
  target: Extent;
  interval: number;
  toView: TransformFunction;
  npts: number;
}

class DhgZoneRenderer implements GridSystem {
  private readonly crs_: string;
  private readonly kennziffer_: number;
  private readonly intervals_: SteppingIntervalStrategy;
  private readonly densificationPoints_: number;
  private readonly labelForm_: 'long' | 'short';
  private readonly projScratch_ = new ProjectionScratch();
  private readonly ctxCache_ = new RenderCache<RenderContext | null>();
  private readonly eastingLabelCache_ = new BoundedCache<number, string>(1024);
  private readonly northingLabelCache_ = new BoundedCache<number, string>(1024);

  constructor(options: DhgZoneRendererOptions) {
    this.crs_ = options.crs;
    this.kennziffer_ = options.kennziffer;
    this.intervals_ = options.intervals;
    this.densificationPoints_ = options.densificationPoints;
    this.labelForm_ = options.labelForm;
  }

  getFeatures(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): Feature<Geometry>[] {
    const ctx = this.context_(extent, resolution, viewProjection);
    if (!ctx) return [];
    const features: Feature<Geometry>[] = [];
    this.emitLines_(features, ctx);
    return features;
  }

  getLabels(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): GridLabel[] {
    const ctx = this.context_(extent, resolution, viewProjection);
    if (!ctx) return [];
    const { target, interval, toView } = ctx;
    const [tMinE, tMinN, tMaxE, tMaxN] = target;
    const labels: GridLabel[] = [];

    const startE = FALSE_EASTING + Math.ceil((tMinE - FALSE_EASTING) / interval) * interval;
    const endE = FALSE_EASTING + Math.floor((tMaxE - FALSE_EASTING) / interval) * interval;
    for (let e = startE; e <= endE; e += interval) {
      const [vx, vy] = toView([e, tMaxN], undefined, 2);
      if (vx === undefined || vy === undefined || !Number.isFinite(vx) || !Number.isFinite(vy)) continue;
      labels.push({
        point: new Point([vx, vy]),
        text: this.formatX_(e),
        axis: 'x',
      });
    }
    const startN = Math.ceil(tMinN / interval) * interval;
    const endN = Math.floor(tMaxN / interval) * interval;
    for (let n = startN; n <= endN; n += interval) {
      const [vx, vy] = toView([tMinE, n], undefined, 2);
      if (vx === undefined || vy === undefined || !Number.isFinite(vx) || !Number.isFinite(vy)) continue;
      labels.push({
        point: new Point([vx, vy]),
        text: this.formatY_(n),
        axis: 'y',
      });
    }
    return labels;
  }

  formatCoordinate(coordinate: [number, number], viewProjection: ProjectionLike): FormattedCoordinate {
    const projected = transform(coordinate, viewProjection, this.crs_);
    const cx = projected[0];
    const cy = projected[1];
    if (cx === undefined || cy === undefined || !Number.isFinite(cx) || !Number.isFinite(cy)) {
      return { x: '-', y: '-' };
    }
    const coord = { kennziffer: this.kennziffer_, easting: cx, northing: cy };
    return {
      x: formatEasting(coord, { form: this.labelForm_ }),
      y: formatNorthing(coord, { form: this.labelForm_ }),
    };
  }

  private formatX_(easting: number): string {
    const cached = this.eastingLabelCache_.get(easting);
    if (cached !== undefined) return cached;
    const result = formatEasting(
      { kennziffer: this.kennziffer_, easting, northing: 0 },
      { form: this.labelForm_ },
    );
    this.eastingLabelCache_.set(easting, result);
    return result;
  }
  private formatY_(northing: number): string {
    const cached = this.northingLabelCache_.get(northing);
    if (cached !== undefined) return cached;
    const result = formatNorthing(
      { kennziffer: this.kennziffer_, easting: 0, northing },
      { form: this.labelForm_ },
    );
    this.northingLabelCache_.set(northing, result);
    return result;
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
      const npts = densifyCount(target, interval, this.densificationPoints_) + 1;
      return { target, interval, toView, npts };
    });
  }

  private emitLines_(out: Feature<Geometry>[], ctx: RenderContext): void {
    const [tMinE, tMinN, tMaxE, tMaxN] = ctx.target;
    const interval = ctx.interval;
    const startE = FALSE_EASTING + Math.ceil((tMinE - FALSE_EASTING) / interval) * interval;
    const endE = FALSE_EASTING + Math.floor((tMaxE - FALSE_EASTING) / interval) * interval;
    const startN = Math.ceil(tMinN / interval) * interval;
    const endN = Math.floor(tMaxN / interval) * interval;

    const specs: FlatLineSpec[] = [];
    pushAxisGridLineSpecs(specs, 'x', startE, endE, interval, tMinN, tMaxN, ctx.npts, 'major');
    pushAxisGridLineSpecs(specs, 'y', startN, endN, interval, tMinE, tMaxE, ctx.npts, 'major');
    emitFlatLineFeatures(out, this.projScratch_, specs, ctx.toView);
  }
}

function projectStripOutlineRing_(
  kennziffer: number,
  viewProjection: ProjectionLike,
): [number, number][] | null {
  const zone = zoneByKennziffer(kennziffer);
  const west = Math.max(VALIDITY_WEST_LON, zone.westLon);
  const east = Math.min(VALIDITY_EAST_LON, zone.eastLon);
  if (east <= west) return null;
  const south = VALIDITY_SOUTH_LAT;
  const north = VALIDITY_NORTH_LAT;
  const steps = 24;
  const ring: [number, number][] = [];
  const pushEdge = (a: [number, number], b: [number, number]): void => {
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const lon = a[0] + t * (b[0] - a[0]);
      const lat = a[1] + t * (b[1] - a[1]);
      const [x, y] = transform([lon, lat], 'EPSG:4326', viewProjection);
      if (x === undefined || y === undefined) continue;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      ring.push([x, y]);
    }
  };
  pushEdge([west, south], [east, south]);
  pushEdge([east, south], [east, north]);
  pushEdge([east, north], [west, north]);
  pushEdge([west, north], [west, south]);
  if (ring.length < 4) return null;
  ring.push(ring[0]!);
  return ring;
}
