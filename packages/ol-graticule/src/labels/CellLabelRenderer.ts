import Point from 'ol/geom/Point';
import { apply as applyTransform } from 'ol/transform';
import type { LabelSink } from './LabelSink.js';
import type { GridCellLabel } from '../types.js';
import type { CellLabelSlot, CellLabelStyleHandler } from '../style.js';
import type { ScreenFrame } from './EdgeLabelPlacer.js';

// CSS px inset a clamped cell label keeps from the viewport edge.
const CELL_LABEL_MARGIN = 20;

/** A collected cell label plus its world offset and pre-shift coordinates. */
export interface CellDrawEntry {
  label: GridCellLabel;
  xOffset: number;
  coord0: number;
  coord1: number;
}

/**
 * Draws cell (letter) labels, keeping a giant cell's label on screen by clamping
 * its centroid back toward the viewport while it stays inside the cell it names.
 */
export class CellLabelRenderer {
  private readonly handler_: CellLabelStyleHandler;
  private readonly pool_: CellLabelSlot[] = [];
  private readonly pxScratch_: number[] = [0, 0];
  private readonly reusablePoint_: Point = new Point([0, 0]);
  private readonly reusableLabel_: GridCellLabel = {
    point: this.reusablePoint_, text: '', cellSizePx: 0,
  };

  constructor(handler: CellLabelStyleHandler) {
    this.handler_ = handler;
  }

  draw(
    vectorContext: LabelSink,
    screen: ScreenFrame,
    buf: CellDrawEntry[],
    count: number,
  ): void {
    const handler = this.handler_;
    for (let i = 0; i < count; i++) {
      const e = buf[i];
      if (!e) continue;
      const label = this.labelFor_(e);
      this.clamp_(label, screen);
      const slot = this.slot_(i);
      const drew = handler.update(slot, { label });
      if (!drew) continue;
      vectorContext.drawFeature(slot.feature, slot.style);
    }
  }

  /**
   * Keep a cell (letter) label visible when its centroid pans off screen, by
   * pulling it back toward the viewport, but never further than half the cell's
   * own size, so the label stays inside the cell it names. A label whose cell is
   * genuinely off screen still falls away.
   */
  private clamp_(label: GridCellLabel, screen: ScreenFrame): void {
    // Only cells bigger than the viewport can hide their centroid while still
    // filling the screen; smaller multi-cell grids keep their exact centroids.
    if (label.cellSizePx < Math.min(screen.viewW, screen.viewH)) return;
    const c = label.point.getCoordinates();
    this.pxScratch_[0] = c[0] ?? 0;
    this.pxScratch_[1] = c[1] ?? 0;
    applyTransform(screen.toPixel, this.pxScratch_);
    const sx = this.pxScratch_[0] ?? 0;
    const sy = this.pxScratch_[1] ?? 0;
    const m = CELL_LABEL_MARGIN;
    const targetX = Math.min(Math.max(sx, m), screen.viewW - m);
    const targetY = Math.min(Math.max(sy, m), screen.viewH - m);
    if (targetX === sx && targetY === sy) return;
    const bound = Math.max(0, label.cellSizePx / 2 - m);
    const nx = sx + Math.min(Math.max(targetX - sx, -bound), bound);
    const ny = sy + Math.min(Math.max(targetY - sy, -bound), bound);
    this.pxScratch_[0] = nx;
    this.pxScratch_[1] = ny;
    applyTransform(screen.fromPixel, this.pxScratch_);
    this.reusablePoint_.setCoordinates([this.pxScratch_[0] ?? 0, this.pxScratch_[1] ?? 0]);
    label.point = this.reusablePoint_;
  }

  // Always returns the reusable wrapper, never the caller's own label, so
  // clamp_ can rebind `.point` without mutating the grid system's object.
  private labelFor_(e: CellDrawEntry): GridCellLabel {
    const label = this.reusableLabel_;
    label.text = e.label.text;
    label.cellSizePx = e.label.cellSizePx;
    if (e.xOffset === 0) {
      label.point = e.label.point;
    } else {
      this.reusablePoint_.setCoordinates([e.coord0 + e.xOffset, e.coord1]);
      label.point = this.reusablePoint_;
    }
    return label;
  }

  private slot_(index: number): CellLabelSlot {
    while (index >= this.pool_.length) {
      this.pool_.push(this.handler_.create());
    }
    const slot = this.pool_[index];
    return slot ?? this.handler_.create();
  }
}
