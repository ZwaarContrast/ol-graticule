import LineString from 'ol/geom/LineString';
import {
  apply as applyTransform,
  create as createTransform,
  scale as scaleTransform,
  setFromArray as setTransformFromArray,
} from 'ol/transform';
import type { Transform } from 'ol/transform';
import type OLMap from 'ol/Map';
import type Feature from 'ol/Feature';
import type VectorSource from 'ol/source/Vector';
import type RenderEvent from 'ol/render/Event';
import type { FrameState } from 'ol/Map';
import type { ResolvedHoverLens } from '../style.js';
import { withAlpha } from '../util/color.js';
import { worldOffsetOf } from '../util/worldWrap.js';
import { collectLensHoles, eachSegmentPx, lineNearCursor } from './lensGeometry.js';
import { LensPointers } from './LensPointers.js';

/** One grid the canvas lens may swell, with its features source and lens style. */
export interface CanvasLensGrid {
  source: VectorSource;
  lens: ResolvedHoverLens | null;
}

const LENS_MAX_HOLES = 64;
const LENS_SWELL_ALPHA = 0.88;
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
  sharedLensBuffer ??= document.createElement('canvas');
  if (sharedLensBuffer.width !== w || sharedLensBuffer.height !== h) {
    sharedLensBuffer.width = w;
    sharedLensBuffer.height = h;
  }
  const bctx = sharedLensBuffer.getContext('2d');
  if (!bctx) return null;
  // Clear only the lens box: stale pixels outside it are never composited back.
  bctx.clearRect(clearX, clearY, clearW, clearH);
  return bctx;
}

/**
 * The grid-magnifier swell inside UniversalGraticule: a soft luminous bump on
 * the grid lines under the cursor, with a clear dot on each crossing within
 * reach. Owns its own pointer tracking and opacity fade, so a resting cursor
 * needs no further frames.
 */
export class HoverLensRenderer {
  private readonly getGrids_: () => readonly CanvasLensGrid[];
  // One lens per active pointer (mouse or each touch), so several fingers each
  // get their own swell.
  private readonly pointers_ = new LensPointers();
  private readonly scratch_: [number, number] = [0, 0];
  // Maps the lens's screen device px into the (CSS-rotated) layer canvas bitmap.
  private readonly transform_ = createTransform();
  // Active intersection holes this frame (device px) + their fade strengths.
  private readonly holeX_: number[] = [];
  private readonly holeY_: number[] = [];
  private readonly holeS_: number[] = [];
  // Swell runs this frame, flat as [x0, y0, x1, y1, width, …] (device px).
  private readonly runs_: number[] = [];
  // Local grid cell size (device px) measured this frame; 0 if unknown.
  private cellPx_ = 0;

  constructor(getGrids: () => readonly CanvasLensGrid[]) {
    this.getGrids_ = getGrids;
  }

  /** Whether any grid has a lens configured (independent of whether it draws). */
  get active(): boolean {
    return this.getGrids_().some((g) => g.lens !== null);
  }

  /**
   * Step the opacity fade and draw the lens for the current cursor. Returns
   * whether the opacity is still easing, so the caller can keep the frame loop
   * alive; a resting cursor returns false and needs no more frames.
   */
  draw(event: RenderEvent): boolean {
    const fading = this.pointers_.step();
    this.drawLens_(event);
    return fading;
  }

  attach(map: OLMap): void {
    this.pointers_.attach(map.getViewport(), () => map.render());
  }

  detach(): void {
    this.pointers_.detach();
  }

  /**
   * The wrap offset (map units) of the world the cursor sits in, so the lens can
   * shift base-world source lines into that world. Zero when the projection does
   * not wrap in x.
   */
  private cursorWorldOffset_(frameState: FrameState, cursorCss: [number, number]): number {
    const s = this.scratch_;
    s[0] = cursorCss[0];
    s[1] = cursorCss[1];
    applyTransform(frameState.pixelToCoordinateTransform, s);
    return worldOffsetOf(s[0], frameState.viewState.projection);
  }

  /** Draws each grid's lens (swell + crossing dots) under every active pointer. */
  private drawLens_(event: RenderEvent): void {
    const grids = this.getGrids_();
    const frameState = event.frameState;
    const ctx = event.context;
    const inverse = event.inversePixelTransform;
    if (grids.length === 0 || !frameState || !inverse) return;
    if (!(ctx instanceof CanvasRenderingContext2D)) return;
    if (this.pointers_.count === 0) return;
    const pr = frameState.pixelRatio;
    const toPixel = frameState.coordinateToPixelTransform;

    ctx.save();
    // All lens geometry is in screen device px, but the layer canvas is a
    // world-aligned bitmap that OL rotates onto screen via CSS. Map our screen
    // coords onto that bitmap so the lens tracks the cursor under rotation.
    // At rotation 0 this resolves to the identity.
    const toBitmap = screenToBitmapTransform(this.transform_, inverse, pr);
    ctx.setTransform(
      toBitmap[0], toBitmap[1], toBitmap[2], toBitmap[3], toBitmap[4], toBitmap[5],
    );

    // Only the grid under a pointer produces swell (grids are clipped to
    // disjoint regions), each in its own lens ink.
    for (const grid of grids) {
      const lens = grid.lens;
      if (!lens) continue;
      const features = grid.source.getFeatures();
      this.pointers_.forEach((pointer) => {
        this.drawOneLens_(ctx, frameState, features, pr, toPixel, lens, pointer.x, pointer.y, pointer.intensity);
      });
    }

    ctx.restore();
  }

  /** Compose one lens's swell + dots for a single pointer at (cursorCss). */
  private drawOneLens_(
    ctx: CanvasRenderingContext2D,
    frameState: FrameState,
    features: Feature[],
    pr: number,
    toPixel: FrameState['coordinateToPixelTransform'],
    lens: ResolvedHoverLens,
    cursorCssX: number, cursorCssY: number, intensity: number,
  ): void {
    const worldOffset = this.cursorWorldOffset_(frameState, [cursorCssX, cursorCssY]);
    const cx = cursorCssX * pr;
    const cy = cursorCssY * pr;
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
      features, toPixel, pr, worldOffset, cx, cy, radius, lens.approachFraction, lens.approach * pr,
    );
    const holeX = this.holeX_;
    const holeY = this.holeY_;
    const holeS = this.holeS_;
    const cell = this.cellPx_;
    // Keep the clear hole from exceeding the cell on fine grids; soft edge.
    const clearR = cell > 0
      ? Math.min(lens.clearRadius * pr, cell * 0.42)
      : lens.clearRadius * pr;
    const holeFeather = Math.min(12 * pr, clearR * 0.85);

    const runs = this.runs_;
    runs.length = 0;
    const scratch = this.scratch_;

    for (const feature of features) {
      const geom = feature.getGeometry();
      if (!(geom instanceof LineString)) continue;
      if (!lineNearCursor(geom, toPixel, pr, worldOffset, cx, cy, radius, scratch)) continue;

      eachSegmentPx(geom, toPixel, pr, worldOffset, scratch, (x0, y0, x1, y1) => {
        accumulateSegment(
          runs, x0, y0, x1, y1,
          cx, cy, radius, sigmaSq, boost,
          holeX, holeY, holeS, holeCount, clearR, holeFeather,
          step, quantum, minWidth,
        );
      });
    }

    this.renderSwell_(ctx, lens, cx, cy, radius, intensity, pr);
    this.renderDots_(ctx, lens, holeCount, intensity, pr);
  }

  /**
   * Composite this frame's swell runs (`runs_`) onto `ctx`. Each run is stroked
   * into an offscreen buffer with a gradient PERPENDICULAR to its direction
   * (transparent → solid → transparent) for a soft feathered cross-section
   * instead of a hard edge; abutting butt caps keep collinear runs from stacking
   * into beads. The bright-core → faint-skirt focus ramp is applied as one radial
   * gradient (destination-in) and the whole buffer composited once. Every
   * full-buffer op is restricted to the box bounding the lens disc (padded for
   * the feather), so cost scales with the lens, not the viewport.
   */
  private renderSwell_(
    ctx: CanvasRenderingContext2D,
    lens: ResolvedHoverLens,
    cx: number, cy: number, radius: number, intensity: number, pr: number,
  ): void {
    const runs = this.runs_;
    if (runs.length === 0) return;
    const opaque = withAlpha(lens.color, 1);
    const transparent = withAlpha(lens.color, 0);
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    const pad = LENS_BOX_PAD * pr;
    const bx0 = Math.max(0, Math.floor(cx - radius - pad));
    const by0 = Math.max(0, Math.floor(cy - radius - pad));
    const bw = Math.min(cw, Math.ceil(cx + radius + pad)) - bx0;
    const bh = Math.min(ch, Math.ceil(cy + radius + pad)) - by0;
    const bctx = bw > 0 && bh > 0 ? acquireLensBuffer(cw, ch, bx0, by0, bw, bh) : null;
    if (!bctx) return;

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

  /**
   * A soft glowing dot on each active intersection hole (`hole*_`), via a radial
   * gradient. Fainter dots for farther crossings, so they cross-fade as the
   * cursor moves; drawn at a fixed size, so a resting cursor needs no more frames.
   */
  private renderDots_(
    ctx: CanvasRenderingContext2D,
    lens: ResolvedHoverLens,
    holeCount: number, intensity: number, pr: number,
  ): void {
    if (holeCount === 0) return;
    const glowR = pr * 2.4;
    const transparent = withAlpha(lens.color, 0);
    for (let j = 0; j < holeCount; j++) {
      const jx = this.holeX_[j];
      const jy = this.holeY_[j];
      const js = this.holeS_[j];
      if (jx === undefined || jy === undefined || js === undefined) continue;
      // Fade in only for the crossing(s) nearest the cursor, so a generous carve
      // reach never lights up a cluster of faint dots.
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

  /**
   * Collect the grid intersections within `approach` px of the cursor into the
   * `hole*_` scratch arrays, each with a smoothstep fade strength, and return how
   * many. Each hole sits on the true crossing of a meridian and a parallel,
   * found by intersecting their nearest-to-cursor screen segments, so the holes
   * track the grid under view rotation (where the lines are not screen
   * axis-aligned). Carrying the whole set lets overlapping holes cross-fade.
   */
  private collectHoles_(
    features: Feature[],
    toPixel: FrameState['coordinateToPixelTransform'],
    pr: number,
    worldOffset: number,
    cx: number,
    cy: number,
    searchRadius: number,
    approachFraction: number,
    fallbackApproach: number,
  ): number {
    const { holes, cell } = collectLensHoles(
      features, toPixel, pr, worldOffset, cx, cy, searchRadius,
      approachFraction, fallbackApproach, LENS_MAX_HOLES,
    );
    this.cellPx_ = cell;
    const hx = this.holeX_;
    const hy = this.holeY_;
    const hs = this.holeS_;
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i];
      if (!h) continue;
      hx[i] = h.x;
      hy[i] = h.y;
      hs[i] = h.strength;
    }
    return holes.length;
  }
}
/**
 * Transform mapping the lens's screen device px onto the layer canvas bitmap,
 * which OL rotates onto screen via CSS. `inversePixelTransform` takes CSS px, so
 * undo the device-px scaling first. Resolves to the identity at rotation 0.
 */
export function screenToBitmapTransform(
  out: Transform,
  inversePixelTransform: Transform,
  pixelRatio: number,
): Transform {
  setTransformFromArray(out, inversePixelTransform);
  scaleTransform(out, 1 / pixelRatio, 1 / pixelRatio);
  return out;
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
 * Stroke one straight run with a gradient perpendicular to its direction
 * (`transparent → solid → transparent` across the line width), giving a soft,
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
