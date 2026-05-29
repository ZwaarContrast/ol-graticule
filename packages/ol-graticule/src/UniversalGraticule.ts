import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Point from 'ol/geom/Point';
import { getVectorContext } from 'ol/render';
import { unByKey } from 'ol/Observable';
import { approximatelyEquals } from 'ol/extent';
import { get as getProjection } from 'ol/proj';
import { getFontParameters } from 'ol/css';
import type { Options as VectorLayerOptions } from 'ol/layer/Vector';
import type RenderEvent from 'ol/render/Event';
import type { Extent } from 'ol/extent';
import type { EventsKey } from 'ol/events';
import type { ProjectionLike } from 'ol/proj';
import type { GridSystem, GridLabel, GridCellLabel } from './types.js';
import {
  createDefaultCellLabelHandler,
  resolveEdgeLabelHandler,
  resolveLineStyle,
  type CellLabelSlot,
  type CellLabelStyleHandler,
  type EdgeLabelContext,
  type EdgeLabelSlot,
  type EdgeLabelStyleHandler,
  type GraticuleStyle,
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
    const needed = wantsEdge || wantsCells;
    if (needed && !this.postrenderKey_) {
      this.postrenderKey_ = this.on('postrender', (event) => this.handlePostrender_(event));
    } else if (!needed && this.postrenderKey_) {
      unByKey(this.postrenderKey_);
      this.postrenderKey_ = null;
    }
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
    super.disposeInternal();
  }
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
