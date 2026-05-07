import type { Extent } from 'ol/extent';
import type { ProjectionLike } from 'ol/proj';
import type Feature from 'ol/Feature';
import type Point from 'ol/geom/Point';
import type { Geometry } from 'ol/geom';

/** Geographic coordinate in `[latitude, longitude]` order. */
export type LatLon = [number, number];

/** A label to render at the edge of the viewport. */
export interface GridLabel {
  /** Position in the view's projection coordinates */
  point: Point;
  /** The formatted text to display */
  text: string;
  /** Which viewport edge this label belongs to: 'x' = top/bottom, 'y' = left/right */
  axis: 'x' | 'y';
}

/** Per-axis formatted coordinate. */
export interface AxisFormatted {
  /** Easting / longitude, already formatted. */
  x: string;
  /** Northing / latitude, already formatted. */
  y: string;
}

/** Single combined label for compound-code grids. */
export interface CombinedFormatted {
  /** The full compound label. */
  combined: string;
}

/** Result of `formatCoordinate`. Narrow with the type guards below. */
export type FormattedCoordinate = AxisFormatted | CombinedFormatted;

export function isCombinedFormatted(value: FormattedCoordinate): value is CombinedFormatted {
  return 'combined' in value;
}

export function isAxisFormatted(value: FormattedCoordinate): value is AxisFormatted {
  return 'x' in value && 'y' in value;
}

/** Generates grid line features and labels for a given view state. */
export interface GridSystem {
  /** Grid-line LineString Features in the view's projection for the given extent. */
  getFeatures(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike
  ): Feature<Geometry>[];

  /** Edge labels for grid lines intersecting the viewport edges. */
  getLabels(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike
  ): GridLabel[];

  /** Whether a coordinate falls inside the CRS validity extent / clip polygon. */
  isValidCoordinate?(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): boolean;

  /** Format a coordinate as either per-axis or a compound string. */
  formatCoordinate(
    coordinate: [number, number],
    viewProjection: ProjectionLike
  ): FormattedCoordinate;

  /** Labels centered inside grid cells. */
  getCellLabels?(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike
  ): GridCellLabel[];
}

/** A label to render centered inside a grid cell. */
export interface GridCellLabel {
  /** Position in the view's projection coordinates (cell center) */
  point: Point;
  /** The label text to display (e.g. "vK") */
  text: string;
  /** The cell size in view projection units (used for fade calculation) */
  cellSizePx: number;
}

/** Formats a raw coordinate value into a display string. */
export interface LabelFormatter {
  /** Format `value` along the given axis. */
  format(value: number, axis: 'x' | 'y'): string;

  /** Format both axes together; return combined for compound grids. */
  formatCoordinate?(x: number, y: number): FormattedCoordinate;

  /** Short cell-center label. */
  formatCellLabel?(x: number, y: number): string | undefined;
}

/** Determines the spacing between grid lines at a given zoom level. */
export interface IntervalStrategy {
  /** Grid line interval for `resolution`. */
  getInterval(resolution: number, viewProjection?: ProjectionLike): number;

  /** Minor (subdivision) interval; omit to disable minor lines. */
  getMinorInterval?(majorInterval: number): number | undefined;
}
