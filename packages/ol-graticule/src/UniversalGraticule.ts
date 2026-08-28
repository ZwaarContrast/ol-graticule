import LayerGroup from 'ol/layer/Group';
import type { Options as LayerGroupOptions } from 'ol/layer/Group';
import type { GridSystem } from './types.js';
import type { GraticuleHoverLens } from './style.js';
import type { GraticuleOptions } from './options.js';
import { CanvasGraticuleLayer } from './CanvasGraticuleLayer.js';
import { WebGLGraticuleLayer } from './WebGLGraticuleLayer.js';

/** Which rasterizer backs {@link UniversalGraticule}. */
export type GraticuleRenderer = 'auto' | 'gl' | 'canvas';

/** Graticule config, a `renderer` choice, plus `LayerGroup` options. */
export interface UniversalGraticuleOptions
  extends GraticuleOptions, Omit<LayerGroupOptions, 'layers'> {
  /**
   * Default `'auto'`: prefers WebGL, falls back to canvas when it is unavailable
   * or software-rendered. `'gl'` and `'canvas'` force a backend.
   */
  renderer?: GraticuleRenderer | undefined;
}

/**
 * The public graticule layer: a `LayerGroup` facade over the WebGL and Canvas 2D
 * variants, forwarding runtime controls to whichever is active. Construct
 * {@link CanvasGraticuleLayer} or {@link WebGLGraticuleLayer} to pin a backend.
 */
export class UniversalGraticule extends LayerGroup {
  private readonly impl_: CanvasGraticuleLayer | WebGLGraticuleLayer;

  constructor(options: UniversalGraticuleOptions) {
    const {
      renderer = 'auto',
      opacity, visible, extent, zIndex,
      minResolution, maxResolution, minZoom, maxZoom, properties,
      ...graticuleOptions
    } = options;
    const impl = useWebGL(renderer)
      ? new WebGLGraticuleLayer(graticuleOptions)
      : new CanvasGraticuleLayer(graticuleOptions);
    super({
      opacity, visible, extent, zIndex,
      minResolution, maxResolution, minZoom, maxZoom, properties,
      layers: [impl],
    });
    this.impl_ = impl;
  }

  getGridSystem(): GridSystem | null {
    return this.impl_.getGridSystem();
  }

  /** Activate or deactivate the (first) grid on the active variant. */
  setGridSystem(gridSystem: GridSystem | null): void {
    this.impl_.setGridSystem(gridSystem);
  }

  /** Enable, replace, or disable the pointer lens on the active variant. */
  setHoverLens(input: GraticuleHoverLens | undefined): void {
    this.impl_.setHoverLens(input);
  }
}

/** Cached per page load: WebGL2 present and not a renderer we recognise as software. */
let webglCapable_: boolean | undefined;

function useWebGL(renderer: GraticuleRenderer): boolean {
  if (renderer === 'gl') return true;
  if (renderer === 'canvas') return false;
  if (webglCapable_ === undefined) webglCapable_ = probeWebGL();
  return webglCapable_;
}

function probeWebGL(): boolean {
  if (typeof document === 'undefined' || typeof WebGL2RenderingContext === 'undefined') {
    return false;
  }
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    // Restricted in Firefox and under fingerprinting protection, so an empty
    // name means "unknown", not "hardware".
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}
