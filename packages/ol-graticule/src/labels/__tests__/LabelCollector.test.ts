import { describe, it, expect } from 'vitest';
import Point from 'ol/geom/Point';
import type { Extent } from 'ol/extent';
import type { GridLabel, GridCellLabel } from '../../types.js';
import { LabelCollector } from '../LabelCollector.js';

const EXTENT: Extent = [0, 0, 1000, 1000];

describe('LabelCollector', () => {
  it('sorts edge labels along their edge (x by easting, y by descending northing)', () => {
    const labels: GridLabel[] = [
      { point: new Point([300, 500]), text: '300', axis: 'x' },
      { point: new Point([100, 500]), text: '100', axis: 'x' },
      { point: new Point([0, 200]), text: '200', axis: 'y' },
      { point: new Point([0, 800]), text: '800', axis: 'y' },
    ];
    const collector = new LabelCollector();
    const { xBuf, xCount, yBuf, yCount } = collector.collectEdge([0], EXTENT, () => labels);

    expect(xCount).toBe(2);
    expect(yCount).toBe(2);
    expect(xBuf.slice(0, xCount).map((e) => e.label.text)).toEqual(['100', '300']);
    // Y sorts by -northing, so the highest parallel comes first.
    expect(yBuf.slice(0, yCount).map((e) => e.label.text)).toEqual(['800', '200']);
  });

  it('emits one entry per world copy, carrying the shift as xOffset with base coords', () => {
    const base: GridLabel[] = [{ point: new Point([200, 500]), text: '200', axis: 'x' }];
    const collector = new LabelCollector();
    const { xBuf, xCount } = collector.collectEdge([-600, 0, 600], EXTENT, () => base);

    expect(xCount).toBe(3);
    const entries = xBuf.slice(0, xCount);
    expect(entries.map((e) => e.xOffset).sort((a, b) => a - b)).toEqual([-600, 0, 600]);
    // sortKey is the shifted easting; coord0 stays the base-world value.
    expect(entries.map((e) => e.sortKey).sort((a, b) => a - b)).toEqual([-400, 200, 800]);
    expect(entries.every((e) => e.coord0 === 200)).toBe(true);
  });

  it('fetches each world copy with the extent shifted by its offset (identity at 0)', () => {
    const seen: Extent[] = [];
    const collector = new LabelCollector();
    collector.collectEdge([-600, 0, 600], EXTENT, (shifted) => {
      seen.push(shifted);
      return [];
    });

    expect(seen).toEqual([
      [600, 0, 1600, 1000],
      EXTENT,
      [-600, 0, 400, 1000],
    ]);
    // Offset 0 hands back the original extent, not a copy.
    expect(seen[1]).toBe(EXTENT);
  });

  it('collects cell labels across world copies', () => {
    const cells: GridCellLabel[] = [{ point: new Point([500, 500]), text: 'A', cellSizePx: 100 }];
    const collector = new LabelCollector();
    const { buf, count } = collector.collectCells([0, 600], EXTENT, () => cells);

    expect(count).toBe(2);
    expect(buf.slice(0, count).map((e) => e.xOffset).sort((a, b) => a - b)).toEqual([0, 600]);
    expect(buf.slice(0, count).every((e) => e.coord0 === 500)).toBe(true);
  });
});
