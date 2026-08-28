import type Point from 'ol/geom/Point';
import type { Extent } from 'ol/extent';
import type { GridLabel, GridCellLabel } from '../types.js';
import type { DrawEntry } from './EdgeLabelPlacer.js';
import type { CellDrawEntry } from './CellLabelRenderer.js';

/**
 * Turns a grid system's `getLabels`/`getCellLabels` output across the visible
 * world copies into sorted, reused draw buffers. Buffers persist between frames
 * so the hot postrender path allocates nothing.
 */
export class LabelCollector {
  private readonly xBuf_: DrawEntry[] = [];
  private readonly yBuf_: DrawEntry[] = [];
  private readonly cellBuf_: CellDrawEntry[] = [];

  /**
   * Collect edge labels for each world offset into the x/y buffers, sorted along
   * their edge (x by easting, y by descending northing). The label point's x is
   * shifted into its world copy so off-screen copies can be culled downstream.
   */
  collectEdge(
    worldOffsets: number[],
    extent: Extent,
    fetch: (shiftedExtent: Extent) => GridLabel[],
  ): { xBuf: DrawEntry[]; xCount: number; yBuf: DrawEntry[]; yCount: number } {
    const xBuf = this.xBuf_;
    const yBuf = this.yBuf_;
    let xCount = 0;
    let yCount = 0;

    eachWorldItem(worldOffsets, extent, fetch, (item, offset, c0, c1) => {
      if (item.axis === 'x') {
        pushDrawEntry(xBuf, xCount++, item, c0 + offset, offset, c0, c1);
      } else {
        pushDrawEntry(yBuf, yCount++, item, -c1, offset, c0, c1);
      }
    });
    sortPrefix(xBuf, xCount);
    sortPrefix(yBuf, yCount);
    return { xBuf, xCount, yBuf, yCount };
  }

  collectCells(
    worldOffsets: number[],
    extent: Extent,
    fetch: (shiftedExtent: Extent) => GridCellLabel[],
  ): { buf: CellDrawEntry[]; count: number } {
    const buf = this.cellBuf_;
    let count = 0;
    eachWorldItem(worldOffsets, extent, fetch, (item, offset, c0, c1) => {
      pushCellEntry(buf, count++, item, offset, c0, c1);
    });
    return { buf, count };
  }
}

/** The extent shifted into a world copy `offset` map units away (identity at 0). */
function shiftExtent(extent: Extent, offset: number): Extent {
  return offset === 0
    ? extent
    : [extent[0] - offset, extent[1], extent[2] - offset, extent[3]];
}

/** Call `cb` for each item across every visible world copy, with its base coords. */
function eachWorldItem<T extends { point: Point }>(
  worldOffsets: number[],
  extent: Extent,
  fetch: (shiftedExtent: Extent) => T[],
  cb: (item: T, offset: number, c0: number, c1: number) => void,
): void {
  for (const offset of worldOffsets) {
    const items = fetch(shiftExtent(extent, offset));
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const coords = item.point.getFlatCoordinates();
      cb(item, offset, coords[0] ?? 0, coords[1] ?? 0);
    }
  }
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

/** Insertion sort of the first `count` entries by `sortKey` (stable, in place). */
function sortPrefix(buf: DrawEntry[], count: number): void {
  if (count <= 1) return;
  for (let i = 1; i < count; i++) {
    const cur = buf[i];
    const key = cur.sortKey;
    let j = i - 1;
    while (j >= 0 && buf[j].sortKey > key) {
      buf[j + 1] = buf[j];
      j--;
    }
    buf[j + 1] = cur;
  }
}
