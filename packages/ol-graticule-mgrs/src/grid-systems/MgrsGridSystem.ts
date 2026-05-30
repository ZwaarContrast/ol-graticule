/** MGRS grid layer for UniversalGraticule. */

import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { getTransform, transformExtent } from 'ol/proj';
import type Geometry from 'ol/geom/Geometry';
import type { Extent } from 'ol/extent';
import type { ProjectionLike, TransformFunction } from 'ol/proj';
import type {
  GridSystem,
  GridLabel,
  GridCellLabel,
  IntervalStrategy,
  FormattedCoordinate,
} from '@zwaarcontrast/ol-graticule';
import {
  BoundedCache,
  LruCache,
  ProjectionScratch,
  RenderCache,
  TransformCache,
  transformBatchCached,
} from '@zwaarcontrast/ol-graticule';
import { registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import { iterateVisibleGzds, type Gzd } from '../mgrs/gzd.js';
import { utmCrsCode, utmProj4 } from '../mgrs/zones.js';
import { columnLetter, rowLetter } from '../mgrs/squares.js';
import {
  upsCrsCode,
  upsProj4,
  upsColumnLetter,
  upsRowLetter,
} from '../mgrs/ups.js';
import {
  formatMgrs,
  lonLatToMgrsParts,
  type MgrsPrecision,
} from '../mgrs/conversion.js';
import { MgrsIntervals } from '../mgrs/intervals.js';
import { clipPolylineToRect } from '../mgrs/clipPolylineToRect.js';
import {
  clipPolygonToRect,
  polygonArea,
} from '../mgrs/clipPolygonToRect.js';

export interface MgrsGridSystemOptions {
  /** Override the default MGRS interval strategy. */
  intervals?: IntervalStrategy;
  /** Target minimum screen pixels between grid lines (default: 100). */
  targetScreenPx?: number;
  /** Precision (digits per axis, 0–5) for the cursor coordinate readout. Default: 5. */
  cursorPrecision?: MgrsPrecision;
  /** Number of intermediate samples per UTM grid line. Default: 12. */
  densificationPoints?: number;
  /** Skip cell labels when the cell's estimated pixel size falls below this. Default: 30. */
  minCellPx?: number;
  /** Skip 100 km interior grid lines when the cell's estimated pixel size falls below this. Default: 60. */
  minLinePx?: number;
}

interface ProjectedTransforms {
  /** lon/lat → projected metres (UTM zone, or UPS for polar caps). */
  toProj: TransformFunction;
  /** projected metres → lon/lat. */
  fromProj: TransformFunction;
}

/** Static per-(zone, band) data. */
interface GzdStatic {
  utmExtent: Extent | null;
  /** Integer 100 km UTM tile bounds for this band's UTM coverage. */
  tileBounds: { eMin: number; eMax: number; nMin: number; nMax: number } | null;
  cellLabels: ReadonlyArray<{
    lonLat: readonly [number, number];
    /** Two-letter cell id, e.g. "WL". */
    text: string;
    /** Multiplier in `[0, 1]` applied to the GZD-wide `cellSizePx` for this cell. */
    sizeFactor: number;
  }>;
}

/** Per-frame derived state, memoized via {@link RenderCache} on `(extent, resolution, viewProjection)`. */
interface RenderContext {
  geoExtent: Extent;
  interval: number;
  gzds: Gzd[];
  toView: TransformFunction;
  cellPxSize: Map<string, number>;
  gzdPxSize: Map<string, number>;
  gzdCenter: Map<string, [number, number]>;
}

const METRES_PER_DEG_LAT = 110_540;
const PROBE_LAT_STEP = 0.01;
const PROBE_LON_STEP = 0.01;
const MIN_CELL_AREA_FRACTION = 0.01;

function cursorKey(coordinate: [number, number], projection: ProjectionLike): string {
  const code = typeof projection === 'string' ? projection : projection?.getCode() ?? '';
  return `${code}|${Math.round(coordinate[0])}|${Math.round(coordinate[1])}`;
}

export class MgrsGridSystem implements GridSystem {
  private readonly intervals_: IntervalStrategy;
  private readonly cursorPrecision_: MgrsPrecision;
  private readonly densification_: number;
  private readonly minCellPx_: number;
  private readonly minLinePx_: number;

  private readonly ctxCache_ = new RenderCache<RenderContext>();
  private readonly utmTransforms_ = new Map<number, ProjectedTransforms>();
  private readonly upsTransforms_ = new Map<boolean, ProjectedTransforms>();
  private readonly gzdStaticCache_ = new LruCache<string, GzdStatic>(1500);
  private readonly cursorCache_ = new BoundedCache<string, FormattedCoordinate>(512);
  private readonly transformCache_ = new TransformCache();

  private readonly projScratch_ = new ProjectionScratch();

  constructor(options?: MgrsGridSystemOptions) {
    this.intervals_ =
      options?.intervals ?? new MgrsIntervals(options?.targetScreenPx ?? 100);
    this.cursorPrecision_ = options?.cursorPrecision ?? 5;
    this.densification_ = options?.densificationPoints ?? 12;
    this.minCellPx_ = options?.minCellPx ?? 30;
    this.minLinePx_ = options?.minLinePx ?? 60;
  }

  getFeatures(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): Feature<Geometry>[] {
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    const features: Feature<Geometry>[] = [];

    this.emitGzdOutlines_(features, ctx);

    const drawableGzds: Gzd[] = [];
    for (const gzd of ctx.gzds) {
      const px = ctx.cellPxSize.get(gzdKey_(gzd));
      if (px !== undefined && px >= this.minLinePx_) drawableGzds.push(gzd);
    }
    if (drawableGzds.length > 0) {
      this.emitInteriorLines_(features, ctx, drawableGzds);
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
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    const labels: GridCellLabel[] = [];

    for (const gzd of ctx.gzds) {
      const key = gzdKey_(gzd);
      const center = ctx.gzdCenter.get(key);
      const pxSize = ctx.gzdPxSize.get(key);
      if (!center || pxSize === undefined) continue;
      const text = gzd.zone === 0 ? gzd.band : `${gzd.zone}${gzd.band}`;
      labels.push({
        point: new Point([center[0], center[1]]),
        text,
        cellSizePx: pxSize,
      });
    }

    const drawableGzds: Gzd[] = [];
    for (const gzd of ctx.gzds) {
      const px = ctx.cellPxSize.get(gzdKey_(gzd));
      if (px !== undefined && px >= this.minCellPx_) drawableGzds.push(gzd);
    }
    if (drawableGzds.length === 0) return labels;
    this.emitCellLabels_(labels, ctx, drawableGzds);
    return labels;
  }

  formatCoordinate(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): FormattedCoordinate {
    const key = cursorKey(coordinate, viewProjection);
    const cached = this.cursorCache_.get(key);
    if (cached !== undefined) return cached;
    const toLonLat = getTransform(viewProjection, 'EPSG:4326');
    const [lon, lat] = toLonLat(coordinate, undefined, 2);
    let result: FormattedCoordinate;
    if (lon === undefined || lat === undefined) {
      result = { combined: '-' };
    } else {
      const parts = lonLatToMgrsParts(lon, lat);
      result = parts ? { combined: formatMgrs(parts, this.cursorPrecision_) } : { combined: '-' };
    }
    this.cursorCache_.set(key, result);
    return result;
  }

  isValidCoordinate(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): boolean {
    const toLonLat = getTransform(viewProjection, 'EPSG:4326');
    const [lon, lat] = toLonLat(coordinate, undefined, 2);
    if (lon === undefined || lat === undefined) return false;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
    return lat >= -90 && lat <= 90;
  }

  private emitGzdOutlines_(features: Feature<Geometry>[], ctx: RenderContext): void {
    const { gzds, geoExtent, toView } = ctx;
    if (gzds.length === 0) return;

    const meridians = new Map<number, [number, number][]>();
    const parallels = new Map<number, [number, number][]>();
    for (const gzd of gzds) {
      addSegment_(meridians, gzd.lon[0], gzd.lat[0], gzd.lat[1]);
      addSegment_(meridians, gzd.lon[1], gzd.lat[0], gzd.lat[1]);
      addSegment_(parallels, gzd.lat[0], gzd.lon[0], gzd.lon[1]);
      addSegment_(parallels, gzd.lat[1], gzd.lon[0], gzd.lon[1]);
    }

    const minLon = geoExtent[0]!;
    const maxLon = geoExtent[2]!;
    const minLat = geoExtent[1]!;
    const maxLat = geoExtent[3]!;

    const density = this.densification_;
    const scratch = this.projScratch_;
    scratch.reset();
    const lines: { axis: 'x' | 'y'; constLatLon: number; offset: number; npts: number }[] = [];

    for (const [lon, segs] of meridians) {
      if (lon < minLon || lon > maxLon) continue;
      for (const [latLo, latHi] of mergeSegments_(segs)) {
        const lo = Math.max(latLo, minLat, -89.9999);
        const hi = Math.min(latHi, maxLat, 89.9999);
        if (hi <= lo) continue;
        const offset = scratch.length;
        for (let i = 0; i <= density; i++) {
          const t = i / density;
          scratch.push2(lon, lo + t * (hi - lo));
        }
        lines.push({ axis: 'x', constLatLon: lon, offset, npts: density + 1 });
      }
    }
    for (const [lat, segs] of parallels) {
      if (Math.abs(lat) >= 89.99) continue;
      if (lat < minLat || lat > maxLat) continue;
      for (const [lonLo, lonHi] of mergeSegments_(segs)) {
        const lo = Math.max(lonLo, minLon);
        const hi = Math.min(lonHi, maxLon);
        if (hi <= lo) continue;
        const offset = scratch.length;
        for (let i = 0; i <= density; i++) {
          const t = i / density;
          scratch.push2(lo + t * (hi - lo), lat);
        }
        lines.push({ axis: 'y', constLatLon: lat, offset, npts: density + 1 });
      }
    }

    if (lines.length === 0) return;

    scratch.transform(toView);

    for (const pl of lines) {
      const flat = scratch.slice(pl.offset, pl.npts);
      features.push(new Feature<Geometry>({
        geometry: new LineString(flat, 'XY'),
        gridLineType: 'major',
        gridAxis: pl.axis,
        gridValue: pl.constLatLon,
        mgrsKind: 'gzd',
      }));
    }
  }

  private emitInteriorLines_(
    features: Feature<Geometry>[],
    ctx: RenderContext,
    gzds: Gzd[],
  ): void {
    type Polyline = { coords: [number, number][]; axis: 'e' | 'n'; constUtm: number };
    interface Group {
      zoneKey: string;
      axis: 'e' | 'n';
      constUtm: number;
      members: Polyline[];
    }
    const groups = new Map<string, Group>();
    const interval = ctx.interval;
    const density = interiorDensity_(interval, this.densification_);
    for (const gzd of gzds) {
      const stat = this.getGzdStatic_(gzd);
      if (!stat.utmExtent || !stat.tileBounds) continue;
      const tx = this.transformsFor_(gzd);
      const bvUtm = computeBandViewportUtm_(gzd, ctx.geoExtent, tx.toProj);
      if (!bvUtm) continue;

      const utmExt = stat.utmExtent;
      const eLo = Math.max(utmExt[0], bvUtm[0]!);
      const eHi = Math.min(utmExt[2], bvUtm[2]!);
      const nLo = Math.max(utmExt[1], bvUtm[1]!);
      const nHi = Math.min(utmExt[3], bvUtm[3]!);
      if (eLo >= eHi || nLo >= nHi) continue;

      const zoneKey = gzd.zone === 0 ? `0|${gzd.band}` : `${gzd.zone}`;

      // Directly enumerate visible lines from the viewport UTM bbox so each
      // line is generated exactly once, with a sweep that spans only the
      // visible perpendicular range. At deep zoom we touch ~viewport_size /
      // interval lines per GZD instead of the full-tile 100_000 / interval.
      const eStart = Math.ceil(eLo / interval) * interval;
      const eEnd = Math.floor(eHi / interval) * interval;
      for (let e = eStart; e <= eEnd; e += interval) {
        const lines: Polyline[] = [];
        pushClippedLine_(lines, 'e', e, nLo, nHi, density, gzd, tx.fromProj);
        for (const pl of lines) {
          const key = `${zoneKey}|e|${pl.constUtm}`;
          const existing = groups.get(key);
          if (existing) existing.members.push(pl);
          else groups.set(key, { zoneKey, axis: 'e', constUtm: pl.constUtm, members: [pl] });
        }
      }
      const nStart = Math.ceil(nLo / interval) * interval;
      const nEnd = Math.floor(nHi / interval) * interval;
      for (let n = nStart; n <= nEnd; n += interval) {
        const lines: Polyline[] = [];
        pushClippedLine_(lines, 'n', n, eLo, eHi, density, gzd, tx.fromProj);
        for (const pl of lines) {
          const key = `${zoneKey}|n|${pl.constUtm}`;
          const existing = groups.get(key);
          if (existing) existing.members.push(pl);
          else groups.set(key, { zoneKey, axis: 'n', constUtm: pl.constUtm, members: [pl] });
        }
      }
    }
    if (groups.size === 0) return;

    const scratch = this.projScratch_;
    scratch.reset();
    const raw = scratch.raw;
    interface Segment {
      offset: number; npts: number;
      zoneKey: string; axis: 'e' | 'n'; constUtm: number;
    }
    const segments: Segment[] = [];

    for (const group of groups.values()) {
      const sortIdx = group.axis === 'e' ? 1 : 0;
      group.members.sort((a, b) => a.coords[0]![sortIdx] - b.coords[0]![sortIdx]);

      let curOff = scratch.length;
      const finishCurrent = (): void => {
        const n = (scratch.length - curOff) / 2;
        if (n >= 2) {
          segments.push({
            offset: curOff, npts: n,
            zoneKey: group.zoneKey, axis: group.axis, constUtm: group.constUtm,
          });
        } else {
          scratch.truncate(curOff);
        }
      };

      for (let gi = 0; gi < group.members.length; gi++) {
        const coords = group.members[gi]!.coords;
        if (coords.length === 0) continue;
        let startIdx = 0;
        if (scratch.length > curOff) {
          const lastX = raw[scratch.length - 2]!;
          const lastY = raw[scratch.length - 1]!;
          const firstX = coords[0]![0];
          const firstY = coords[0]![1];
          if (Math.abs(lastX - firstX) < 1e-9 && Math.abs(lastY - firstY) < 1e-9) {
            startIdx = 1;
          } else {
            finishCurrent();
            curOff = scratch.length;
          }
        }
        for (let pi = startIdx; pi < coords.length; pi++) {
          const p = coords[pi]!;
          scratch.push2(p[0], p[1]);
        }
      }
      finishCurrent();
    }

    if (segments.length === 0) return;

    scratch.transform(ctx.toView);

    for (const seg of segments) {
      const flat = scratch.slice(seg.offset, seg.npts);
      features.push(new Feature<Geometry>({
        geometry: new LineString(flat, 'XY'),
        gridLineType: 'major',
        mgrsKind: 'grid',
        gridAxis: seg.axis,
        gridConstUtm: seg.constUtm,
        gridZoneKey: seg.zoneKey,
      }));
    }
  }

  private emitCellLabels_(
    labels: GridCellLabel[],
    ctx: RenderContext,
    gzds: Gzd[],
  ): void {
    const scratch = this.projScratch_;
    scratch.reset();
    const texts: string[] = [];
    const pxSizes: number[] = [];

    for (const gzd of gzds) {
      const stat = this.getGzdStatic_(gzd);
      if (stat.cellLabels.length === 0) continue;
      const gzdPxSize = ctx.cellPxSize.get(gzdKey_(gzd))!;
      for (const cell of stat.cellLabels) {
        scratch.push2(cell.lonLat[0], cell.lonLat[1]);
        texts.push(cell.text);
        pxSizes.push(gzdPxSize * cell.sizeFactor);
      }
    }

    if (texts.length === 0) return;

    scratch.transformCached(ctx.toView, this.transformCache_);

    for (let k = 0; k < texts.length; k++) {
      const x = scratch.getX(k);
      const y = scratch.getY(k);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      labels.push({
        point: new Point([x, y]),
        text: texts[k]!,
        cellSizePx: pxSizes[k]!,
      });
    }
  }

  private renderContext_(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): RenderContext {
    return this.ctxCache_.get(extent, resolution, viewProjection, () => {
      const geoExtent = transformExtent(extent, viewProjection, 'EPSG:4326');
      const toView = getTransform('EPSG:4326', viewProjection);
      const interval = this.intervals_.getInterval(resolution, viewProjection);

      const gzds: Gzd[] = [];
      for (const gzd of iterateVisibleGzds(
        geoExtent[0]!, geoExtent[1]!, geoExtent[2]!, geoExtent[3]!,
      )) {
        gzds.push(gzd);
      }

      const cellPxSize = new Map<string, number>();
      const gzdPxSize = new Map<string, number>();
      const gzdCenter = new Map<string, [number, number]>();
      const probeFlat = new Array<number>(gzds.length * 6);
      for (let i = 0; i < gzds.length; i++) {
        const g = gzds[i]!;
        const cLon = (g.lon[0] + g.lon[1]) / 2;
        const cLat = (g.lat[0] + g.lat[1]) / 2;
        probeFlat[i * 6] = cLon;
        probeFlat[i * 6 + 1] = cLat;
        probeFlat[i * 6 + 2] = cLon;
        probeFlat[i * 6 + 3] = cLat + PROBE_LAT_STEP;
        probeFlat[i * 6 + 4] = cLon + PROBE_LON_STEP;
        probeFlat[i * 6 + 5] = cLat;
      }
      if (probeFlat.length > 0) {
        transformBatchCached(probeFlat, probeFlat, 2, toView, this.transformCache_);
      }

      for (let i = 0; i < gzds.length; i++) {
        const g = gzds[i]!;
        const cx = probeFlat[i * 6];
        const cy = probeFlat[i * 6 + 1];
        const py_x = probeFlat[i * 6 + 2];
        const py_y = probeFlat[i * 6 + 3];
        const px_x = probeFlat[i * 6 + 4];
        const px_y = probeFlat[i * 6 + 5];
        if (cx === undefined || cy === undefined ||
            py_x === undefined || py_y === undefined ||
            px_x === undefined || px_y === undefined) continue;
        if (!Number.isFinite(cx) || !Number.isFinite(cy) ||
            !Number.isFinite(py_x) || !Number.isFinite(py_y) ||
            !Number.isFinite(px_x) || !Number.isFinite(px_y)) continue;
        const probeLatPx = Math.hypot(py_x - cx, py_y - cy) / resolution;
        const probeLonPx = Math.hypot(px_x - cx, px_y - cy) / resolution;
        const metresPerDegLon =
          METRES_PER_DEG_LAT * Math.cos(((g.lat[0] + g.lat[1]) / 2) * Math.PI / 180);
        const cellLatPx =
          probeLatPx * (100_000 / (METRES_PER_DEG_LAT * PROBE_LAT_STEP));
        const cellLonPx = metresPerDegLon > 0
          ? probeLonPx * (100_000 / (metresPerDegLon * PROBE_LON_STEP))
          : cellLatPx;
        const cell = Math.min(cellLatPx, cellLonPx);
        const gzdHeightPx =
          probeLatPx * ((g.lat[1] - g.lat[0]) / PROBE_LAT_STEP);
        const gzdWidthPx =
          probeLonPx * ((g.lon[1] - g.lon[0]) / PROBE_LON_STEP);
        const gzdSize = Math.min(gzdWidthPx, gzdHeightPx);
        const key = gzdKey_(g);
        cellPxSize.set(key, cell);
        gzdPxSize.set(key, gzdSize);
        gzdCenter.set(key, [cx, cy]);
      }

      return { geoExtent, interval, gzds, toView, cellPxSize, gzdPxSize, gzdCenter };
    });
  }

  private getGzdStatic_(gzd: Gzd): GzdStatic {
    const key = gzdKey_(gzd);
    const cached = this.gzdStaticCache_.get(key);
    if (cached) return cached;
    const tx = this.transformsFor_(gzd);
    const utmExtent = sampleUtmExtent_(gzd, tx.toProj);
    const tileBounds = utmExtent === null ? null : computeTileBounds_(utmExtent);
    const cellLabels =
      utmExtent === null
        ? []
        : computeCellLabels_(gzd, tx.fromProj, utmExtent);
    const built: GzdStatic = { utmExtent, tileBounds, cellLabels };
    this.gzdStaticCache_.set(key, built);
    return built;
  }


  /** Transforms for a GZD's projected CRS, UTM by zone, UPS by hemisphere. */
  private transformsFor_(gzd: Gzd): ProjectedTransforms {
    if (gzd.zone === 0) {
      const north = gzd.band === 'Y' || gzd.band === 'Z';
      const cached = this.upsTransforms_.get(north);
      if (cached) return cached;
      const code = upsCrsCode(north);
      registerCRS(code, upsProj4(north));
      const created: ProjectedTransforms = {
        toProj: getTransform('EPSG:4326', code),
        fromProj: getTransform(code, 'EPSG:4326'),
      };
      this.upsTransforms_.set(north, created);
      return created;
    }
    const cached = this.utmTransforms_.get(gzd.zone);
    if (cached) return cached;
    const code = utmCrsCode(gzd.zone, false);
    registerCRS(code, utmProj4(gzd.zone));
    const created: ProjectedTransforms = {
      toProj: getTransform('EPSG:4326', code),
      fromProj: getTransform(code, 'EPSG:4326'),
    };
    this.utmTransforms_.set(gzd.zone, created);
    return created;
  }
}

function gzdKey_(gzd: Gzd): string {
  return `${gzd.zone}|${gzd.band}`;
}

/** Pick a densification count for interior grid lines based on the interval. */
function interiorDensity_(interval: number, defaultDensity: number): number {
  if (interval >= 100_000) return defaultDensity;
  if (interval >= 10_000) return Math.min(4, defaultDensity);
  if (interval >= 1_000) return 2;
  return 1;
}

function addSegment_(
  map: Map<number, [number, number][]>,
  key: number,
  lo: number,
  hi: number,
): void {
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  arr.push([lo, hi]);
}

/** Merge segments that touch or overlap, leaving disjoint ones separate. */
function mergeSegments_(segs: [number, number][]): [number, number][] {
  if (segs.length <= 1) return segs;
  const sorted = segs.slice().sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [[sorted[0]![0], sorted[0]![1]]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur[0] <= last[1]) {
      if (cur[1] > last[1]) last[1] = cur[1];
    } else {
      out.push([cur[0], cur[1]]);
    }
  }
  return out;
}

/**
 * Sample a lat/lon rectangle along its four edges, projecting each sample to
 * UTM, and return the resulting UTM bbox. Boundary samples at ±180°/±90° are
 * nudged inward by 1 µ° to avoid proj4 singularities.
 */
function sampleLatLonRectInUtm_(
  lonW: number, lonE: number, latS: number, latN: number,
  toUtm: TransformFunction,
  samples: number,
): Extent | null {
  const EPS = 1e-6;
  const lonWE = lonW <= -180 ? -180 + EPS : lonW;
  const lonEE = lonE >=  180 ?  180 - EPS : lonE;
  const latSE = latS <= -90  ?  -90 + EPS : latS;
  const latNE = latN >=  90  ?   90 - EPS : latN;
  let minE = Infinity, minN = Infinity, maxE = -Infinity, maxN = -Infinity;
  const consider = (e: number | undefined, n: number | undefined): void => {
    if (e === undefined || n === undefined) return;
    if (!Number.isFinite(e) || !Number.isFinite(n)) return;
    if (e < minE) minE = e;
    if (e > maxE) maxE = e;
    if (n < minN) minN = n;
    if (n > maxN) maxN = n;
  };
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const lon = lonWE + t * (lonEE - lonWE);
    const lat = latSE + t * (latNE - latSE);
    const top = toUtm([lon, latNE], undefined, 2);
    const bottom = toUtm([lon, latSE], undefined, 2);
    const left = toUtm([lonWE, lat], undefined, 2);
    const right = toUtm([lonEE, lat], undefined, 2);
    consider(top[0], top[1]);
    consider(bottom[0], bottom[1]);
    consider(left[0], left[1]);
    consider(right[0], right[1]);
  }
  if (!Number.isFinite(minE)) return null;
  return [minE, minN, maxE, maxN];
}

/** Sample the UTM extent of a GZD's lat/lon footprint along its four edges. */
function sampleUtmExtent_(gzd: Gzd, toUtm: TransformFunction): Extent | null {
  return sampleLatLonRectInUtm_(gzd.lon[0], gzd.lon[1], gzd.lat[0], gzd.lat[1], toUtm, 8);
}

/** Pre-compute every cell label for a GZD. */
function computeCellLabels_(
  gzd: Gzd,
  fromUtm: TransformFunction,
  utmExtent: Extent,
): GzdStatic['cellLabels'] {
  const [minE, minN, maxE, maxN] = utmExtent;
  const startE = Math.floor(minE / 100_000) * 100_000;
  const startN = Math.floor(minN / 100_000) * 100_000;
  const out: { lonLat: readonly [number, number]; text: string; sizeFactor: number }[] = [];

  const lonLo = gzd.lon[0];
  const lonHi = gzd.lon[1];
  const latLo = gzd.lat[0];
  const latHi = gzd.lat[1];

  const isUps = gzd.zone === 0;
  const upsZone = gzd.band as 'Y' | 'Z' | 'A' | 'B';
  const colFn = isUps
    ? (e: number) => upsColumnLetter(upsZone, e)
    : (e: number) => columnLetter(gzd.zone, e);
  const rowFn = isUps
    ? (n: number) => upsRowLetter(upsZone, n)
    : (n: number) => rowLetter(gzd.zone, n);

  if (isUps) {
    interface UpsCandidate { cellE: number; cellN: number; col: string; row: string }
    const candidates: UpsCandidate[] = [];
    for (let e = startE; e <= maxE; e += 100_000) {
      const cellE = e + 50_000;
      const col = colFn(cellE);
      if (col === undefined) continue;
      for (let n = startN; n <= maxN; n += 100_000) {
        const cellN = n + 50_000;
        const row = rowFn(cellN);
        if (row === undefined) continue;
        candidates.push({ cellE, cellN, col, row });
      }
    }
    if (candidates.length === 0) return out;
    const flat = new Array<number>(candidates.length * 2);
    for (let i = 0; i < candidates.length; i++) {
      flat[i * 2] = candidates[i]!.cellE;
      flat[i * 2 + 1] = candidates[i]!.cellN;
    }
    fromUtm(flat, flat, 2);
    for (let i = 0; i < candidates.length; i++) {
      const cLon = flat[i * 2]!;
      const cLat = flat[i * 2 + 1]!;
      if (!Number.isFinite(cLon) || !Number.isFinite(cLat)) continue;
      if (cLat < latLo || cLat >= latHi) continue;
      let labelLon = cLon;
      if (labelLon < lonLo) labelLon += 360;
      else if (labelLon > lonHi) labelLon -= 360;
      if (labelLon < lonLo || labelLon > lonHi) continue;
      out.push({
        lonLat: [labelLon, cLat],
        text: candidates[i]!.col + candidates[i]!.row,
        sizeFactor: 1,
      });
    }
    return out;
  }

  for (let e = startE; e <= maxE; e += 100_000) {
    const cellE = e + 50_000;
    const col = colFn(cellE);
    if (col === undefined) continue;
    for (let n = startN; n <= maxN; n += 100_000) {
      const cellN = n + 50_000;
      const row = rowFn(cellN);
      if (row === undefined) continue;
      const center = fromUtm([cellE, cellN], undefined, 2);
      const cLon = center[0];
      const cLat = center[1];
      if (cLon === undefined || cLat === undefined) continue;
      if (!Number.isFinite(cLon) || !Number.isFinite(cLat)) continue;
      if (cLat < latLo || cLat >= latHi) continue;
      const polygon = sampleCellPolygon_(e, e + 100_000, n, n + 100_000, fromUtm);
      const origArea = polygonArea(polygon);
      if (origArea === 0) continue;
      const clipped = clipPolygonToRect(polygon, lonLo, latLo, lonHi, latHi);
      if (clipped.length < 3) continue;
      const clippedArea = polygonArea(clipped);
      if (clippedArea / origArea < MIN_CELL_AREA_FRACTION) continue;
      const [ix, iy] = new Polygon([clipped]).getFlatInteriorPoint();
      if (ix === undefined || iy === undefined || !Number.isFinite(ix) || !Number.isFinite(iy)) continue;
      const labelLon = ix;
      const labelLat = iy;
      const sizeFactor = Math.min(1, Math.sqrt(clippedArea / origArea));
      out.push({
        lonLat: [labelLon, labelLat],
        text: col + row,
        sizeFactor,
      });
    }
  }
  return out;
}

/** Sample 8 perimeter points (4 corners + 4 edge midpoints) of a UTM cell, projected to lat/lon. */
function sampleCellPolygon_(
  eMin: number,
  eMax: number,
  nMin: number,
  nMax: number,
  fromUtm: TransformFunction,
): [number, number][] {
  const eMid = (eMin + eMax) / 2;
  const nMid = (nMin + nMax) / 2;
  const corners: [number, number][] = [
    [eMin, nMin], [eMid, nMin], [eMax, nMin],
    [eMax, nMid],
    [eMax, nMax], [eMid, nMax], [eMin, nMax],
    [eMin, nMid],
  ];
  const points: [number, number][] = [];
  for (const [e, n] of corners) {
    const ll = fromUtm([e, n], undefined, 2);
    const lon = ll[0];
    const lat = ll[1];
    if (lon === undefined || lat === undefined) continue;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    points.push([lon, lat]);
  }
  return points;
}

/** Compute the inclusive integer 100 km tile bounds covering a UTM extent. */
function computeTileBounds_(utmExtent: Extent): GzdStatic['tileBounds'] {
  return {
    eMin: Math.floor(utmExtent[0] / 100_000),
    eMax: Math.floor(utmExtent[2] / 100_000),
    nMin: Math.floor(utmExtent[1] / 100_000),
    nMax: Math.floor(utmExtent[3] / 100_000),
  };
}

/** Compute the lat/lon-clipped, projected-to-UTM viewport extent for one (zone, band). Returns `null` on no overlap. */
function computeBandViewportUtm_(
  gzd: Gzd,
  geoExtent: Extent,
  toUtm: TransformFunction,
): Extent | null {
  const lonW = Math.max(geoExtent[0]!, gzd.lon[0]);
  const lonE = Math.min(geoExtent[2]!, gzd.lon[1]);
  const latS = Math.max(geoExtent[1]!, gzd.lat[0]);
  const latN = Math.min(geoExtent[3]!, gzd.lat[1]);
  if (lonE <= lonW || latN <= latS) return null;
  return sampleLatLonRectInUtm_(lonW, lonE, latS, latN, toUtm, 4);
}

/** Densify, pole-clamp, antimeridian-unwrap, lon-window-shift, and clip one UTM grid line into `out`. */
function pushClippedLine_(
  out: { coords: [number, number][]; axis: 'e' | 'n'; constUtm: number }[],
  axis: 'e' | 'n',
  constUtm: number,
  sweepStart: number,
  sweepEnd: number,
  density: number,
  gzd: Gzd,
  fromUtm: TransformFunction,
): void {
  const lonLat: [number, number][] = [];
  for (let i = 0; i <= density; i++) {
    const t = i / density;
    const sweep = sweepStart + t * (sweepEnd - sweepStart);
    const e = axis === 'e' ? constUtm : sweep;
    const n = axis === 'e' ? sweep : constUtm;
    const ll = fromUtm([e, n], undefined, 2);
    let lon = ll[0];
    let lat = ll[1];
    if (lon === undefined || lat === undefined) continue;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (lat > 89.9999) lat = 89.9999;
    else if (lat < -89.9999) lat = -89.9999;
    if (lonLat.length > 0) {
      const prevLon = lonLat[lonLat.length - 1]![0];
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    lonLat.push([lon, lat]);
  }
  if (lonLat.length < 2) return;
  const targetLon = (gzd.lon[0] + gzd.lon[1]) / 2;
  const shift = 360 * Math.round((targetLon - lonLat[0]![0]) / 360);
  if (shift !== 0) {
    for (const p of lonLat) p[0] += shift;
  }
  const pieces = clipPolylineToRect(
    lonLat, gzd.lon[0], gzd.lat[0], gzd.lon[1], gzd.lat[1],
  );
  for (const piece of pieces) {
    if (piece.length >= 2) out.push({ coords: piece, axis, constUtm });
  }
}

