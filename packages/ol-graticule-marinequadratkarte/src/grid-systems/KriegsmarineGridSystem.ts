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
  ProjectionScratch,
  RenderCache,
  emitFlatLineFeatures,
} from '@zwaarcontrast/ol-graticule';
import { getAllLargeSquares, findById, ensureIndexed } from '../kriegsmarine/lookup.js';
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
  type ClassifiedEdge,
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

export class KriegsmarineGridSystem implements GridSystem {
  private readonly maxDepth_: number;
  private readonly minSquarePx_: number;
  private readonly traversalCache_ = new RenderCache<Leaf[]>();
  private readonly projScratch_ = new ProjectionScratch();

  constructor(options?: KriegsmarineGridSystemOptions | undefined) {
    this.maxDepth_ = options?.maxDepth ?? 4;
    this.minSquarePx_ = options?.minSquarePx ?? 80;
    ensureIndexed();
  }

  getFeatures(extent: Extent, resolution: number, viewProjection: ProjectionLike): Feature<Geometry>[] {
    const leaves = this.traverse_(extent, resolution, viewProjection);

    const classified: ClassifiedEdge[] = [];
    for (const { sq, depth } of leaves) {
      if (isPolySquare(sq)) {
        for (const e of polyEdges(sq, depth)) classified.push(e);
      } else {
        for (const e of rectEdges(sq, depth)) classified.push(e);
      }
    }

    const merged = mergeEdges(classified);
    if (merged.length === 0) return [];

    const transformFn = getTransform('EPSG:4326', viewProjection);

    const probe = new Array<number>(merged.length * 4);
    for (let i = 0; i < merged.length; i++) {
      const e = merged[i]!;
      const o = i * 4;
      if (e.axis === 'v') {
        probe[o] = e.lon;     probe[o + 1] = e.latLo;
        probe[o + 2] = e.lon; probe[o + 3] = e.latHi;
      } else if (e.axis === 'h') {
        probe[o] = e.lonLo;     probe[o + 1] = e.lat;
        probe[o + 2] = e.lonHi; probe[o + 3] = e.lat;
      } else {
        probe[o] = e.p1[1];     probe[o + 1] = e.p1[0];
        probe[o + 2] = e.p2[1]; probe[o + 3] = e.p2[0];
      }
    }
    transformFn(probe, probe, 2);

    const specs: FlatLineSpec[] = new Array(merged.length);
    for (let i = 0; i < merged.length; i++) {
      const e = merged[i]!;
      const o = i * 4;
      const dx = probe[o + 2]! - probe[o]!;
      const dy = probe[o + 3]! - probe[o + 1]!;
      const pxSize = Math.sqrt(dx * dx + dy * dy) / resolution;
      const npts = densityForPxSize(pxSize) + 1;
      const props = {
        gridSquare: e.squareIds[0],
        gridSquares: e.squareIds,
        gridDepth: e.depth,
      };
      if (e.axis === 'v') {
        specs[i] = {
          startX: e.lon, startY: e.latLo,
          endX: e.lon, endY: e.latHi,
          npts, props,
        };
      } else if (e.axis === 'h') {
        specs[i] = {
          startX: e.lonLo, startY: e.lat,
          endX: e.lonHi, endY: e.lat,
          npts, props,
        };
      } else {
        specs[i] = {
          startX: e.p1[1], startY: e.p1[0],
          endX: e.p2[1], endY: e.p2[0],
          npts, props,
          xInterp: interpolateLon,
        };
      }
    }

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
    const [lon, lat] = transform(coordinate, viewProjection, 'EPSG:4326');
    if (lon === undefined || lat === undefined) return { combined: '-' };
    const ref = coordinateToGridRef([lat, lon], this.maxDepth_);
    return { combined: ref ? formatGridRef(ref) : '-' };
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

      for (const sq of getAllLargeSquares()) {
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
