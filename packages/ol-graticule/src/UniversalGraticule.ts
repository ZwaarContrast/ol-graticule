import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { getVectorContext } from 'ol/render';
import { unByKey } from 'ol/Observable';
import { approximatelyEquals } from 'ol/extent';
import { get as getProjection } from 'ol/proj';
import { apply as applyTransform } from 'ol/transform';
import { getFontParameters } from 'ol/css';
import type { Options as VectorLayerOptions } from 'ol/layer/Vector';
import type RenderEvent from 'ol/render/Event';
import type { FrameState } from 'ol/Map';
import type { Extent } from 'ol/extent';
import type { EventsKey } from 'ol/events';
import type { ProjectionLike } from 'ol/proj';
import type { GridSystem, GridLabel, GridCellLabel } from './types.js';
import {
  createDefaultCellLabelHandler,
  resolveEdgeLabelHandler,
  resolveHoverLens,
  resolveLineStyle,
  type CellLabelSlot,
  type CellLabelStyleHandler,
  type EdgeLabelContext,
  type EdgeLabelSlot,
  type EdgeLabelStyleHandler,
  type GraticuleHoverLens,
  type GraticuleLineStyle,
  type GraticuleStyle,
  type ResolvedHoverLens,
} from './style.js';

export interface UniversalGraticuleOptions extends Omit<VectorLayerOptions, 'source' | 'style'> {
  /** Grid system that produces features + labels. Pass `null` to construct inactive. */
  gridSystem?: GridSystem | null;
  /** Unified style config for lines, edge labels, and cell labels. */
  style?: GraticuleStyle;
  /** Where to place x-axis labels (default: 'top'). */
  xLabelPosition?: 'top' | 'bottom' | undefined;
  /** Where to place y-axis labels (default: 'left'). */
  yLabelPosition?: 'left' | 'right' | undefined;
  /** Pixel offset for x-axis labels from the edge, inward (default: 2) */
  xLabelOffset?: number | undefined;
  /** Pixel offset for y-axis labels from the edge, inward (default: 2) */
  yLabelOffset?: number | undefined;
  /** Maximum number of grid lines per axis (default: 100) */
  maxLines?: number | undefined;
}

const DEFAULT_LABEL_FONT_SIZE = 10;
const LENS_MAX_HOLES = 64;
const LENS_SWELL_ALPHA = 0.88;
// Floor (CSS px) on the donut reach, so fine grids still trigger early enough.
const LENS_MIN_APPROACH = 34;
// CSS px of slack around the lens radius for the feathered run cross-section,
// so the box that bounds every buffer op still covers a line's soft edge.
const LENS_BOX_PAD = 16;

// One offscreen buffer shared across all instances: a layer fully draws and
// blits it within a single synchronous postrender, so there is no contention.
let sharedLensBuffer: HTMLCanvasElement | null = null;

/** A cleared 2D context for the shared offscreen buffer, sized w×h, or null. */
function acquireLensBuffer(
  w: number,
  h: number,
  clearX: number,
  clearY: number,
  clearW: number,
  clearH: number,
): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  let canvas = sharedLensBuffer;
  if (canvas === null) {
    canvas = document.createElement('canvas');
    sharedLensBuffer = canvas;
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const bctx = canvas.getContext('2d');
  if (!bctx) return null;
  // Clear only the lens box: stale pixels outside it are never composited back.
  bctx.clearRect(clearX, clearY, clearW, clearH);
  return bctx;
}

interface DrawEntry {
  label: GridLabel;
  sortKey: number;
  xOffset: number;
  coord0: number;
  coord1: number;
}

interface CellDrawEntry {
  label: GridCellLabel;
  xOffset: number;
  coord0: number;
  coord1: number;
}

export class UniversalGraticule extends VectorLayer {
  private gridSystem_: GridSystem | null;
  private readonly edgeLabelHandler_: EdgeLabelStyleHandler | null;
  private readonly cellLabelHandler_: CellLabelStyleHandler | null;
  private readonly xLabelPosition_: 'top' | 'bottom';
  private readonly yLabelPosition_: 'left' | 'right';
  private readonly xLabelOffset_: number;
  private readonly yLabelOffset_: number;
  private readonly maxLines_: number;

  private edgeLabelPool_: EdgeLabelSlot[] = [];
  private cellLabelPool_: CellLabelSlot[] = [];
  private readonly labelFontSize_: number;

  private loadedExtent_: Extent | null = null;
  private loadedResolution_: number | null = null;

  private postrenderKey_: EventsKey | null = null;
  private maxLinesWarned_ = false;

  private hoverLens_: ResolvedHoverLens | null;
  private readonly lensLineStyle_: GraticuleLineStyle | undefined;
  // Cursor in CSS px (tracked directly, no lag). Intensity fades in/out only.
  private cursorPx_: [number, number] | null = null;
  private lensIntensity_ = 0;
  private lensIntensityTarget_ = 0;
  private pointerMoveKey_: EventsKey | null = null;
  private lensViewport_: HTMLElement | null = null;
  private readonly lensScratch_: number[] = [0, 0];
  // Active intersection holes this frame (device px) + their fade strengths.
  private readonly lensHoleX_: number[] = [];
  private readonly lensHoleY_: number[] = [];
  private readonly lensHoleS_: number[] = [];
  // Swell runs this frame, flat as [x0, y0, x1, y1, width, …] (device px).
  private readonly lensRuns_: number[] = [];
  // Local grid cell size (device px) measured this frame; 0 if unknown.
  private lensCellPx_ = 0;
  private readonly clearCursor_ = (): void => {
    this.lensIntensityTarget_ = 0;
    this.getMapInternal()?.render();
  };

  private xDrawBuf_: DrawEntry[] = [];
  private yDrawBuf_: DrawEntry[] = [];
  private cellDrawBuf_: CellDrawEntry[] = [];
  private readonly reusablePoint_: Point = new Point([0, 0]);
  private readonly reusableEdgeLabel_: GridLabel = {
    point: this.reusablePoint_, text: '', axis: 'x',
  };
  private readonly reusableCellLabel_: GridCellLabel = {
    point: this.reusablePoint_, text: '', cellSizePx: 0,
  };

  constructor(options: UniversalGraticuleOptions) {
    const {
      gridSystem,
      style,
      xLabelPosition,
      yLabelPosition,
      xLabelOffset,
      yLabelOffset,
      maxLines,
      ...vectorOptions
    } = options;

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
      ...vectorOptions,
      source,
    });

    this.gridSystem_ = gridSystem ?? null;
    this.xLabelPosition_ = xLabelPosition ?? 'top';
    this.yLabelPosition_ = yLabelPosition ?? 'left';
    this.xLabelOffset_ = xLabelOffset ?? 2;
    this.yLabelOffset_ = yLabelOffset ?? 2;
    this.maxLines_ = maxLines ?? 100;

    this.edgeLabelHandler_ = resolveEdgeLabelHandler(style?.edgeLabel);
    const cell = style?.cellLabel;
    this.cellLabelHandler_ = cell === false
      ? null
      : cell ?? createDefaultCellLabelHandler();

    this.lensLineStyle_ = style?.line;
    this.hoverLens_ = resolveHoverLens(style?.hoverLens, style?.line);

    this.setStyle(resolveLineStyle(style?.line));

    if (this.edgeLabelHandler_) {
      const first = this.edgeLabelHandler_.create();
      this.edgeLabelPool_.push(first);
      const params = getFontParameters(first.text.getFont() ?? '');
      const parsed = params ? parseFloat(params.size) : NaN;
      this.labelFontSize_ = Number.isFinite(parsed) ? parsed : DEFAULT_LABEL_FONT_SIZE;
    } else {
      this.labelFontSize_ = DEFAULT_LABEL_FONT_SIZE;
    }

    this.setRenderOrder(null);

    this.updatePostrenderListener_();
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

    const source = this.getSource();
    if (!source) return;

    const gridSystem = this.gridSystem_;
    if (!gridSystem) {
      source.clear(true);
      return;
    }

    const features = gridSystem.getFeatures(
      this.canonicalizeExtent_(extent, projection),
      resolution,
      projection,
    );

    const ceiling = this.maxLines_ * 2;
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

    source.clear(true);
    source.addFeatures(limited);
  }

  private handlePostrender_(event: RenderEvent): void {
    const gridSystem = this.gridSystem_;
    if (!gridSystem) return;
    if (!event.frameState) return;
    const map = this.getMapInternal();
    if (!map) return;
    const view = map.getView();
    if (!view || !view.getCenter()) return;
    const size = map.getSize();
    if (!size) return;

    const extent = view.calculateExtent(size);
    const resolution = view.getResolution();
    const projection = view.getProjection();
    if (resolution === undefined) return;

    if (this.hoverLens_) {
      if (!this.pointerMoveKey_) this.attachPointerTracking_();
      const fading = this.stepLensFade_();
      this.drawHoverLens_(event);
      // The lens is static once drawn; only keep the frame loop alive while the
      // opacity is still easing in or out. A resting cursor needs no more frames.
      if (fading) this.getMapInternal()?.render();
    }

    const vectorContext = getVectorContext(event);

    const worldOffsets = this.getVisibleWorldOffsets_(extent, projection);

    if (this.edgeLabelHandler_) {
      const { xCount, yCount } = this.collectEdgeLabels_(
        worldOffsets,
        extent,
        (shiftedExtent) => gridSystem.getLabels(shiftedExtent, resolution, projection),
      );
      if (xCount > 0 || yCount > 0) {
        this.drawLabels_(vectorContext, extent, resolution, xCount, yCount);
      }
    }

    if (this.cellLabelHandler_ && gridSystem.getCellLabels) {
      const getCellLabels = gridSystem.getCellLabels.bind(gridSystem);
      const cellCount = this.collectCellLabels_(
        worldOffsets,
        extent,
        (shiftedExtent) => getCellLabels(shiftedExtent, resolution, projection),
      );
      if (cellCount > 0) {
        this.drawCellLabels_(vectorContext, cellCount);
      }
    }
  }

  /** Ease the lens opacity towards its target; returns whether it is moving. */
  private stepLensFade_(): boolean {
    const k = 0.3;
    const di = this.lensIntensityTarget_ - this.lensIntensity_;
    this.lensIntensity_ += di * k;
    if (this.lensIntensityTarget_ === 0 && this.lensIntensity_ < 0.01) {
      this.lensIntensity_ = 0;
      this.cursorPx_ = null;
      return false;
    }
    return Math.abs(di) > 0.004;
  }

  /** Draws the static lens (swell + crossing dots) for the current cursor. */
  private drawHoverLens_(event: RenderEvent): void {
    const lens = this.hoverLens_;
    const cursor = this.cursorPx_;
    const intensity = this.lensIntensity_;
    const frameState = event.frameState;
    const ctx = event.context;
    if (!lens || !cursor || intensity < 0.01 || !frameState) return;
    if (!(ctx instanceof CanvasRenderingContext2D)) return;
    const source = this.getSource();
    if (!source) return;

    const pr = frameState.pixelRatio;
    const toPixel = frameState.coordinateToPixelTransform;
    const cx = cursor[0] * pr;
    const cy = cursor[1] * pr;
    const radius = lens.radius * pr;
    const boost = lens.boost * pr * intensity;
    if (boost < 0.2) return;
    // Swell peaks at the cursor and reaches ~0 by the radius.
    const sigmaSq = (radius / 2.2) * (radius / 2.2);
    const step = Math.max(2, 3 * pr);
    const quantum = 0.33 * pr;
    const minWidth = 0.33 * pr;

    // Punch a soft clear hole at the grid crossings within reach, each fading in
    // by proximity so overlapping holes hand off smoothly. The reach scales with
    // the local cell size, so only the crossing(s) you are actually near light up
    // rather than the whole 3×3 block around the cursor.
    const holeCount = this.collectHoles_(
      source, toPixel, pr, cx, cy, radius, lens.approachFraction, lens.approach * pr,
    );
    const holeX = this.lensHoleX_;
    const holeY = this.lensHoleY_;
    const holeS = this.lensHoleS_;
    const cell = this.lensCellPx_;
    // Keep the clear hole from exceeding the cell on fine grids; soft edge.
    const clearR = cell > 0
      ? Math.min(lens.clearRadius * pr, cell * 0.42)
      : lens.clearRadius * pr;
    const holeFeather = Math.min(12 * pr, clearR * 0.85);

    const runs = this.lensRuns_;
    runs.length = 0;
    const scratch = this.lensScratch_;

    for (const feature of source.getFeatures()) {
      const geom = feature.getGeometry();
      if (!(geom instanceof LineString)) continue;
      if (!this.lineNearCursor_(geom, toPixel, pr, cx, cy, radius)) continue;

      eachSegmentPx(geom, toPixel, pr, scratch, (x0, y0, x1, y1) => {
        accumulateSegment(
          runs, x0, y0, x1, y1,
          cx, cy, radius, sigmaSq, boost,
          holeX, holeY, holeS, holeCount, clearR, holeFeather,
          step, quantum, minWidth,
        );
      });
    }

    ctx.save();

    // Swell: draw each run into an offscreen buffer with a gradient PERPENDICULAR
    // to its direction (transparent → solid → transparent), so every line has a
    // soft feathered cross-section instead of a hard edge. Abutting butt caps
    // keep collinear runs from overlapping, so the translucent edges never
    // stack into beads. The bright-core → faint-skirt focus ramp is then applied
    // as one radial gradient (destination-in) and the whole buffer composited once.
    if (runs.length > 0) {
      const opaque = withAlpha(lens.color, 1);
      const transparent = withAlpha(lens.color, 0);
      // The lens only affects a disc of `radius` around the cursor, so every
      // full-buffer op (clear, ramp fill, composite) is restricted to the box
      // bounding that disc (padded for the feathered cross-section). Cost then
      // scales with the lens, not the viewport, and the result is identical:
      // no run is drawn outside the box, so the clipped pixels were all empty.
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      const pad = LENS_BOX_PAD * pr;
      const bx0 = Math.max(0, Math.floor(cx - radius - pad));
      const by0 = Math.max(0, Math.floor(cy - radius - pad));
      const bw = Math.min(cw, Math.ceil(cx + radius + pad)) - bx0;
      const bh = Math.min(ch, Math.ceil(cy + radius + pad)) - by0;
      const bctx = bw > 0 && bh > 0
        ? acquireLensBuffer(cw, ch, bx0, by0, bw, bh)
        : null;
      if (bctx) {
        bctx.lineCap = 'butt';
        for (let r = 0; r + 4 < runs.length; r += 5) {
          const x0 = runs[r];
          const y0 = runs[r + 1];
          const x1 = runs[r + 2];
          const y1 = runs[r + 3];
          const w = runs[r + 4];
          if (x0 === undefined || y0 === undefined || x1 === undefined ||
              y1 === undefined || w === undefined) continue;
          strokeFeatheredRun(bctx, x0, y0, x1, y1, w, opaque, transparent);
        }
        const ramp = bctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        ramp.addColorStop(0, 'rgba(0,0,0,1)');
        ramp.addColorStop(1, 'rgba(0,0,0,0.22)');
        bctx.globalCompositeOperation = 'destination-in';
        bctx.fillStyle = ramp;
        bctx.fillRect(bx0, by0, bw, bh);
        bctx.globalCompositeOperation = 'source-over';

        ctx.globalAlpha = intensity * LENS_SWELL_ALPHA;
        ctx.drawImage(bctx.canvas, bx0, by0, bw, bh, bx0, by0, bw, bh);
        ctx.globalAlpha = 1;
      }
    }

    // A soft dot on each active intersection, glowing via a radial gradient (the
    // radial cousin of the SO perpendicular-gradient trick). Fainter dots for
    // farther crossings, so they cross-fade as you move. Drawn at a fixed size:
    // the dot does not animate, so a resting cursor needs no further frames.
    if (holeCount > 0) {
      const coreR = pr;
      const glowR = coreR * 2.4;
      const transparent = withAlpha(lens.color, 0);
      for (let j = 0; j < holeCount; j++) {
        const jx = holeX[j];
        const jy = holeY[j];
        const js = holeS[j];
        if (jx === undefined || jy === undefined || js === undefined) continue;
        // Dots fade in only for the crossing(s) actually nearest the cursor, so
        // a generous carve reach never lights up a cluster of faint dots.
        let df = (js - 0.35) / 0.35;
        if (df <= 0) continue;
        if (df > 1) df = 1;
        const dotFade = df * df * (3 - 2 * df);
        const alpha = dotFade * intensity * 0.55;
        if (alpha < 0.02) continue;
        const grd = ctx.createRadialGradient(jx, jy, 0, jx, jy, glowR);
        grd.addColorStop(0, lens.color);
        grd.addColorStop(0.3, lens.color);
        grd.addColorStop(1, transparent);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(jx, jy, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Collect the grid intersections within `approach` px of the cursor into the
   * `lensHole*_` scratch arrays, each with a smoothstep fade strength, and
   * return how many. Intersections are the cartesian product of the nearby
   * vertical-line crossings (at the cursor's row) and horizontal-line crossings
   * (at its column). Carrying the whole set lets overlapping holes cross-fade.
   */
  private collectHoles_(
    source: VectorSource,
    toPixel: FrameState['coordinateToPixelTransform'],
    pr: number,
    cx: number,
    cy: number,
    searchRadius: number,
    approachFraction: number,
    fallbackApproach: number,
  ): number {
    const vxs: number[] = [];
    const hys: number[] = [];
    const scratch = this.lensScratch_;
    for (const feature of source.getFeatures()) {
      const geom = feature.getGeometry();
      if (!(geom instanceof LineString)) continue;
      const axis = feature.get('gridAxis');
      if (axis !== 'x' && axis !== 'y') continue;
      if (!this.lineNearCursor_(geom, toPixel, pr, cx, cy, searchRadius)) continue;

      let best = NaN;
      let bestD = Infinity;
      eachSegmentPx(geom, toPixel, pr, scratch, (prevX, prevY, x, y) => {
        if (axis === 'x' && straddles(prevY, y, cy)) {
          const crossX = prevX + (x - prevX) * ((cy - prevY) / (y - prevY));
          const d = Math.abs(crossX - cx);
          if (d < bestD) { bestD = d; best = crossX; }
        } else if (axis === 'y' && straddles(prevX, x, cx)) {
          const crossY = prevY + (y - prevY) * ((cx - prevX) / (x - prevX));
          const d = Math.abs(crossY - cy);
          if (d < bestD) { bestD = d; best = crossY; }
        }
      });
      if (!Number.isNaN(best) && bestD < searchRadius) {
        if (axis === 'x') vxs.push(best);
        else hys.push(best);
      }
    }

    // Reach scales with the finest local cell spacing; fall back to px when the
    // spacing can't be measured (fewer than two lines in an axis).
    const cellW = minSpacing(vxs);
    const cellH = minSpacing(hys);
    let cell = NaN;
    if (!Number.isNaN(cellW) && !Number.isNaN(cellH)) cell = Math.min(cellW, cellH);
    else if (!Number.isNaN(cellW)) cell = cellW;
    else if (!Number.isNaN(cellH)) cell = cellH;
    this.lensCellPx_ = Number.isNaN(cell) ? 0 : cell;
    // Cell-relative reach, but never below a px floor so fine grids still get a
    // usable, early-appearing trigger zone instead of a pin-prick.
    const approach = Number.isNaN(cell)
      ? fallbackApproach
      : Math.max(cell * approachFraction, LENS_MIN_APPROACH * pr);
    if (approach <= 0) return 0;

    const hx = this.lensHoleX_;
    const hy = this.lensHoleY_;
    const hs = this.lensHoleS_;
    let n = 0;
    for (const vx of vxs) {
      if (Math.abs(vx - cx) >= approach) continue;
      for (const hyy of hys) {
        if (Math.abs(hyy - cy) >= approach) continue;
        const dist = Math.hypot(cx - vx, cy - hyy);
        if (dist >= approach) continue;
        const s = 1 - dist / approach;
        hx[n] = vx;
        hy[n] = hyy;
        hs[n] = s * s * (3 - 2 * s); // smoothstep
        n++;
        if (n >= LENS_MAX_HOLES) return n;
      }
    }
    return n;
  }

  private lineNearCursor_(
    geom: LineString,
    toPixel: FrameState['coordinateToPixelTransform'],
    pr: number,
    cx: number,
    cy: number,
    radius: number,
  ): boolean {
    const [minX, minY, maxX, maxY] = geom.getExtent();
    const scratch = this.lensScratch_;
    let loX = Infinity;
    let loY = Infinity;
    let hiX = -Infinity;
    let hiY = -Infinity;
    const corners: [number, number][] = [
      [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY],
    ];
    for (const corner of corners) {
      scratch[0] = corner[0];
      scratch[1] = corner[1];
      const px = applyTransform(toPixel, scratch);
      const x = (px[0] ?? 0) * pr;
      const y = (px[1] ?? 0) * pr;
      if (x < loX) loX = x;
      if (y < loY) loY = y;
      if (x > hiX) hiX = x;
      if (y > hiY) hiY = y;
    }
    return cx >= loX - radius && cx <= hiX + radius && cy >= loY - radius && cy <= hiY + radius;
  }

  private collectEdgeLabels_(
    worldOffsets: number[],
    extent: Extent,
    fetch: (shiftedExtent: Extent) => GridLabel[],
  ): { xCount: number; yCount: number } {
    const xBuf = this.xDrawBuf_;
    const yBuf = this.yDrawBuf_;
    let xCount = 0;
    let yCount = 0;

    for (const offset of worldOffsets) {
      const shifted: Extent =
        offset === 0
          ? extent
          : [extent[0] - offset, extent[1], extent[2] - offset, extent[3]];
      const items = fetch(shifted);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const coords = item.point.getFlatCoordinates();
        const c0 = coords[0] ?? 0;
        const c1 = coords[1] ?? 0;
        if (item.axis === 'x') {
          pushDrawEntry(xBuf, xCount++, item, c0 + offset, offset, c0, c1);
        } else {
          pushDrawEntry(yBuf, yCount++, item, -c1, offset, c0, c1);
        }
      }
    }
    sortPrefix(xBuf, xCount);
    sortPrefix(yBuf, yCount);
    return { xCount, yCount };
  }

  private collectCellLabels_(
    worldOffsets: number[],
    extent: Extent,
    fetch: (shiftedExtent: Extent) => GridCellLabel[],
  ): number {
    const buf = this.cellDrawBuf_;
    let count = 0;
    for (const offset of worldOffsets) {
      const shifted: Extent =
        offset === 0
          ? extent
          : [extent[0] - offset, extent[1], extent[2] - offset, extent[3]];
      const items = fetch(shifted);
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const coords = item.point.getFlatCoordinates();
        pushCellEntry(buf, count++, item, offset, coords[0]!, coords[1]!);
      }
    }
    return count;
  }

  private drawLabels_(
    vectorContext: ReturnType<typeof getVectorContext>,
    extent: Extent,
    resolution: number,
    xCount: number,
    yCount: number,
  ): void {
    const handler = this.edgeLabelHandler_;
    if (!handler) return;

    const fontSize = this.labelFontSize_;
    const charWidth = fontSize * 0.7;
    const minYGap = fontSize + 4;

    const ctx: EdgeLabelContext = {
      label: this.reusableEdgeLabel_,
      extent,
      resolution,
      xLabelPosition: this.xLabelPosition_,
      yLabelPosition: this.yLabelPosition_,
      xLabelOffset: this.xLabelOffset_,
      yLabelOffset: this.yLabelOffset_,
    };

    let slotIndex = 0;
    let lastXPx = -Infinity;
    const xBuf = this.xDrawBuf_;
    for (let i = 0; i < xCount; i++) {
      const e = xBuf[i]!;
      const px = e.sortKey / resolution;
      const minXGap = Math.max(40, e.label.text.length * charWidth + 12);
      if (px - lastXPx < minXGap) continue;
      lastXPx = px;
      ctx.label = this.labelFor_(e);
      if (!this.drawEdgeSlot_(handler, ctx, slotIndex, vectorContext)) continue;
      slotIndex++;
    }

    let lastYPx = -Infinity;
    const yBuf = this.yDrawBuf_;
    for (let i = 0; i < yCount; i++) {
      const e = yBuf[i]!;
      const px = e.sortKey / resolution;
      if (px - lastYPx < minYGap) continue;
      lastYPx = px;
      ctx.label = this.labelFor_(e);
      if (!this.drawEdgeSlot_(handler, ctx, slotIndex, vectorContext)) continue;
      slotIndex++;
    }
  }

  private labelFor_(e: DrawEntry): GridLabel {
    if (e.xOffset === 0) return e.label;
    this.reusablePoint_.setCoordinates([e.coord0 + e.xOffset, e.coord1]);
    this.reusableEdgeLabel_.point = this.reusablePoint_;
    this.reusableEdgeLabel_.text = e.label.text;
    this.reusableEdgeLabel_.axis = e.label.axis;
    return this.reusableEdgeLabel_;
  }

  private drawEdgeSlot_(
    handler: EdgeLabelStyleHandler,
    ctx: EdgeLabelContext,
    slotIndex: number,
    vectorContext: ReturnType<typeof getVectorContext>,
  ): boolean {
    const slot = this.getEdgeLabelSlot_(slotIndex);
    if (!handler.update(slot, ctx)) return false;
    vectorContext.drawFeature(slot.feature, slot.style);
    return true;
  }

  private drawCellLabels_(
    vectorContext: ReturnType<typeof getVectorContext>,
    count: number,
  ): void {
    const handler = this.cellLabelHandler_;
    if (!handler) return;

    const buf = this.cellDrawBuf_;
    for (let i = 0; i < count; i++) {
      const e = buf[i]!;
      const label = this.cellLabelFor_(e);
      const slot = this.getCellLabelSlot_(i);
      const drew = handler.update(slot, { label });
      if (!drew) continue;
      vectorContext.drawFeature(slot.feature, slot.style);
    }
  }

  private cellLabelFor_(e: CellDrawEntry): GridCellLabel {
    if (e.xOffset === 0) return e.label;
    this.reusablePoint_.setCoordinates([e.coord0 + e.xOffset, e.coord1]);
    this.reusableCellLabel_.point = this.reusablePoint_;
    this.reusableCellLabel_.text = e.label.text;
    this.reusableCellLabel_.cellSizePx = e.label.cellSizePx;
    return this.reusableCellLabel_;
  }

  private canonicalizeExtent_(extent: Extent, projection: ProjectionLike): Extent {
    const projObj = typeof projection === 'string' ? getProjection(projection) : projection;
    const projExtent = projObj?.getExtent();
    if (!projExtent || !projObj?.canWrapX()) return extent;

    const worldWidth = projExtent[2] - projExtent[0];
    if (worldWidth <= 0) return extent;

    const offsets = this.getVisibleWorldOffsets_(extent, projection);

    let minX = Infinity;
    let maxX = -Infinity;
    for (const offset of offsets) {
      const copyMin = Math.max(extent[0], projExtent[0] + offset);
      const copyMax = Math.min(extent[2], projExtent[2] + offset);
      if (copyMin < copyMax) {
        minX = Math.min(minX, copyMin - offset);
        maxX = Math.max(maxX, copyMax - offset);
      }
    }

    if (!isFinite(minX)) return extent;
    return [minX, extent[1], maxX, extent[3]];
  }

  private getVisibleWorldOffsets_(extent: Extent, projection: ProjectionLike): number[] {
    const projObj = typeof projection === 'string' ? getProjection(projection) : projection;
    const projExtent = projObj?.getExtent();
    if (!projExtent || !projObj?.canWrapX()) return [0];

    const worldWidth = projExtent[2] - projExtent[0];
    if (worldWidth <= 0) return [0];

    const minN = Math.floor((extent[0] - projExtent[2]) / worldWidth) + 1;
    const maxN = Math.floor((extent[2] - projExtent[0]) / worldWidth);

    const offsets: number[] = [];
    for (let n = minN; n <= maxN; n++) {
      offsets.push(n * worldWidth);
    }
    return offsets.length > 0 ? offsets : [0];
  }

  private getEdgeLabelSlot_(index: number): EdgeLabelSlot {
    return growPool(this.edgeLabelPool_, this.edgeLabelHandler_!, index);
  }

  private getCellLabelSlot_(index: number): CellLabelSlot {
    return growPool(this.cellLabelPool_, this.cellLabelHandler_!, index);
  }

  private updatePostrenderListener_(): void {
    const gridSystem = this.gridSystem_;
    const wantsEdge = gridSystem !== null && this.edgeLabelHandler_ !== null;
    const wantsCells =
      gridSystem !== null &&
      this.cellLabelHandler_ !== null &&
      gridSystem.getCellLabels !== undefined;
    const wantsLens = gridSystem !== null && this.hoverLens_ !== null;
    const needed = wantsEdge || wantsCells || wantsLens;
    if (needed && !this.postrenderKey_) {
      this.postrenderKey_ = this.on('postrender', (event) => this.handlePostrender_(event));
    } else if (!needed && this.postrenderKey_) {
      unByKey(this.postrenderKey_);
      this.postrenderKey_ = null;
    }
    if (wantsLens) {
      this.attachPointerTracking_();
    } else {
      this.detachPointerTracking_();
    }
  }

  private attachPointerTracking_(): void {
    if (this.pointerMoveKey_) return;
    const map = this.getMapInternal();
    if (!map) return;
    this.pointerMoveKey_ = map.on('pointermove', (event) => {
      if (event.dragging) return;
      const px = event.pixel;
      const x = px[0];
      const y = px[1];
      if (x === undefined || y === undefined) return;
      this.cursorPx_ = [x, y];
      this.lensIntensityTarget_ = 1;
      map.render();
    });
    const viewport = map.getViewport();
    viewport.addEventListener('pointerleave', this.clearCursor_);
    this.lensViewport_ = viewport;
  }

  private detachPointerTracking_(): void {
    if (this.pointerMoveKey_) {
      unByKey(this.pointerMoveKey_);
      this.pointerMoveKey_ = null;
    }
    if (this.lensViewport_) {
      this.lensViewport_.removeEventListener('pointerleave', this.clearCursor_);
      this.lensViewport_ = null;
    }
    this.cursorPx_ = null;
    this.lensIntensity_ = 0;
    this.lensIntensityTarget_ = 0;
  }

  /**
   * Enable, replace, or disable the pointer lens at runtime. Pass `false` (or
   * `undefined`) to turn it off; pass options to (re)configure it.
   */
  setHoverLens(input: GraticuleHoverLens | undefined): void {
    this.hoverLens_ = resolveHoverLens(input, this.lensLineStyle_);
    this.updatePostrenderListener_();
    this.getMapInternal()?.render();
  }

  getGridSystem(): GridSystem | null {
    return this.gridSystem_;
  }

  /** Activate or deactivate the layer. */
  setGridSystem(gridSystem: GridSystem | null): void {
    this.gridSystem_ = gridSystem;
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
    this.detachPointerTracking_();
    super.disposeInternal();
  }
}

/** Does the value `c` lie within the closed interval spanned by `a` and `b`? */
function straddles(a: number, b: number, c: number): boolean {
  return a === b ? false : (a <= c && c <= b) || (b <= c && c <= a);
}

/** Smallest gap between sorted values (ignoring near-duplicates); NaN if <2. */
function minSpacing(values: number[]): number {
  if (values.length < 2) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (a === undefined || b === undefined) continue;
    const d = b - a;
    if (d > 0.5 && d < min) min = d;
  }
  return min === Infinity ? NaN : min;
}

/** Re-express an `rgb()/rgba()/#hex` colour at a new alpha (rgb preserved). */
function withAlpha(color: string, alpha: number): string {
  const rgb = color.match(/^rgba?\(([^)]+)\)/i);
  if (rgb && rgb[1] !== undefined) {
    const parts = rgb[1].split(',');
    const r = parts[0]?.trim();
    const g = parts[1]?.trim();
    const b = parts[2]?.trim();
    if (r !== undefined && g !== undefined && b !== undefined) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const digits = hex?.[1];
  if (digits !== undefined) {
    const full = digits.length === 3
      ? digits.split('').map((c) => c + c).join('')
      : digits;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

/**
 * Walk a LineString's segments, transforming each vertex to device px through
 * `toPixel` (× `pixelRatio`), and call `cb` with the endpoints of each segment.
 */
function eachSegmentPx(
  geom: LineString,
  toPixel: FrameState['coordinateToPixelTransform'],
  pr: number,
  scratch: number[],
  cb: (x0: number, y0: number, x1: number, y1: number) => void,
): void {
  const flat = geom.getFlatCoordinates();
  const stride = geom.getStride();
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i + 1 < flat.length; i += stride) {
    const fx = flat[i];
    const fy = flat[i + 1];
    if (fx === undefined || fy === undefined) continue;
    scratch[0] = fx;
    scratch[1] = fy;
    const px = applyTransform(toPixel, scratch);
    const x = (px[0] ?? 0) * pr;
    const y = (px[1] ?? 0) * pr;
    if (i > 0) cb(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
}

/** Resample a pixel-space segment and add each run to its width bucket. */
function accumulateSegment(
  runs: number[],
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, radius: number,
  sigmaSq: number, boost: number,
  holeX: number[], holeY: number[], holeS: number[], holeCount: number,
  clearR: number, holeFeather: number,
  step: number, quantum: number, minWidth: number,
): void {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  // Closest approach of the cursor to this segment; skip if outside the swell.
  let t = ((cx - ax) * dx + (cy - ay) * dy) / (length * length);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  if (Math.hypot(cx - (ax + t * dx), cy - (ay + t * dy)) > radius) return;

  const samples = Math.max(1, Math.ceil(length / step));
  let prevX = ax;
  let prevY = ay;
  let runStartX = ax;
  let runStartY = ay;
  let runWidth = widthAt(
    ax, ay, cx, cy, radius, sigmaSq, boost,
    holeX, holeY, holeS, holeCount, clearR, holeFeather, quantum, minWidth,
  );
  for (let i = 1; i <= samples; i++) {
    const f = i / samples;
    const sx = ax + dx * f;
    const sy = ay + dy * f;
    const width = widthAt(
      sx, sy, cx, cy, radius, sigmaSq, boost,
      holeX, holeY, holeS, holeCount, clearR, holeFeather, quantum, minWidth,
    );
    if (width !== runWidth) {
      if (runWidth >= minWidth) runs.push(runStartX, runStartY, prevX, prevY, runWidth);
      runStartX = prevX;
      runStartY = prevY;
      runWidth = width;
    }
    prevX = sx;
    prevY = sy;
  }
  if (runWidth >= minWidth) runs.push(runStartX, runStartY, prevX, prevY, runWidth);
}

/**
 * Quantised swell width at a pixel. The swell peaks at the cursor and tapers to
 * 0 by the radius. The deepest overlapping intersection hole is subtracted (max,
 * not sum) so crossings stay clear and adjacent holes cross-fade smoothly.
 */
function widthAt(
  x: number, y: number, cx: number, cy: number, radius: number,
  sigmaSq: number, boost: number,
  holeX: number[], holeY: number[], holeS: number[], holeCount: number,
  clearR: number, holeFeather: number,
  quantum: number, minWidth: number,
): number {
  const dxc = cx - x;
  const dyc = cy - y;
  const distCSq = dxc * dxc + dyc * dyc;
  if (distCSq > radius * radius) return 0;
  let width = boost * Math.exp(-distCSq / sigmaSq);

  let carve = 0;
  for (let j = 0; j < holeCount; j++) {
    const hxj = holeX[j];
    const hyj = holeY[j];
    const hsj = holeS[j];
    if (hxj === undefined || hyj === undefined || hsj === undefined) continue;
    const distI = Math.hypot(hxj - x, hyj - y);
    let shape: number;
    if (distI <= clearR) shape = 1;
    else if (distI >= clearR + holeFeather) shape = 0;
    else {
      const r = (distI - clearR) / holeFeather;
      shape = 1 - r * r * (3 - 2 * r); // smoothstep 1 → 0 across the feather
    }
    const c = hsj * shape;
    if (c > carve) carve = c;
  }
  if (carve > 0) width *= 1 - carve;

  if (width < minWidth) return 0;
  return Math.round(width / quantum) * quantum;
}

/**
 * Stroke one straight run with a gradient perpendicular to its direction —
 * `transparent → solid → transparent` across the line width — giving a soft,
 * feathered (glowing) cross-section instead of a hard edge.
 */
function strokeFeatheredRun(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number, width: number,
  solid: string, transparent: string,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const px = -dy / len;
  const py = dx / len;
  const h = width / 2;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const grd = ctx.createLinearGradient(mx - px * h, my - py * h, mx + px * h, my + py * h);
  // Solid plateau in the middle, feather only the outer edges, so the line
  // keeps presence while the cross-section still glows softly.
  grd.addColorStop(0, transparent);
  grd.addColorStop(0.28, solid);
  grd.addColorStop(0.72, solid);
  grd.addColorStop(1, transparent);
  ctx.strokeStyle = grd;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function growPool<S>(pool: S[], handler: { create(): S }, index: number): S {
  while (index >= pool.length) {
    pool.push(handler.create());
  }
  return pool[index]!;
}

function pushDrawEntry(
  buf: DrawEntry[],
  i: number,
  label: GridLabel,
  sortKey: number,
  xOffset: number,
  coord0: number,
  coord1: number,
): void {
  const slot = buf[i];
  if (slot === undefined) {
    buf[i] = { label, sortKey, xOffset, coord0, coord1 };
    return;
  }
  slot.label = label;
  slot.sortKey = sortKey;
  slot.xOffset = xOffset;
  slot.coord0 = coord0;
  slot.coord1 = coord1;
}

function pushCellEntry(
  buf: CellDrawEntry[],
  i: number,
  label: GridCellLabel,
  xOffset: number,
  coord0: number,
  coord1: number,
): void {
  const slot = buf[i];
  if (slot === undefined) {
    buf[i] = { label, xOffset, coord0, coord1 };
    return;
  }
  slot.label = label;
  slot.xOffset = xOffset;
  slot.coord0 = coord0;
  slot.coord1 = coord1;
}

function sortPrefix(buf: DrawEntry[], count: number): void {
  if (count <= 1) return;
  for (let i = 1; i < count; i++) {
    const cur = buf[i]!;
    const key = cur.sortKey;
    let j = i - 1;
    while (j >= 0 && buf[j]!.sortKey > key) {
      buf[j + 1] = buf[j]!;
      j--;
    }
    buf[j + 1] = cur;
  }
}
