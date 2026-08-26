import type { Coordinate } from 'ol/coordinate';
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

  /**
   * Parse a label or compound reference back into view-projection coordinates.
   * Throws {@link ParseError} when `text` cannot be interpreted. Compound-cell
   * references resolve to the cell centre at whatever precision the input
   * implies. Validity (CRS extent, clip polygon) is intentionally not checked
   * here, use {@link isValidCoordinate} on the result if needed.
   */
  parseCoordinate?(
    text: string,
    viewProjection: ProjectionLike
  ): [number, number];

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
  /**
   * The cell footprint as an open ring in the view's projection coordinates.
   * When provided, {@link PolygonClippedGridSystem} recentres the label on the
   * centroid of the visible (clipped) portion of the cell, so cells split by a
   * clip boundary still read correctly. Optional; renderers that omit it fall
   * back to a point-in-polygon visibility filter on the centre.
   */
  cellRing?: Coordinate[];
}

/** Formats a raw coordinate value into a display string. */
export interface LabelFormatter {
  /** Format `value` along the given axis. */
  format(value: number, axis: 'x' | 'y'): string;

  /** Format both axes together; return combined for compound grids. */
  formatCoordinate?(x: number, y: number): FormattedCoordinate;

  /** Short cell-center label. */
  formatCellLabel?(x: number, y: number): string | undefined;

  /**
   * Parse a single-axis label back into a numeric value in the formatter's
   * native units (degrees, metres, pixels, …). Throws {@link ParseError} on
   * unparseable input.
   */
  parse?(text: string, axis: 'x' | 'y'): number;

  /**
   * Parse a compound coordinate reference back into a numeric pair in the
   * formatter's native units. Compound-cell forms resolve to the cell centre
   * at the precision implied by the input. Throws {@link ParseError} on
   * unparseable input.
   */
  parseCoordinate?(text: string): [number, number];
}

/** Determines the spacing between grid lines at a given zoom level. */
export interface IntervalStrategy {
  /** Grid line interval for `resolution`. */
  getInterval(resolution: number, viewProjection?: ProjectionLike): number;

  /** Minor (subdivision) interval; omit to disable minor lines. */
  getMinorInterval?(majorInterval: number): number | undefined;

  /**
   * Interval on which cell labels are enumerated, when it differs from the line
   * interval. Omit to place one label per major-line cell. Grids whose label
   * cells are a fixed size (e.g. a 100 km lettered cell over a finer km grid)
   * return that fixed interval so the label is not repeated across sub-cells at
   * deep zoom.
   */
  getCellInterval?(resolution: number, viewProjection?: ProjectionLike): number;
}
