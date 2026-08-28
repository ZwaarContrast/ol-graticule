/**
 * Turning {@link GraticuleOptions} into the state both graticule variants build
 * from. Defaults live here once, so the Canvas and WebGL layers cannot drift.
 */

import type VectorSource from 'ol/source/Vector';
import type { GraticuleBlendMode, GraticuleLineStyle } from './style.js';
import { createDefaultCellLabelHandler, resolveEdgeLabelHandler } from './style.js';
import type { GraticuleGridSpec, GraticuleOptions } from './options.js';
import type { EdgeLabelConfig } from './labels/EdgeLabelPlacer.js';
import { LabelEngine } from './labels/LabelEngine.js';

export interface ResolvedGraticuleConfig<Rest> {
  specs: GraticuleGridSpec[];
  edgeConfig: EdgeLabelConfig;
  maxLines: number;
  blend: GraticuleBlendMode | undefined;
  /** Line style the pointer lens follows, from the first grid. */
  lensLineStyle: GraticuleLineStyle | undefined;
  /** Whatever is left for the OpenLayers layer constructor. */
  layerOptions: Rest;
}

/** Split graticule config from layer options and apply every default. */
export function resolveGraticuleOptions<T extends GraticuleOptions>(
  options: T,
): ResolvedGraticuleConfig<Omit<T, keyof GraticuleOptions>> {
  const {
    gridSystem, style, grids,
    xLabelPosition, yLabelPosition, xLabelOffset, yLabelOffset,
    edgeLabelCoverage, edgeLabelLeader, edgeLabelExtend,
    maxLines, blend,
    ...layerOptions
  } = options;

  const specs: GraticuleGridSpec[] = grids ?? [{ gridSystem: gridSystem ?? null, style }];

  return {
    specs,
    edgeConfig: {
      xLabelPosition: xLabelPosition ?? 'top',
      yLabelPosition: yLabelPosition ?? 'left',
      xLabelOffset: xLabelOffset ?? 2,
      yLabelOffset: yLabelOffset ?? 2,
      edgeLabelCoverage: edgeLabelCoverage ?? 'all',
      edgeLabelLeader: edgeLabelLeader ?? 'none',
      edgeLabelExtend: edgeLabelExtend ?? 'line',
    },
    maxLines: maxLines ?? 100,
    blend,
    lensLineStyle: specs[0]?.style?.line ?? style?.line,
    layerOptions: layerOptions as Omit<T, keyof GraticuleOptions>,
  };
}

/** The grid's label engine, or `null` when it draws neither label kind. */
export function createLabelEngine(
  spec: GraticuleGridSpec,
  edgeConfig: EdgeLabelConfig,
  maxLines: number,
  source: VectorSource,
): LabelEngine | null {
  const edgeLabelHandler = resolveEdgeLabelHandler(spec.style?.edgeLabel);
  const cell = spec.style?.cellLabel;
  const cellLabelHandler = cell === false ? null : cell ?? createDefaultCellLabelHandler();
  if (!edgeLabelHandler && !cellLabelHandler) return null;
  return new LabelEngine({
    edgeLabelHandler,
    cellLabelHandler,
    edgeConfig,
    lineStyle: spec.style?.line,
    maxLines,
    source,
  });
}
