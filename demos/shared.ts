/**
 * "Field Atlas" palette, mirroring the CSS custom properties in shared.css.
 * Demos share these `Stroke` / `Text` instances, so a repalette is one file.
 * Renderer selection lives in `renderer.ts`.
 */import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import Text from 'ol/style/Text';
import { createDefaultCellLabelHandler } from '@zwaarcontrast/ol-graticule';
import type { CursorStyle, HoverLensOptions } from '@zwaarcontrast/ol-graticule';

export const palette = {
  ink: 'rgba(15, 23, 42, 0.85)',
  paper: 'rgba(245, 239, 230, 0.95)',
  accent: 'rgba(194, 65, 12, 0.9)',
  accentSolid: '#c2410c',
} as const;

/** Terracotta dashed graticule line, matches `--accent` in shared.css. */
export const gridLine = new Stroke({
  color: palette.accent,
  width: 1.5,
  lineDash: [6, 4],
});

/** Pointer lens that swells grid lines toward the cursor; colour follows the line ink. */
export const hoverLens: HoverLensOptions = {
  radius: 160,
  clearRadius: 16,
  boost: 4,
};

/** Cream text with an ink halo, readable on any OSM tile. */
export const edgeLabelText = new Text({
  font: '600 10px system-ui, -apple-system, sans-serif',
  fill: new Fill({ color: palette.paper }),
  stroke: new Stroke({ color: palette.ink, width: 3 }),
});

/** Cell labels for MBS / Kriegsmarine */
export const cellLabelHandler = createDefaultCellLabelHandler({
  fontWeight: 700,
  fillColor: (o) => `rgba(254, 215, 170, ${o.toFixed(2)})`, // orange-200
  strokeColor: (o) => `rgba(194, 65, 12, ${o.toFixed(2)})`, // orange-700 halo
  strokeWidth: 3,
  peakOpacity: 0.85,
});

/** Orange indicator + cream tabular-num readout for `CursorPositionControl`. */
export const cursorStyle: CursorStyle = {
  color: palette.accentSolid,
  labelCss:
    "font: 700 10px system-ui, -apple-system, sans-serif; " +
    "color: #f5efe6; font-variant-numeric: tabular-nums; letter-spacing: 0.02em;",
};
