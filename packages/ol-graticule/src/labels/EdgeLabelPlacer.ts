import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import { apply as applyTransform } from 'ol/transform';
import type { Transform } from 'ol/transform';
import { getFontParameters } from 'ol/css';
import type { LabelSink } from './LabelSink.js';
import type VectorSource from 'ol/source/Vector';
import type Projection from 'ol/proj/Projection';
import type { Extent } from 'ol/extent';
import type { GridLabel } from '../types.js';
import type {
  EdgeLabelContext,
  EdgeLabelEdge,
  EdgeLabelSlot,
  EdgeLabelStyleHandler,
  GraticuleLineStyle,
} from '../style.js';
import { borderAnchor, distToSegmentSq } from '../util/edgeCrossing.js';
import { withAlpha } from '../util/color.js';

const DEFAULT_LABEL_FONT_SIZE = 10;

// Screen frame edges for edge-label placement.
const EDGE_TOP = 0;
const EDGE_BOTTOM = 1;
const EDGE_LEFT = 2;
const EDGE_RIGHT = 3;
// Whether an edge is horizontal (crossed at constant Y): top/bottom yes.
const EDGE_HORIZONTAL: readonly boolean[] = [true, true, false, false];
// EDGE_* index → the public edge name handed to the style handler.
const EDGE_NAME: readonly EdgeLabelEdge[] = ['top', 'bottom', 'left', 'right'];
// CSS px: drop a rotated label whose anchor lands this close to a frame corner.
const LABEL_CORNER_MARGIN = 16;
// CSS px of clear space kept between adjacent labels on one edge.
const LABEL_GAP_PAD = 4;
// CSS px length of a leader tick.
const LABEL_TICK_PX = 8;
// Opacity of the (dotted) label leader, so it reads as a quiet connector.
const LEADER_ALPHA = 0.4;

/** A collected edge label plus its world offset and pre-shift coordinates. */
export interface DrawEntry {
  label: GridLabel;
  sortKey: number;
  xOffset: number;
  coord0: number;
  coord1: number;
}

/**
 * The rotated visible rectangle a label is anchored against this frame (rotation
 * may be 0): the rotation centre with its cos/sin, the un-rotated visible
 * rectangle, per-edge geometry, and the projection wrap width.
 */
export interface EdgeLabelFrame {
  cx: number;
  cy: number;
  cos: number;
  sin: number;
  rotExtent: [number, number, number, number];
  // Per-edge TOP(0) BOTTOM(1) LEFT(2) RIGHT(3): the edge value in the un-rotated
  // frame and the visible span of the free axis.
  edgeTarget: [number, number, number, number];
  edgeSpanLo: [number, number, number, number];
  edgeSpanHi: [number, number, number, number];
  // Projection wrap width (map units), 0 when the projection does not wrap in x.
  worldWidth: number;
}

/** This frame's coord↔CSS px transforms and viewport size. */
export interface ScreenFrame {
  toPixel: Transform;
  fromPixel: Transform;
  viewW: number;
  viewH: number;
}

/** Placement options carried from the coordinator's constructor. */
export interface EdgeLabelConfig {
  xLabelPosition: 'top' | 'bottom';
  yLabelPosition: 'left' | 'right';
  xLabelOffset: number;
  yLabelOffset: number;
  edgeLabelCoverage: 'primary' | 'opposite' | 'all';
  edgeLabelLeader: 'none' | 'tick' | 'line';
  edgeLabelExtend: 'none' | 'line' | 'axis';
}

/**
 * Build the frame used to anchor edge labels against the visible border. Works
 * north-up and rotated alike (rotation 0 for north-up).
 */
export function edgeLabelFrame(
  center: number[],
  size: number[],
  resolution: number,
  rotation: number,
  projection: Projection,
): EdgeLabelFrame {
  const cx = center[0] ?? 0;
  const cy = center[1] ?? 0;
  const hw = ((size[0] ?? 0) * resolution) / 2;
  const hh = ((size[1] ?? 0) * resolution) / 2;
  const minX = cx - hw;
  const minY = cy - hh;
  const maxX = cx + hw;
  const maxY = cy + hh;
  let worldWidth = 0;
  if (projection.canWrapX()) {
    const pe = projection.getExtent();
    if (pe) worldWidth = pe[2] - pe[0];
  }
  return {
    cx,
    cy,
    cos: Math.cos(rotation),
    sin: Math.sin(rotation),
    rotExtent: [minX, minY, maxX, maxY],
    // Top/bottom cross a constant Y and range over X; left/right cross a
    // constant X and range over Y.
    edgeTarget: [maxY, minY, minX, maxX],
    edgeSpanLo: [minX, minX, minY, minY],
    edgeSpanHi: [maxX, maxX, maxY, maxY],
    worldWidth,
  };
}

/**
 * Places one edge label per collected grid line against the visible viewport
 * border, north-up and rotated alike: anchor it to its best ranked edge, cull
 * corners and collisions, draw it, and optionally its leader.
 */
export class EdgeLabelPlacer {
  private readonly source_: VectorSource;
  private readonly handler_: EdgeLabelStyleHandler;
  private readonly xLabelPosition_: 'top' | 'bottom';
  private readonly yLabelPosition_: 'left' | 'right';
  private readonly xLabelOffset_: number;
  private readonly yLabelOffset_: number;
  private readonly edgeLabelCoverage_: 'primary' | 'opposite' | 'all';
  private readonly edgeLabelLeader_: 'none' | 'tick' | 'line';
  private readonly edgeLabelExtend_: 'none' | 'line' | 'axis';
  // Ranked candidate edges per axis, derived from coverage + label positions.
  private readonly xEdgeOrder_: number[] = [];
  private readonly yEdgeOrder_: number[] = [];
  private readonly edgeLabelPool_: EdgeLabelSlot[] = [];
  private readonly labelFontSize_: number;
  private readonly labelCross_: [number, number] = [0, 0];
  private readonly labelDir_: [number, number] = [0, 0];
  private readonly labelSeg_: [number, number, number, number] = [0, 0, 0, 0];
  // Endpoints (view coords) of the current label's grid line, world-shifted.
  private readonly lineEnds_: [number, number, number, number] = [0, 0, 0, 0];
  private readonly labelPxScratch_: [number, number] = [0, 0];
  // Scan source split by axis once per place(), so nearestLine_ walks only
  // same-axis candidates instead of re-fetching + re-filtering every feature per
  // label (source.getFeatures() allocates on each call).
  private readonly xLines_: LineString[] = [];
  private readonly yLines_: LineString[] = [];
  // Occupied intervals (screen px along each edge) placed this frame, for
  // collision culling: edgeOccupied_[edge] = flat [lo, hi, lo, hi, …].
  private readonly edgeOccupied_: number[][] = [[], [], [], []];
  // Grid-side endpoint of the current label's leader (view coords), or null when
  // the label sits on its line (no gap to bridge).
  private labelLeaderEnd_: [number, number] | null = null;
  private readonly reusablePoint_: Point = new Point([0, 0]);
  private readonly reusableEdgeLabel_: GridLabel = {
    point: this.reusablePoint_, text: '', axis: 'x',
  };
  private readonly tickGeom_ = new LineString([[0, 0], [0, 0]]);
  private readonly tickStyle_: Style;

  constructor(
    config: EdgeLabelConfig,
    handler: EdgeLabelStyleHandler,
    source: VectorSource,
    lineStyle: GraticuleLineStyle | undefined,
  ) {
    this.source_ = source;
    this.handler_ = handler;
    this.xLabelPosition_ = config.xLabelPosition;
    this.yLabelPosition_ = config.yLabelPosition;
    this.xLabelOffset_ = config.xLabelOffset;
    this.yLabelOffset_ = config.yLabelOffset;
    this.edgeLabelCoverage_ = config.edgeLabelCoverage;
    this.edgeLabelLeader_ = config.edgeLabelLeader;
    this.edgeLabelExtend_ = config.edgeLabelExtend;
    this.buildEdgeOrder_();

    this.tickStyle_ = new Style({
      stroke: new Stroke({
        color: withAlpha(majorLineColor(lineStyle), LEADER_ALPHA),
        width: 1,
        lineDash: [1, 4],
        lineCap: 'round',
      }),
    });

    const first = handler.create();
    this.edgeLabelPool_.push(first);
    const params = getFontParameters(first.text.getFont() ?? '');
    const parsed = params ? parseFloat(params.size) : NaN;
    this.labelFontSize_ = Number.isFinite(parsed) ? parsed : DEFAULT_LABEL_FONT_SIZE;
  }

  /**
   * Draw every collected label. One path for north-up and rotated: the frame is
   * built with the current rotation (0 for north-up), so every label is placed
   * against the visible border the same way.
   */
  place(
    vectorContext: LabelSink,
    frame: EdgeLabelFrame,
    screen: ScreenFrame,
    extent: Extent,
    resolution: number,
    xBuf: DrawEntry[],
    xCount: number,
    yBuf: DrawEntry[],
    yCount: number,
  ): void {
    for (const occ of this.edgeOccupied_) occ.length = 0;
    this.partitionLines_();

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
    for (let i = 0; i < xCount; i++) {
      const e = xBuf[i];
      if (!e) continue;
      ctx.label = this.labelFor_(e);
      slotIndex = this.placeEdgeLabel_(ctx, slotIndex, resolution, vectorContext, frame, screen);
    }
    for (let i = 0; i < yCount; i++) {
      const e = yBuf[i];
      if (!e) continue;
      ctx.label = this.labelFor_(e);
      slotIndex = this.placeEdgeLabel_(ctx, slotIndex, resolution, vectorContext, frame, screen);
    }
  }

  /**
   * Place one edge label: anchor it to its best ranked edge, cull
   * it if it lands in a corner or collides with an already-placed label on that
   * edge, draw it, and (optionally) its leader tick. Returns the next slot index.
   */
  private placeEdgeLabel_(
    ctx: EdgeLabelContext,
    slotIndex: number,
    resolution: number,
    vectorContext: LabelSink,
    frame: EdgeLabelFrame,
    screen: ScreenFrame,
  ): number {
    const edge = this.edgeLabelExtend_ === 'axis'
      ? this.axisAnchor_(ctx.label, resolution, frame, screen)
      : this.anchorToBorder_(ctx.label, resolution, frame);
    if (edge < 0) return slotIndex;
    if (!this.reserveEdgeSlot_(ctx.label, edge, screen)) return slotIndex;
    ctx.preplaced = true;
    ctx.edge = EDGE_NAME[edge];
    const slot = this.getEdgeLabelSlot_(slotIndex);
    if (!this.handler_.update(slot, ctx)) return slotIndex;
    // Leader first, so it sits beneath the label rather than over its text.
    if (this.edgeLabelLeader_ !== 'none') this.drawLeader_(vectorContext, ctx.label, resolution, frame);
    vectorContext.drawFeature(slot.feature, slot.style);
    return slotIndex + 1;
  }

  /** Precompute the ranked edge candidates per axis from coverage + positions. */
  private buildEdgeOrder_(): void {
    const xPrimary = this.xLabelPosition_ === 'top' ? EDGE_TOP : EDGE_BOTTOM;
    const xOpp = xPrimary === EDGE_TOP ? EDGE_BOTTOM : EDGE_TOP;
    const yPrimary = this.yLabelPosition_ === 'left' ? EDGE_LEFT : EDGE_RIGHT;
    const yOpp = yPrimary === EDGE_LEFT ? EDGE_RIGHT : EDGE_LEFT;
    const cov = this.edgeLabelCoverage_;
    this.xEdgeOrder_.length = 0;
    this.yEdgeOrder_.length = 0;
    this.xEdgeOrder_.push(xPrimary);
    this.yEdgeOrder_.push(yPrimary);
    if (cov !== 'primary') {
      this.xEdgeOrder_.push(xOpp);
      this.yEdgeOrder_.push(yOpp);
    }
    if (cov === 'all') {
      this.xEdgeOrder_.push(yPrimary, yOpp);
      this.yEdgeOrder_.push(xPrimary, xOpp);
    }
  }

  /**
   * Resolve the visible grid line for `label` and write its two endpoints (view
   * coords, shifted into the label's world) into `lineEnds_`; false when no
   * matching line is found or it is degenerate. Shared preamble of both anchor
   * strategies.
   *
   * Source lines live in the base world, but a label point near the antimeridian
   * can carry an un-normalised x from another world. We normalise the point into
   * the base world to find the line (matching the label's own axis via
   * `gridAxis`, so a point on the grid's boundary frame picks its own
   * meridian/parallel, not the frame), then shift its endpoints back so the
   * crossing lands in the label's world.
   */
  private resolveLineEnds_(label: GridLabel, resolution: number, frame: EdgeLabelFrame): boolean {
    const coords = label.point.getCoordinates();
    const worldShift = frame.worldWidth > 0
      ? frame.worldWidth * Math.round((coords[0] ?? 0) / frame.worldWidth)
      : 0;
    const line = this.nearestLine_(
      label.axis === 'x' ? this.xLines_ : this.yLines_,
      (coords[0] ?? 0) - worldShift, coords[1] ?? 0, resolution,
    );
    if (!line) return false;
    const flat = line.getFlatCoordinates();
    const stride = line.getStride();
    const n = flat.length;
    if (n < 2 * stride) return false;
    this.lineEnds_[0] = (flat[0] ?? 0) + worldShift;
    this.lineEnds_[1] = flat[1] ?? 0;
    this.lineEnds_[2] = (flat[n - stride] ?? 0) + worldShift;
    this.lineEnds_[3] = flat[n - stride + 1] ?? 0;
    return true;
  }

  /**
   * Move `label.point` to where its grid line meets the visible viewport border,
   * trying the ranked candidate edges (`edgeLabelCoverage`) and taking the first
   * the line actually crosses. Anchored to the line's visible span, so a line
   * stopping short of the edge is labelled at its end. Returns the edge it
   * landed on (`EDGE_*`), or -1 if none.
   */
  private anchorToBorder_(label: GridLabel, resolution: number, frame: EdgeLabelFrame): number {
    if (!this.resolveLineEnds_(label, resolution, frame)) return -1;
    const [x0, y0, x1, y1] = this.lineEnds_;
    const order = label.axis === 'x' ? this.xEdgeOrder_ : this.yEdgeOrder_;
    const e = frame.rotExtent;
    for (const edge of order) {
      // Viewport range along the edge's own axis: X for the horizontal top/bottom
      // edges, Y for the vertical left/right.
      const horizontal = EDGE_HORIZONTAL[edge] ?? false;
      const targetLo = horizontal ? e[1] : e[0];
      const targetHi = horizontal ? e[3] : e[2];
      const placed = borderAnchor(
        x0, y0, x1, y1,
        frame.cx, frame.cy, frame.cos, frame.sin,
        horizontal, frame.edgeTarget[edge] ?? 0, frame.edgeSpanLo[edge] ?? 0, frame.edgeSpanHi[edge] ?? 0,
        targetLo, targetHi, this.edgeLabelExtend_ === 'line', this.labelCross_,
      );
      if (placed) {
        label.point.setCoordinates([this.labelCross_[0], this.labelCross_[1]]);
        this.labelDir_[0] = x1 - x0;
        this.labelDir_[1] = y1 - y0;
        this.labelSeg_[0] = x0; this.labelSeg_[1] = y0;
        this.labelSeg_[2] = x1; this.labelSeg_[3] = y1;
        this.labelLeaderEnd_ = this.nearLineEnd_(this.labelCross_[0], this.labelCross_[1]);
        return edge;
      }
    }
    return -1;
  }

  /**
   * Anchor a label to the map border straight out from its grid line's end:
   * screen-vertical for x-axis (top/bottom edges), screen-horizontal for y-axis
   * (left/right), so labels line up optically with where the grid line stops.
   * Returns the edge, or -1 when the line's near end is off screen. Sets the
   * leader endpoint so the connector runs straight to the label.
   */
  private axisAnchor_(
    label: GridLabel, resolution: number, frame: EdgeLabelFrame, screen: ScreenFrame,
  ): number {
    if (!this.resolveLineEnds_(label, resolution, frame)) return -1;
    const [x0, y0, x1, y1] = this.lineEnds_;
    const toPixel = screen.toPixel;
    const fromPixel = screen.fromPixel;
    const s = this.labelPxScratch_;
    s[0] = x0; s[1] = y0; applyTransform(toPixel, s);
    const sx0 = s[0], sy0 = s[1];
    s[0] = x1; s[1] = y1; applyTransform(toPixel, s);
    const sx1 = s[0], sy1 = s[1];

    let edge: number, anchorSx: number, anchorSy: number;
    let leaderEnd: [number, number] | null;
    if (label.axis === 'x') {
      // Easting → top/bottom edge; straight (screen-vertical) leader.
      const top = this.xLabelPosition_ === 'top';
      edge = top ? EDGE_TOP : EDGE_BOTTOM;
      const edgeSy = top ? 0 : screen.viewH;
      // Clipped short of the edge when both ends stay on the map side of it.
      const clipped = top ? sy0 >= edgeSy && sy1 >= edgeSy : sy0 <= edgeSy && sy1 <= edgeSy;
      anchorSy = edgeSy;
      if (clipped) {
        // Drop straight down/up from the near end; the leader bridges the gap.
        const first = top ? sy0 <= sy1 : sy0 >= sy1;
        anchorSx = first ? sx0 : sx1;
        leaderEnd = [first ? x0 : x1, first ? y0 : y1];
      } else {
        // The line reaches the edge: ride the crossing (moves as you pan).
        const dsy = sy1 - sy0;
        if (dsy > -1e-6 && dsy < 1e-6) return -1;
        anchorSx = sx0 + ((sx1 - sx0) * (edgeSy - sy0)) / dsy;
        leaderEnd = null;
      }
      if (anchorSx < 0 || anchorSx > screen.viewW) return -1;
    } else {
      // Northing → left/right edge; straight (screen-horizontal) leader.
      const left = this.yLabelPosition_ === 'left';
      edge = left ? EDGE_LEFT : EDGE_RIGHT;
      const edgeSx = left ? 0 : screen.viewW;
      const clipped = left ? sx0 >= edgeSx && sx1 >= edgeSx : sx0 <= edgeSx && sx1 <= edgeSx;
      anchorSx = edgeSx;
      if (clipped) {
        const first = left ? sx0 <= sx1 : sx0 >= sx1;
        anchorSy = first ? sy0 : sy1;
        leaderEnd = [first ? x0 : x1, first ? y0 : y1];
      } else {
        const dsx = sx1 - sx0;
        if (dsx > -1e-6 && dsx < 1e-6) return -1;
        anchorSy = sy0 + ((sy1 - sy0) * (edgeSx - sx0)) / dsx;
        leaderEnd = null;
      }
      if (anchorSy < 0 || anchorSy > screen.viewH) return -1;
    }
    s[0] = anchorSx; s[1] = anchorSy; applyTransform(fromPixel, s);
    const ax = s[0], ay = s[1];
    label.point.setCoordinates([ax, ay]);
    this.labelLeaderEnd_ = leaderEnd;
    this.labelDir_[0] = leaderEnd ? leaderEnd[0] - ax : x1 - x0;
    this.labelDir_[1] = leaderEnd ? leaderEnd[1] - ay : y1 - y0;
    return edge;
  }

  /**
   * Reserve screen space for a label on `edge`: reject it if it falls in a
   * corner or overlaps an already-placed label on that edge, else record its
   * occupied interval. Keeps the rulers from stacking or bleeding off a
   * corner.
   */
  private reserveEdgeSlot_(label: GridLabel, edge: number, screen: ScreenFrame): boolean {
    const toPixel = screen.toPixel;
    const c = label.point.getCoordinates();
    this.labelPxScratch_[0] = c[0] ?? 0;
    this.labelPxScratch_[1] = c[1] ?? 0;
    applyTransform(toPixel, this.labelPxScratch_);
    const sx = this.labelPxScratch_[0];
    const sy = this.labelPxScratch_[1];
    const m = LABEL_CORNER_MARGIN;
    if ((sx < m || sx > screen.viewW - m) && (sy < m || sy > screen.viewH - m)) return false;
    const horizontal = EDGE_HORIZONTAL[edge] ?? false;
    const along = horizontal ? sx : sy;
    const half = horizontal
      ? (label.text.length * this.labelFontSize_ * 0.6) / 2
      : this.labelFontSize_ / 2;
    const lo = along - half;
    const hi = along + half;
    const occ = this.edgeOccupied_[edge] ?? [];
    for (let k = 0; k < occ.length; k += 2) {
      if (lo < (occ[k + 1] ?? 0) + LABEL_GAP_PAD && hi > (occ[k] ?? 0) - LABEL_GAP_PAD) return false;
    }
    occ.push(lo, hi);
    return true;
  }

  /**
   * Draw a leader from a placed label back along its grid line. `'tick'` is a
   * short mark; `'line'` reaches to the grid line's near end, drawing the
   * (otherwise invisible) extension a clipped line makes to the map border.
   */
  private drawLeader_(
    vectorContext: LabelSink,
    label: GridLabel,
    resolution: number,
    frame: EdgeLabelFrame,
  ): void {
    const c = label.point.getCoordinates();
    const ax = c[0] ?? 0;
    const ay = c[1] ?? 0;
    let dx = this.labelDir_[0];
    let dy = this.labelDir_[1];
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    dx /= len;
    dy /= len;
    // Point the leader inward (toward the rotation centre).
    if (dx * (frame.cx - ax) + dy * (frame.cy - ay) < 0) {
      dx = -dx;
      dy = -dy;
    }
    let ex: number;
    let ey: number;
    if (this.edgeLabelLeader_ === 'line') {
      // Reach the grid line's end the anchor was extended from; skip when the
      // label already sits on the line (no gap to bridge).
      const near = this.labelLeaderEnd_;
      if (!near) return;
      ex = near[0];
      ey = near[1];
    } else {
      const reach = LABEL_TICK_PX * resolution;
      ex = ax + dx * reach;
      ey = ay + dy * reach;
    }
    this.tickGeom_.setCoordinates([[ax, ay], [ex, ey]]);
    vectorContext.setStyle(this.tickStyle_);
    vectorContext.drawGeometry(this.tickGeom_);
  }

  /**
   * The end of this frame's grid-line segment (`labelSeg_`) that anchor
   * `(ax, ay)` was extended past, or null when the anchor lies on the segment
   * (the line already reaches the border, so there is no gap to draw).
   */
  private nearLineEnd_(ax: number, ay: number): [number, number] | null {
    const [x0, y0, x1, y1] = this.labelSeg_;
    const segdx = x1 - x0;
    const segdy = y1 - y0;
    const lenSq = segdx * segdx + segdy * segdy;
    if (lenSq === 0) return null;
    const t = ((ax - x0) * segdx + (ay - y0) * segdy) / lenSq;
    if (t < 0) return [x0, y0];
    if (t > 1) return [x1, y1];
    return null;
  }

  /**
   * Split the scan source into x-axis and y-axis grid lines. Called once per
   * `place()` so nearestLine_ never re-fetches or re-filters per label. Matching
   * on `gridAxis` (not screen orientation) keeps a boundary frame or the
   * perpendicular crossing from being picked for a point sitting on both.
   */
  private partitionLines_(): void {
    this.xLines_.length = 0;
    this.yLines_.length = 0;
    for (const feature of this.source_.getFeatures()) {
      const geom = feature.getGeometry();
      if (!(geom instanceof LineString)) continue;
      const axis = feature.get('gridAxis');
      if (axis === 'x') this.xLines_.push(geom);
      else if (axis === 'y') this.yLines_.push(geom);
    }
  }

  /**
   * The line in `lines` (a single axis's candidates) nearest to `(x, y)`.
   * Stops early within half a pixel of the point.
   * ponytail: O(labels × same-axis segments) per frame; index lines by bbox if a
   * grid ever ships enough lines to make this show up in a profile.
   */
  private nearestLine_(
    lines: LineString[], x: number, y: number, resolution: number,
  ): LineString | null {
    const onLineSq = (resolution * 0.5) * (resolution * 0.5);
    let best: LineString | null = null;
    let bestSq = Infinity;
    for (const geom of lines) {
      const flat = geom.getFlatCoordinates();
      const stride = geom.getStride();
      for (let i = 0; i + stride + 1 < flat.length; i += stride) {
        const dSq = distToSegmentSq(
          x, y, flat[i] ?? 0, flat[i + 1] ?? 0, flat[i + stride] ?? 0, flat[i + stride + 1] ?? 0,
        );
        if (dSq < bestSq) {
          bestSq = dSq;
          best = geom;
          if (dSq <= onLineSq) return best;
        }
      }
    }
    return best;
  }

  private labelFor_(e: DrawEntry): GridLabel {
    if (e.xOffset === 0) return e.label;
    this.reusablePoint_.setCoordinates([e.coord0 + e.xOffset, e.coord1]);
    this.reusableEdgeLabel_.point = this.reusablePoint_;
    this.reusableEdgeLabel_.text = e.label.text;
    this.reusableEdgeLabel_.axis = e.label.axis;
    return this.reusableEdgeLabel_;
  }

  private getEdgeLabelSlot_(index: number): EdgeLabelSlot {
    while (index >= this.edgeLabelPool_.length) {
      this.edgeLabelPool_.push(this.handler_.create());
    }
    const slot = this.edgeLabelPool_[index];
    return slot ?? this.handler_.create();
  }
}

/** The major grid-line colour from a line style, for the leader tick stroke. */
function majorLineColor(line: GraticuleLineStyle | undefined): string {
  const fallback = 'rgba(0, 0, 0, 0.55)';
  let stroke: Stroke | null = null;
  if (line instanceof Stroke) {
    stroke = line;
  } else if (line && typeof line === 'object' && 'major' in line && line.major instanceof Stroke) {
    stroke = line.major;
  }
  const color = stroke?.getColor();
  return typeof color === 'string' ? color : fallback;
}
