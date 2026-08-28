import type { GraticuleBlendMode } from '../style.js';

/** Class that gets a blended Canvas 2D graticule its own canvas; layers on the
 *  default `ol-layer` class share one, and would be blended along with it. */
export const BLEND_LAYER_CLASS = 'ol-layer ol-graticule-blend';

/** Blend `canvas` against what is painted beneath it. No-op without a mode, or
 *  on an OffscreenCanvas, which has no CSS box to blend. */
export function applyBlend(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  blend: GraticuleBlendMode | undefined,
): void {
  if (!blend || !('style' in canvas)) return;
  if (canvas.style.mixBlendMode !== blend) canvas.style.mixBlendMode = blend;
}
