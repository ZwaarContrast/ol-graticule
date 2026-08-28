import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { getVectorContext } from 'ol/render';
import { unByKey } from 'ol/Observable';
import { approximatelyEquals } from 'ol/extent';
import type { Options as VectorLayerOptions } from 'ol/layer/Vector';
import type RenderEvent from 'ol/render/Event';
import type { Extent } from 'ol/extent';
import type { EventsKey } from 'ol/events';
import type { ProjectionLike } from 'ol/proj';
import type { StyleFunction } from 'ol/style/Style';
import type { GridSystem } from './types.js';
import { resolveGraticuleOptions, createLabelEngine } from './resolveOptions.js';
import type { GraticuleOptions } from './options.js';
import {
  resolveHoverLens,
  resolveLineStyle,
  type GraticuleBlendMode,
  type GraticuleHoverLens,
  type GraticuleLineStyle,
  type ResolvedHoverLens,
} from './style.js';
import { applyBlend, BLEND_LAYER_CLASS } from './util/blend.js';
import { HoverLensRenderer, type CanvasLensGrid } from './rendering/HoverLensRenderer.js';
import { LabelEngine } from './labels/LabelEngine.js';
import { canonicalizeExtent } from './util/worldWrap.js';

/**
 * Options for {@link CanvasGraticuleLayer}: the shared graticule config plus the
 * `VectorLayer` options (opacity, visible, zIndex, updateWhileAnimating, …).
 */
export interface CanvasGraticuleLayerOptions
  extends GraticuleOptions, Omit<VectorLayerOptions, 'source' | 'style'> {}

/** One grid resolved for canvas rendering: its own features source (scanned by
 * the label placer and swelled by the lens), line style, label engine, and lens. */
interface CanvasGrid {
  gridSystem: GridSystem | null;
  lineStyle: GraticuleLineStyle | undefined;
  source: VectorSource;
  labelEngine: LabelEngine | null;
  lens: ResolvedHoverLens | null;
}

/**
 * The Canvas 2D graticule layer: draws grid lines through OpenLayers' vector
 * renderer, with edge/cell labels and the hover lens composited in a 2D
 * postrender pass. Used directly, or as the fallback backend of
 * {@link UniversalGraticule}.
 */
export class CanvasGraticuleLayer extends VectorLayer {
  private readonly grids_: CanvasGrid[];
  private readonly maxLines_: number;

  private loadedExtent_: Extent | null = null;
  private loadedResolution_: number | null = null;

  private postrenderKey_: EventsKey | null = null;
  private maxLinesWarned_ = false;

  private readonly lensRenderer_: HoverLensRenderer;
  private readonly lensLineStyle_: GraticuleLineStyle | undefined;
  private readonly blend_: GraticuleBlendMode | undefined;

  constructor(options: CanvasGraticuleLayerOptions) {
    const { specs, edgeConfig, maxLines: resolvedMaxLines, blend, lensLineStyle, layerOptions: vectorOptions } =
      resolveGraticuleOptions(options);

    // Each grid gets its OWN scan source, so the label placer's nearestLine_
    // and the lens only ever see that grid's own lines.
    const built: CanvasGrid[] = specs.map((g) => {
      const gridSource = new VectorSource({ useSpatialIndex: false });
      return {
        gridSystem: g.gridSystem ?? null,
        lineStyle: g.style?.line,
        source: gridSource,
        labelEngine: createLabelEngine(g, edgeConfig, resolvedMaxLines, gridSource),
        lens: resolveHoverLens(g.style?.hoverLens, g.style?.line),
      };
    });

    // The layer's own source holds every grid's lines (tagged with __gridIndex
    // when there are several), styled by the per-grid line style.
    const source = new VectorSource({
      loader: (extent, resolution, projection) => {
        this.loaderFunction_(extent, resolution, projection);
      },
      strategy: (extent, resolution) => {
        return this.strategyFunction_(extent, resolution);
      },
      overlaps: false,
      useSpatialIndex: false,
    });

    super({
      updateWhileAnimating: true,
      updateWhileInteracting: true,
      renderBuffer: 0,
      ...(blend ? { className: BLEND_LAYER_CLASS } : {}),
      ...vectorOptions,
      source,
    });

    this.blend_ = blend;
    this.grids_ = built;
    this.maxLines_ = resolvedMaxLines;
    this.lensLineStyle_ = lensLineStyle;
    this.lensRenderer_ = new HoverLensRenderer(() => this.lensGrids_());

    this.setStyle(
      built.length === 1 ? resolveLineStyle(built[0]?.lineStyle) : multiGridLineStyle(built),
    );
    this.setRenderOrder(null);

    this.updatePostrenderListener_();
  }

  private lensGrids_(): CanvasLensGrid[] {
    return this.grids_.map((g) => ({ source: g.source, lens: g.lens }));
  }

  private strategyFunction_(extent: Extent, resolution: number): Extent[] {
    if (
      this.loadedExtent_ &&
      this.loadedResolution_ === resolution &&
      approximatelyEquals(this.loadedExtent_, extent, resolution)
    ) {
      return [this.loadedExtent_];
    }
    if (this.loadedExtent_) {
      const source = this.getSource();
      source?.removeLoadedExtent(this.loadedExtent_);
    }
    return [extent];
  }

  private loaderFunction_(extent: Extent, resolution: number, projection: ProjectionLike): void {
    this.loadedExtent_ = extent;
    this.loadedResolution_ = resolution;

    const lineSource = this.getSource();
    if (!lineSource) return;
    lineSource.clear(true);

    const canonical = canonicalizeExtent(extent, projection);
    const ceiling = this.maxLines_ * 2;
    const tag = this.grids_.length > 1;

    for (let i = 0; i < this.grids_.length; i++) {
      const grid = this.grids_[i];
      if (!grid) continue;
      grid.source.clear(true);
      if (!grid.gridSystem) continue;

      const features = grid.gridSystem.getFeatures(canonical, resolution, projection);
      let limited = features;
      if (features.length > ceiling) {
        limited = features.slice(0, ceiling);
        if (!this.maxLinesWarned_) {
          this.maxLinesWarned_ = true;
          console.warn(
            `[ol-graticule] grid system emitted ${features.length} features at ` +
            `resolution ${resolution}; capped at ${ceiling}. ` +
            `Raise UniversalGraticule.maxLines or tighten the grid system's interval strategy.`,
          );
        }
      }

      // Tag before adding so no source-change event fires for the mutation; the
      // multi-grid line style reads __gridIndex to pick each grid's stroke.
      if (tag) for (const f of limited) f.set('__gridIndex', i);
      // The same feature objects feed the layer's line source (rendering) and
      // this grid's scan source (labels + lens).
      grid.source.addFeatures(limited);
      lineSource.addFeatures(limited);
    }
  }

  private handlePostrender_(event: RenderEvent): void {
    // Re-asserted per frame: the canvas is replaced on resize.
    if (event.context) applyBlend(event.context.canvas, this.blend_);

    const frameState = event.frameState;
    if (!frameState) return;
    const map = this.getMapInternal();
    if (!map) return;

    if (this.lensRenderer_.active) {
      this.lensRenderer_.attach(map);
      // The lens is static once drawn; only keep the frame loop alive while the
      // opacity is still easing in or out. A resting cursor needs no more frames.
      if (this.lensRenderer_.draw(event)) map.render();
    }

    // Each grid's labels via its own engine, drawing into this frame's immediate
    // VectorContext (the LabelSink for the canvas variant).
    const vectorContext = getVectorContext(event);
    for (const grid of this.grids_) {
      if (grid.labelEngine && grid.gridSystem) {
        grid.labelEngine.run(frameState, grid.gridSystem, vectorContext);
      }
    }
  }

  private updatePostrenderListener_(): void {
    const wantsLabels = this.grids_.some(
      (g) => g.gridSystem !== null && g.labelEngine !== null && (
        g.labelEngine.hasEdgeLabels ||
        (g.labelEngine.hasCellLabels && g.gridSystem.getCellLabels !== undefined)
      ),
    );
    const wantsLens = this.lensRenderer_.active && this.grids_.some((g) => g.gridSystem !== null);
    // A blend keeps the listener alive even with nothing to draw: it applies there.
    const needed = wantsLabels || wantsLens || this.blend_ !== undefined;
    if (needed && !this.postrenderKey_) {
      this.postrenderKey_ = this.on('postrender', (event) => this.handlePostrender_(event));
    } else if (!needed && this.postrenderKey_) {
      unByKey(this.postrenderKey_);
      this.postrenderKey_ = null;
    }
    const map = this.getMapInternal();
    if (wantsLens && map) {
      this.lensRenderer_.attach(map);
    } else {
      this.lensRenderer_.detach();
    }
  }

  /**
   * Enable, replace, or disable the pointer lens at runtime for the first grid.
   * Pass `false` (or `undefined`) to turn it off; pass options to (re)configure it.
   */
  setHoverLens(input: GraticuleHoverLens | undefined): void {
    const first = this.grids_[0];
    if (first) first.lens = resolveHoverLens(input, this.lensLineStyle_);
    this.updatePostrenderListener_();
    this.getMapInternal()?.render();
  }

  getGridSystem(): GridSystem | null {
    return this.grids_[0]?.gridSystem ?? null;
  }

  /** Activate or deactivate the (first) grid. */
  setGridSystem(gridSystem: GridSystem | null): void {
    const first = this.grids_[0];
    if (first) first.gridSystem = gridSystem;
    this.loadedExtent_ = null;
    this.loadedResolution_ = null;
    this.maxLinesWarned_ = false;
    const source = this.getSource();
    if (source) {
      source.clear(true);
      if (gridSystem !== null) source.refresh();
    }
    this.updatePostrenderListener_();
    this.getMapInternal()?.render();
  }

  override disposeInternal(): void {
    if (this.postrenderKey_) {
      unByKey(this.postrenderKey_);
      this.postrenderKey_ = null;
    }
    this.lensRenderer_.detach();
    super.disposeInternal();
  }
}

/**
 * A style function that picks each feature's line style by its `__gridIndex`
 * tag, so several grids render through one layer/source. Falls back to the first
 * grid's style for untagged features.
 */
function multiGridLineStyle(grids: CanvasGrid[]): StyleFunction {
  const perGrid = grids.map((g) => resolveLineStyle(g.lineStyle));
  return (feature, resolution) => {
    const raw = feature.get('__gridIndex');
    const idx = typeof raw === 'number' ? raw : 0;
    const style = perGrid[idx] ?? perGrid[0];
    return typeof style === 'function' ? style(feature, resolution) : style;
  };
}
