import LineString from 'ol/geom/LineString';
import { createOrUpdateFromFlatCoordinates, intersects, buffer } from 'ol/extent';
import type { Extent } from 'ol/extent';
import type { ProjectionLike } from 'ol/proj';
import type Feature from 'ol/Feature';
import type { Geometry } from 'ol/geom';
import { fromLonLat } from 'ol/proj';

interface GridSystemLike {
  getFeatures(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): Feature<Geometry>[];
}

export interface OffScreenFeature {
  bbox: Extent;
  gridLineType?: string | undefined;
  gridAxis?: string | undefined;
  gridValue?: string | undefined;
}

/**
 * Walk every LineString feature returned by `grid.getFeatures` and collect
 * those whose bbox sits entirely outside `extent`. Tests should expect this
 * list to be empty.
 */
export function findOffScreenFeatures(
  grid: GridSystemLike,
  extent: Extent,
  resolution: number,
  viewProjection: ProjectionLike,
): OffScreenFeature[] {
  const features = grid.getFeatures(extent, resolution, viewProjection);
  // 2px slack for sub-pixel boundary lines.
  const visible = buffer(extent, resolution * 2);
  const out: OffScreenFeature[] = [];
  for (const f of features) {
    const geom = f.getGeometry();
    if (!(geom instanceof LineString)) continue;
    const flat = geom.getFlatCoordinates();
    const stride = geom.getStride();
    if (flat.length < stride) continue;
    const bbox = createOrUpdateFromFlatCoordinates(flat, 0, flat.length, stride);
    if (!intersects(bbox, visible)) {
      out.push({
        bbox,
        gridLineType: maybeString_(f.get('gridLineType')),
        gridAxis: maybeString_(f.get('gridAxis')),
        gridValue: maybeString_(f.get('gridValue')),
      });
    }
  }
  return out;
}

function maybeString_(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

/** EPSG:3857 metres per pixel at standard tile-zoom `zoom`. */
export function epsg3857ResolutionAtZoom(zoom: number): number {
  return 40_075_016.686 / (256 * Math.pow(2, zoom));
}

/**
 * Build an EPSG:3857 viewport extent centred at `lonLat` for the given
 * zoom and viewport pixel dimensions.
 */
export function viewportExtentAt(
  lonLat: [number, number],
  zoom: number,
  widthPx = 1280,
  heightPx = 800,
): { extent: Extent; resolution: number } {
  const resolution = epsg3857ResolutionAtZoom(zoom);
  const [cx, cy] = fromLonLat(lonLat);
  const halfW = (widthPx * resolution) / 2;
  const halfH = (heightPx * resolution) / 2;
  return {
    extent: [cx - halfW, cy - halfH, cx + halfW, cy + halfH],
    resolution,
  };
}
