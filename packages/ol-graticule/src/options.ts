/** Construction options shared by both graticule variants. */

import type { GridSystem } from './types.js';
import type { GraticuleBlendMode, GraticuleStyle } from './style.js';

/** One grid to render and the style to render it in. */
export interface GraticuleGridSpec {
  gridSystem: GridSystem | null;
  style?: GraticuleStyle | undefined;
}

/**
 * Grid + label + lens configuration shared by both graticule variants;
 * `CanvasGraticuleLayer` and `WebGLGraticuleLayer` add only their OpenLayers
 * layer options on top of this.
 */
export interface GraticuleOptions {
  /** Grid system that produces features + labels. Pass `null` to construct inactive. */
  gridSystem?: GridSystem | null;
  /** Unified style config for lines, edge labels, cell labels, and the lens. */
  style?: GraticuleStyle;
  /**
   * Several grids, each in its own style, drawn through one layer instead of one
   * layer per grid, for many clipped grids (e.g. a printed-sheet series).
   * Supersedes `gridSystem`/`style`.
   */
  grids?: GraticuleGridSpec[];
  /** Where to place x-axis labels (default: 'top'). */
  xLabelPosition?: 'top' | 'bottom' | undefined;
  /** Where to place y-axis labels (default: 'left'). */
  yLabelPosition?: 'left' | 'right' | undefined;
  /** Pixel offset for x-axis labels from the edge, inward (default: 2). */
  xLabelOffset?: number | undefined;
  /** Pixel offset for y-axis labels from the edge, inward (default: 2). */
  yLabelOffset?: number | undefined;
  /**
   * Which frame edges may carry edge labels when the view is rotated (default:
   * `'all'`). Labels ride the configured edges by preference and fall back to
   * the others so a line always gets a label where it meets the frame.
   */
  edgeLabelCoverage?: 'primary' | 'opposite' | 'all' | undefined;
  /**
   * Leader drawn from each edge label back along its grid line's direction
   * (default: `'none'`): `'tick'` a short mark, `'line'` a full connector to the
   * clipped line's end.
   */
  edgeLabelLeader?: 'none' | 'tick' | 'line' | undefined;
  /**
   * How a label reaches the map border from its grid line (default: `'line'`):
   * `'none'` at the clipped end, `'line'` projected along the line, `'axis'`
   * straight out to the border.
   */
  edgeLabelExtend?: 'none' | 'line' | 'axis' | undefined;
  /** Maximum number of grid lines per axis (default: 100). */
  maxLines?: number | undefined;
  /** Blend the graticule against the layers below; omit for normal compositing. */
  blend?: GraticuleBlendMode | undefined;
}
