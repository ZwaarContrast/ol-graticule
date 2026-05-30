import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { get as getProjection, getTransform, transform } from 'ol/proj';
import { getIntersection, isEmpty } from 'ol/extent';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type { ProjectionLike, TransformFunction } from 'ol/proj';
import type {
  GridSystem,
  GridLabel,
  GridCellLabel,
  FormattedCoordinate,
} from '../types.js';
import { isCombinedFormatted } from '../types.js';
import { pointInRing, pointInRings } from '../clipping/pointInRing.js';
import { PolygonEdgeIndex } from '../clipping/PolygonEdgeIndex.js';
import { clipPolylineToPolygon, createClipScratch, type ClipScratch } from '../clipping/clipPolylineToPolygon.js';
import { clipPolygonToConvex } from '../clipping/clipPolygonToConvex.js';
import { densifyRing, projectRing } from '../clipping/densifyRing.js';
import { snapRingToCellGrid } from '../clipping/snapRingToCellGrid.js';
import { transformExtentSampled } from '../util/geo.js';
import { ParseError } from '../util/ParseError.js';

/** Clip-polygon input for {@link PolygonClippedGridSystem}. */
export interface PolygonClip {
  /** Polygon rings in `crs` coordinates; first ring is the outer boundary. Open lists. */
  rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  /** Coordinate system the `rings` are expressed in. */
  crs: ProjectionLike;
}

export interface PolygonClippedGridSystemOptions {
  /** The grid system whose features, labels, and coordinates get clipped. */
  source: GridSystem;
  /** The clip polygon. */
  clipPolygon: PolygonClip;
  /** Emit the polygon outline as a `gridLineType: 'boundary'` feature (default: true). */
  emitBoundary?: boolean | undefined;
  /** Evenly-spaced interior samples inserted per outer-ring edge before projection (default: 4). */
  ringStepsPerEdge?: number | undefined;
  /** Cell-aligned clipping callback returning cell size in polygon-CRS units, or undefined. */
  cellSnapInterval?:
    | ((resolution: number, viewProjection: ProjectionLike) => number | undefined)
    | undefined;
}

interface ViewState {
  projectedRings: [number, number][][];
  index: PolygonEdgeIndex;
  polyCrsRings: [number, number][][];
  polyCrsIndex: PolygonEdgeIndex;
  maxSegmentLength: number | null;
  viewToPolygon: TransformFunction;
  polygonToView: TransformFunction;
}

/** Wraps a GridSystem to clip its features and labels against a polygon. */
export class PolygonClippedGridSystem implements GridSystem {
  private readonly source_: GridSystem;
  private readonly polygonCrs_: ProjectionLike;
  private readonly sourceRingOpen_: ReadonlyArray<readonly [number, number]>;
  private readonly densifiedSourceRing_: [number, number][];
  private readonly ringStepsPerEdge_: number;
  private readonly emitBoundary_: boolean;
  private readonly cellSnapInterval_:
    | ((resolution: number, viewProjection: ProjectionLike) => number | undefined)
    | undefined;
  private readonly viewCache_: Map<string, ViewState> = new Map();
  private readonly clipScratch_: ClipScratch = createClipScratch();
  private lastSnapRingsInPolygonCrs_: [number, number][][] | null = null;

  constructor(options: PolygonClippedGridSystemOptions) {
    this.source_ = options.source;
    this.polygonCrs_ = options.clipPolygon.crs;

    const rings = options.clipPolygon.rings;
    if (rings.length === 0 || rings[0]!.length < 3) {
      throw new Error(
        'PolygonClippedGridSystem: clipPolygon.rings must contain at least ' +
        'one outer ring with 3+ vertices',
      );
    }
    this.sourceRingOpen_ = rings[0]!;

    this.ringStepsPerEdge_ = options.ringStepsPerEdge ?? 4;
    this.densifiedSourceRing_ = densifyRing(this.sourceRingOpen_, this.ringStepsPerEdge_);
    this.emitBoundary_ = options.emitBoundary ?? true;
    this.cellSnapInterval_ = options.cellSnapInterval;
  }

  getFeatures(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): Feature<Geometry>[] {
    const view = this.viewState_(viewProjection, resolution);
    const clippedExtent = getIntersection(extent, view.index.ringExtent);
    if (isEmpty(clippedExtent)) return [];

    const sourceFeatures = this.source_.getFeatures(clippedExtent, resolution, viewProjection);
    const out: Feature<Geometry>[] = [];

    for (const feature of sourceFeatures) {
      const geom = feature.getGeometry();
      if (!(geom instanceof LineString)) {
        out.push(feature);
        continue;
      }

      const flat = geom.getFlatCoordinates();
      const stride = geom.getStride();
      let coords: ReadonlyArray<number>;
      let coordOffset: number;
      let coordEnd: number;
      let coordStride: number;

      if (view.maxSegmentLength !== null) {
        coords = densifyPolylineFlatViaPolygonCrs_(
          flat,
          0,
          flat.length,
          stride,
          view.viewToPolygon,
          view.polygonToView,
          view.maxSegmentLength,
        );
        coordOffset = 0;
        coordEnd = coords.length;
        coordStride = 2;
      } else {
        coords = flat;
        coordOffset = 0;
        coordEnd = flat.length;
        coordStride = stride;
      }

      const clipped = clipPolylineToPolygon(
        coords,
        coordOffset,
        coordEnd,
        coordStride,
        view.index,
        this.clipScratch_,
      );

      for (const piece of clipped) {
        const f = new Feature<Geometry>({ geometry: new LineString(piece, 'XY') });
        copyFeatureProperties_(feature, f);
        out.push(f);
      }
    }

    const isSnap = view.maxSegmentLength !== null;
    if (this.emitBoundary_ && !isSnap && extentOverlaps_(extent, view.index.ringExtent)) {
      for (let r = 0; r < view.projectedRings.length; r++) {
        out.push(this.buildBoundaryFeature_(view.projectedRings[r]!));
      }
    }

    return out;
  }

  getLabels(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): GridLabel[] {
    const view = this.viewState_(viewProjection, resolution);
    const clippedExtent = getIntersection(extent, view.index.ringExtent);
    if (isEmpty(clippedExtent)) return [];

    const labels = this.source_.getLabels(clippedExtent, resolution, viewProjection);
    const ringsPolyCrs = view.polyCrsRings;
    const polyExtent = transformExtentSampled(clippedExtent, view.viewToPolygon);
    if (!isFinite(polyExtent[0]!)) return [];
    const [pMinX, pMinY, pMaxX, pMaxY] = polyExtent;
    return labels.filter((label) => {
      const [vx, vy] = label.point.getCoordinates();
      const polyXY = view.viewToPolygon([vx!, vy!], undefined, 2);
      const px = polyXY[0];
      const py = polyXY[1];
      if (px === undefined || py === undefined) return false;
      if (!isFinite(px) || !isFinite(py)) return false;
      const axis = label.axis;
      const eps = axis === 'x'
        ? Math.max(Math.abs(px), pMaxX - pMinX, 1) * 1e-9
        : Math.max(Math.abs(py), pMaxY - pMinY, 1) * 1e-9;
      const midX = axis === 'x' ? px : (pMinX + pMaxX) * 0.5;
      const midY = axis === 'x' ? (pMinY + pMaxY) * 0.5 : py;
      if (view.polyCrsIndex.pointInRing(midX, midY)) return true;
      for (let r = 0; r < ringsPolyCrs.length; r++) {
        const hit = axis === 'x'
          ? gridLineCrossesRing_(px, 'x', pMinY, pMaxY, ringsPolyCrs[r]!, eps)
          : gridLineCrossesRing_(py, 'y', pMinX, pMaxX, ringsPolyCrs[r]!, eps);
        if (hit) return true;
      }
      return false;
    });
  }

  getCellLabels(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): GridCellLabel[] {
    if (!this.source_.getCellLabels) return [];
    const labels = this.source_.getCellLabels(extent, resolution, viewProjection);
    const view = this.viewState_(viewProjection, resolution);
    const rings = view.projectedRings;
    const clipRing = rings[0];
    const out: GridCellLabel[] = [];
    for (const label of labels) {
      const [cx, cy] = label.point.getCoordinates();
      if (cx === undefined || cy === undefined) continue;
      const cellRing = label.cellRing;
      if (!cellRing || cellRing.length < 3 || !clipRing) {
        if (view.index.pointInRing(cx, cy)) out.push(label);
        continue;
      }
      const allInside = ringFullyInsideIndexed_(cellRing, view.index);
      if (allInside) {
        out.push(label);
        continue;
      }
      const clipped = clipPolygonToConvex(cellRing, clipRing);
      if (clipped.length < 3) continue;
      const interior = new Polygon([clipped]).getFlatInteriorPoint();
      const [ix, iy] = interior;
      if (ix === undefined || iy === undefined || !Number.isFinite(ix) || !Number.isFinite(iy)) continue;
      const replaced: GridCellLabel = {
        point: new Point([ix, iy]),
        text: label.text,
        cellSizePx: clippedCellSizePx_(cellRing, clipped, label.cellSizePx),
      };
      if (label.cellRing) replaced.cellRing = label.cellRing;
      out.push(replaced);
    }
    return out;
  }

  isValidCoordinate(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): boolean {
    if (this.source_.isValidCoordinate &&
        !this.source_.isValidCoordinate(coordinate, viewProjection)) {
      return false;
    }
    return this.coordIsInsidePolygon_(coordinate, viewProjection);
  }

  formatCoordinate(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): FormattedCoordinate {
    if (this.isValidCoordinate(coordinate, viewProjection)) {
      return this.source_.formatCoordinate(coordinate, viewProjection);
    }
    const sample = this.source_.formatCoordinate(coordinate, viewProjection);
    return isCombinedFormatted(sample) ? { combined: '-' } : { x: '-', y: '-' };
  }

  parseCoordinate(text: string, viewProjection: ProjectionLike): [number, number] {
    if (!this.source_.parseCoordinate) {
      throw new ParseError(text, 'source grid system does not support parseCoordinate');
    }
    return this.source_.parseCoordinate(text, viewProjection);
  }

  private viewState_(viewProjection: ProjectionLike, resolution: number): ViewState {
    const snapInterval = this.cellSnapInterval_?.(resolution, viewProjection);
    const code = projectionCacheKey_(viewProjection);
    const variant = snapInterval !== undefined ? `snap:${snapInterval}` : 'raw';
    const key = `${code}|${variant}`;
    const cached = this.viewCache_.get(key);
    if (cached) return cached;

    const clipRingsInPolygonCrs = this.buildClipRings_(snapInterval);
    const projectedRings = projectRingList_(clipRingsInPolygonCrs, this.polygonCrs_, viewProjection);
    const state: ViewState = {
      projectedRings,
      index: new PolygonEdgeIndex(projectedRings),
      polyCrsRings: clipRingsInPolygonCrs,
      polyCrsIndex: new PolygonEdgeIndex(clipRingsInPolygonCrs),
      viewToPolygon: getTransform(viewProjection, this.polygonCrs_),
      polygonToView: getTransform(this.polygonCrs_, viewProjection),
      maxSegmentLength: snapInterval !== undefined
        ? snapInterval / Math.max(this.ringStepsPerEdge_, 1)
        : null,
    };
    this.viewCache_.set(key, state);
    return state;
  }

  private buildClipRings_(snapInterval: number | undefined): [number, number][][] {
    if (snapInterval === undefined) {
      this.lastSnapRingsInPolygonCrs_ = null;
      return [this.densifiedSourceRing_];
    }
    const snapped = snapRingToCellGrid(this.sourceRingOpen_, snapInterval);
    if (snapped.length === 0) {
      this.lastSnapRingsInPolygonCrs_ = null;
      return [this.densifiedSourceRing_];
    }
    this.lastSnapRingsInPolygonCrs_ = snapped.map((r) => r.slice());
    const eps = snapInterval * 1e-3;
    return snapped.map((ring) =>
      densifyRing(inflateRectilinearRing_(ring, eps), this.ringStepsPerEdge_),
    );
  }

  private coordIsInsidePolygon_(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): boolean {
    const projCode = projectionCacheKey_(viewProjection);
    const polyCode = projectionCacheKey_(this.polygonCrs_);
    const [x, y] = projCode === polyCode
      ? coordinate
      : transform(coordinate, viewProjection, this.polygonCrs_);
    if (x === undefined || y === undefined) return false;
    if (!isFinite(x) || !isFinite(y)) return false;
    if (this.lastSnapRingsInPolygonCrs_) {
      return pointInRings(x, y, this.lastSnapRingsInPolygonCrs_);
    }
    return pointInRing(x, y, this.sourceRingOpen_);
  }



  private buildBoundaryFeature_(ring: [number, number][]): Feature<Geometry> {
    return new Feature<Geometry>({
      geometry: new LineString([...ring, ring[0]!]),
      gridLineType: 'boundary',
    });
  }
}

function projectionCacheKey_(projection: ProjectionLike): string {
  const resolved = getProjection(projection);
  if (resolved) return resolved.getCode();
  return String(projection);
}

function extentOverlaps_(a: Extent, b: Extent): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function ringFullyInsideIndexed_(
  ring: ReadonlyArray<readonly [number, number]>,
  index: PolygonEdgeIndex,
): boolean {
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    if (!index.pointInRing(p[0], p[1])) return false;
  }
  return true;
}

function clippedCellSizePx_(
  original: ReadonlyArray<readonly [number, number]>,
  clipped: ReadonlyArray<readonly [number, number]>,
  originalSizePx: number,
): number {
  const orig = ringMinExtent_(original);
  const clip = ringMinExtent_(clipped);
  if (orig <= 0) return originalSizePx;
  return originalSizePx * (clip / orig);
}

function ringMinExtent_(ring: ReadonlyArray<readonly [number, number]>): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return w < h ? w : h;
}

function projectRingList_(
  rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  from: ProjectionLike,
  to: ProjectionLike,
): [number, number][][] {
  const out: [number, number][][] = [];
  for (let r = 0; r < rings.length; r++) {
    const pr = projectRing(rings[r]!, from, to);
    if (pr.length >= 3) out.push(pr);
  }
  return out;
}

function densifyPolylineFlatViaPolygonCrs_(
  flat: ReadonlyArray<number>,
  offset: number,
  end: number,
  stride: number,
  viewToPoly: TransformFunction,
  polyToView: TransformFunction,
  maxSegmentLength: number,
): number[] {
  const count = (end - offset) / stride;
  if (count < 2 || !(maxSegmentLength > 0)) {
    const passthrough: number[] = [];
    for (let i = offset; i < end; i += stride) {
      passthrough.push(flat[i]!, flat[i + 1]!);
    }
    return passthrough;
  }
  const out: number[] = [];
  out.push(flat[offset]!, flat[offset + 1]!);
  for (let i = 0; i < count - 1; i++) {
    const o0 = offset + i * stride;
    const o1 = o0 + stride;
    const p0View: [number, number] = [flat[o0]!, flat[o0 + 1]!];
    const p1View: [number, number] = [flat[o1]!, flat[o1 + 1]!];
    const p0Poly = viewToPoly(p0View, undefined, 2);
    const p1Poly = viewToPoly(p1View, undefined, 2);
    const dx = p1Poly[0]! - p0Poly[0]!;
    const dy = p1Poly[1]! - p0Poly[1]!;
    const dist = Math.hypot(dx, dy);
    const segments = Math.max(1, Math.ceil(dist / maxSegmentLength));
    for (let k = 1; k < segments; k++) {
      const t = k / segments;
      const ix = p0Poly[0]! + t * dx;
      const iy = p0Poly[1]! + t * dy;
      const proj = polyToView([ix, iy], undefined, 2);
      const px = proj[0];
      const py = proj[1];
      if (px !== undefined && py !== undefined && isFinite(px) && isFinite(py)) {
        out.push(px, py);
      }
    }
    out.push(p1View[0], p1View[1]);
  }
  return out;
}

function inflateRectilinearRing_(
  ring: ReadonlyArray<readonly [number, number]>,
  eps: number,
): [number, number][] {
  const n = ring.length;
  const out: [number, number][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = ring[(i + n - 1) % n]!;
    const cur = ring[i]!;
    const next = ring[(i + 1) % n]!;
    const [n1x, n1y] = unitOutwardNormal_(cur[0] - prev[0], cur[1] - prev[1]);
    const [n2x, n2y] = unitOutwardNormal_(next[0] - cur[0], next[1] - cur[1]);
    const denom = 1 + n1x * n2x + n1y * n2y;
    const scale = denom > 1e-12 ? eps / denom : eps * 0.5;
    out[i] = [cur[0] + (n1x + n2x) * scale, cur[1] + (n1y + n2y) * scale];
  }
  return out;
}

function unitOutwardNormal_(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy);
  if (len === 0) return [0, 0];
  return [dy / len, -dx / len];
}

function gridLineCrossesRing_(
  value: number,
  axis: 'x' | 'y',
  rangeMin: number,
  rangeMax: number,
  ring: ReadonlyArray<readonly [number, number]>,
  eps = 0,
): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    const a0 = axis === 'x' ? a[0] : a[1];
    const a1 = axis === 'x' ? a[1] : a[0];
    const b0 = axis === 'x' ? b[0] : b[1];
    const b1 = axis === 'x' ? b[1] : b[0];
    const da = a0 - value;
    const db = b0 - value;
    if (da > eps && db > eps) continue;
    if (da < -eps && db < -eps) continue;
    if (da === db) continue;
    const t = da / (da - db);
    const cross = a1 + t * (b1 - a1);
    if (cross >= rangeMin && cross <= rangeMax) return true;
  }
  return false;
}

function copyFeatureProperties_(
  src: Feature<Geometry>,
  dst: Feature<Geometry>,
): void {
  for (const key of ['gridLineType', 'gridAxis', 'gridValue'] as const) {
    const value = src.get(key);
    if (value !== undefined) dst.set(key, value);
  }
}
