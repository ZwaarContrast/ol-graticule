/** Kriegsmarine Naval Grid (Marinequadratkarte) system for the UniversalGraticule. */

import type Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import type { Extent } from 'ol/extent';
import { intersects as olExtentsIntersect } from 'ol/extent';
import type { ProjectionLike } from 'ol/proj';
import { getTransform, transform, transformExtent } from 'ol/proj';
import type { Geometry } from 'ol/geom';

import type {
  GridSystem,
  GridLabel,
  GridCellLabel,
  FormattedCoordinate,
  FlatLineSpec,
} from '@zwaarcontrast/ol-graticule';
import {
  BoundedCache,
  ProjectionScratch,
  RenderCache,
  TransformCache,
  emitFlatLineFeatures,
  uniformTs,
  transformBatchCached,
} from '@zwaarcontrast/ol-graticule';
import {
  findById,
  ensureIndexed,
  getLargeSquaresInLatRange,
} from '../kriegsmarine/lookup.js';
import { coordinateToGridRef, formatGridRef, childRefCandidates, gridRefToCoordinate } from '../kriegsmarine/format.js';
import { ParseError } from '@zwaarcontrast/ol-graticule';
import {
  squareExtent,
  squareScreenSize,
  squareCenter,
  densityForPxSize,
  interpolateLon,
} from '../kriegsmarine/geo.js';
import type { Square } from '../kriegsmarine/types.js';
import { isPolySquare, isRectSquare } from '../kriegsmarine/types.js';
import {
  rectEdges,
  polyEdges,
  mergeEdges,
  type RawEdge,
} from '../kriegsmarine/edgeMerge.js';

export interface KriegsmarineGridSystemOptions {
  /** Maximum subdivision depth (0 = large squares only, 4 = Kleinquadrat). Default: 4. */
  maxDepth?: number | undefined;
  /** Minimum screen pixels a square must span before subdividing. Default: 80. */
  minSquarePx?: number | undefined;
}

interface Leaf {
  sq: Square;
  pxSize: number;
  depth: number;
}

function cursorKey(coordinate: [number, number], projection: ProjectionLike): string {
  const code = typeof projection === 'string' ? projection : projection?.getCode() ?? '';
  return `${code}|${Math.round(coordinate[0])}|${Math.round(coordinate[1])}`;
}

export class KriegsmarineGridSystem implements GridSystem {
  private readonly maxDepth_: number;
  private readonly minSquarePx_: number;
  private readonly traversalCache_ = new RenderCache<Leaf[]>();
  private readonly specsCache_ = new RenderCache<FlatLineSpec[]>();
  private readonly projScratch_ = new ProjectionScratch();
  private readonly cursorCache_ = new BoundedCache<string, FormattedCoordinate>(512);
  private readonly transformCache_ = new TransformCache();

  constructor(options?: KriegsmarineGridSystemOptions | undefined) {
    this.maxDepth_ = options?.maxDepth ?? 4;
    this.minSquarePx_ = options?.minSquarePx ?? 80;
    ensureIndexed();
  }

  getFeatures(extent: Extent, resolution: number, viewProjection: ProjectionLike): Feature<Geometry>[] {
    const specs = this.specsCache_.get(extent, resolution, viewProjection, () => {
      const leaves = this.traverse_(extent, resolution, viewProjection);
      const geoExtent = transformExtent(extent, viewProjection, 'EPSG:4326');
      const [vMinLon, vMinLat, vMaxLon, vMaxLat] = geoExtent;

      const classified: RawEdge[] = [];
      for (let i = 0; i < leaves.length; i++) {
        const { sq, depth } = leaves[i]!;
        if (isPolySquare(sq)) {
          polyEdges(sq, depth, classified);
        } else {
          rectEdges(sq, depth, classified);
        }
      }

      const merged = mergeEdges(classified);
      if (merged.length === 0) return [];

      // Drop edges that fall entirely outside the visible viewport.
      const visible: typeof merged = [];
      for (const e of merged) {
        if (e.axis === 'v') {
          if (e.lon! < vMinLon || e.lon! > vMaxLon) continue;
          if (e.latHi! < vMinLat || e.latLo! > vMaxLat) continue;
        } else if (e.axis === 'h') {
          if (e.lat! < vMinLat || e.lat! > vMaxLat) continue;
          if (e.lonHi! < vMinLon || e.lonLo! > vMaxLon) continue;
        } else {
          const dMinLon = Math.min(e.p1![1], e.p2![1]);
          const dMaxLon = Math.max(e.p1![1], e.p2![1]);
          const dMinLat = Math.min(e.p1![0], e.p2![0]);
          const dMaxLat = Math.max(e.p1![0], e.p2![0]);
          if (dMaxLon < vMinLon || dMinLon > vMaxLon) continue;
          if (dMaxLat < vMinLat || dMinLat > vMaxLat) continue;
        }
        visible.push(e);
      }
      if (visible.length === 0) return [];

      const transformFn = getTransform('EPSG:4326', viewProjection);

      const probe = new Array<number>(visible.length * 4);
      for (let i = 0; i < visible.length; i++) {
        const e = visible[i]!;
        const o = i * 4;
        if (e.axis === 'v') {
          probe[o] = e.lon!;     probe[o + 1] = e.latLo!;
          probe[o + 2] = e.lon!; probe[o + 3] = e.latHi!;
        } else if (e.axis === 'h') {
          probe[o] = e.lonLo!;     probe[o + 1] = e.lat!;
          probe[o + 2] = e.lonHi!; probe[o + 3] = e.lat!;
        } else {
          probe[o] = e.p1![1];     probe[o + 1] = e.p1![0];
          probe[o + 2] = e.p2![1]; probe[o + 3] = e.p2![0];
        }
      }
      transformBatchCached(probe, probe, 2, transformFn, this.transformCache_);

      const built: FlatLineSpec[] = new Array(visible.length);
      for (let i = 0; i < visible.length; i++) {
        const e = visible[i]!;
        const o = i * 4;
        const dx = probe[o + 2]! - probe[o]!;
        const dy = probe[o + 3]! - probe[o + 1]!;
        const pxSize = Math.sqrt(dx * dx + dy * dy) / resolution;
        const ts = uniformTs(densityForPxSize(pxSize));
        const props = {
          gridSquare: e.squareIds[0],
          gridSquares: e.squareIds,
          gridDepth: e.depth,
        };
        if (e.axis === 'v') {
          built[i] = {
            startX: e.lon!, startY: e.latLo!,
            endX: e.lon!, endY: e.latHi!,
            ts, props,
          };
        } else if (e.axis === 'h') {
          built[i] = {
            startX: e.lonLo!, startY: e.lat!,
            endX: e.lonHi!, endY: e.lat!,
            ts, props,
          };
        } else {
          built[i] = {
            startX: e.p1![1], startY: e.p1![0],
            endX: e.p2![1], endY: e.p2![0],
            ts, props,
            xInterp: interpolateLon,
          };
        }
      }
      return built;
    });

    if (specs.length === 0) return [];
    const transformFn = getTransform('EPSG:4326', viewProjection);
    const features: Feature<Geometry>[] = [];
    emitFlatLineFeatures(features, this.projScratch_, specs, transformFn);
    return features;
  }

  getLabels(_extent: Extent, _resolution: number, _viewProjection: ProjectionLike): GridLabel[] {
    return [];
  }

  getCellLabels(extent: Extent, resolution: number, viewProjection: ProjectionLike): GridCellLabel[] {
    const leaves = this.traverse_(extent, resolution, viewProjection);
    const labels: GridCellLabel[] = [];
    for (const { sq, pxSize } of leaves) {
      if (pxSize < 20) continue;
      labels.push({
        point: new Point(squareCenter(sq, viewProjection)),
        text: formatGridRef(sq.id),
        cellSizePx: pxSize,
      });
    }
    return labels;
  }

  formatCoordinate(coordinate: [number, number], viewProjection: ProjectionLike): FormattedCoordinate {
    const key = cursorKey(coordinate, viewProjection);
    const cached = this.cursorCache_.get(key);
    if (cached !== undefined) return cached;
    const [lon, lat] = transform(coordinate, viewProjection, 'EPSG:4326');
    let result: FormattedCoordinate;
    if (lon === undefined || lat === undefined) {
      result = { combined: '-' };
    } else {
      const ref = coordinateToGridRef([lat, lon], this.maxDepth_);
      result = { combined: ref ? formatGridRef(ref) : '-' };
    }
    this.cursorCache_.set(key, result);
    return result;
  }

  parseCoordinate(text: string, viewProjection: ProjectionLike): [number, number] {
    const [lat, lon] = gridRefToCoordinate(text);
    const projected = transform([lon, lat], 'EPSG:4326', viewProjection);
    const px = projected[0];
    const py = projected[1];
    if (px === undefined || py === undefined || !Number.isFinite(px) || !Number.isFinite(py)) {
      throw new ParseError(text, 'transform produced non-finite coordinate');
    }
    return [px, py];
  }

  /** Walk the grid tree and return every leaf square; memoized per render frame. */
  private traverse_(extent: Extent, resolution: number, viewProjection: ProjectionLike): Leaf[] {
    return this.traversalCache_.get(extent, resolution, viewProjection, () => {
      const leaves: Leaf[] = [];
      const geoExtent = transformExtent(extent, viewProjection, 'EPSG:4326');
      const subdivideThreshold = this.minSquarePx_ * 3;

      // Use latitude index to narrow down candidate squares
      const candidates = getLargeSquaresInLatRange(geoExtent[1], geoExtent[3]);

      for (const sq of candidates) {
        if (!olExtentsIntersect(geoExtent, squareExtent(sq))) continue;

        const pxSize = squareScreenSize(sq, resolution, viewProjection);
        const willSubdivide = this.maxDepth_ > 0 && pxSize > subdivideThreshold;

        if (!willSubdivide) {
          leaves.push({ sq, pxSize, depth: 0 });
        } else {
          this.subdivide_(sq, 1, resolution, viewProjection, geoExtent, subdivideThreshold, leaves);
        }
      }
      return leaves;
    });
  }

  private subdivide_(
    parent: Square,
    depth: number,
    resolution: number,
    viewProjection: ProjectionLike,
    geoExtent: Extent,
    subdivideThreshold: number,
    out: Leaf[],
  ): void {
    if (depth > this.maxDepth_) return;

    for (const subRef of this.childRefs_(parent)) {
      const sub = findById(subRef);
      if (!sub) continue;
      if (!olExtentsIntersect(geoExtent, squareExtent(sub))) continue;

      const subPxSize = squareScreenSize(sub, resolution, viewProjection);
      const willSubdivide = depth < this.maxDepth_ && subPxSize > subdivideThreshold;

      if (!willSubdivide) {
        out.push({ sq: sub, pxSize: subPxSize, depth });
      } else {
        this.subdivide_(sub, depth + 1, resolution, viewProjection, geoExtent, subdivideThreshold, out);
      }
    }
  }

  /** Refs of a parent's child squares; uses the parent's custom `sub` layout when present. */
  private childRefs_(parent: Square): string[] {
    if (isRectSquare(parent) && parent.sub) {
      return parent.sub.flat().map((d) => `${parent.id}${d}`);
    }
    return childRefCandidates(parent.id);
  }
}
