import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Text from 'ol/style/Text';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import type { Geometry } from 'ol/geom';
import type { Transform } from 'ol/transform';
import type VectorContext from 'ol/render/VectorContext';
import type { GridCellLabel } from '../../types.js';
import type { CellLabelStyleHandler } from '../../style.js';
import { CellLabelRenderer, type CellDrawEntry } from '../CellLabelRenderer.js';
import type { ScreenFrame } from '../EdgeLabelPlacer.js';

/** What the renderer drew, snapshotted at `drawFeature` time (coords, not refs). */
interface Drawn {
  feature: Feature<Geometry>;
  coords: [number, number] | null;
}

/**
 * A recording VectorContext. Coordinates are read at call time because the
 * renderer draws through a single reused Point, so its coords would be stale if
 * read after the loop.
 */
function recordingContext(): { ctx: VectorContext; drawn: Drawn[] } {
  const drawn: Drawn[] = [];
  const noop = (): void => undefined;
  const drawFeature = (feature: Feature<Geometry>): void => {
    const geom = feature.getGeometry();
    const coords = geom instanceof Point ? geom.getCoordinates() : null;
    drawn.push({ feature, coords: coords ? [coords[0] ?? 0, coords[1] ?? 0] : null });
  };
  const ctx: VectorContext = {
    drawCustom: noop, drawGeometry: noop, setStyle: noop, drawCircle: noop,
    drawFeature, drawGeometryCollection: noop, drawLineString: noop,
    drawMultiLineString: noop, drawMultiPoint: noop, drawMultiPolygon: noop,
    drawPoint: noop, drawPolygon: noop, drawText: noop, setFillStrokeStyle: noop,
    setImageStyle: noop, setTextStyle: noop,
  };
  return { ctx, drawn };
}

/**
 * A minimal always-draw handler mirroring the custom handlers (GSGS/MBS letter
 * grids) that actually render giant cells; the default handler fades those out
 * before the clamp path is ever reached. Draws the label's own point verbatim.
 */
function alwaysDrawHandler(): CellLabelStyleHandler {
  return {
    create() {
      const text = new Text({});
      const fill = new Fill({});
      const stroke = new Stroke({});
      return { feature: new Feature(), text, fill, stroke, style: new Style({ text }) };
    },
    update(slot, { label }) {
      slot.text.setText(label.text);
      slot.feature.setGeometry(label.point);
      return true;
    },
  };
}

/** Self-inverse screen: px = [mx, 1000 - my], 1000×1000 viewport. */
function screen1000(): ScreenFrame {
  const t: Transform = [1, 0, 0, -1, 0, 1000];
  return { toPixel: t, fromPixel: t, viewW: 1000, viewH: 1000 };
}

function entry(label: GridCellLabel, xOffset = 0): CellDrawEntry {
  const c = label.point.getCoordinates();
  return { label, xOffset, coord0: c[0] ?? 0, coord1: c[1] ?? 0 };
}

function draw(entries: CellDrawEntry[]): Drawn[] {
  const renderer = new CellLabelRenderer(alwaysDrawHandler());
  const { ctx, drawn } = recordingContext();
  renderer.draw(ctx, screen1000(), entries, entries.length);
  return drawn;
}

describe('CellLabelRenderer', () => {
  it('draws a small cell label at its exact centroid (no clamp)', () => {
    const label: GridCellLabel = { point: new Point([300, 700]), text: 'A', cellSizePx: 100 };
    const drawn = draw([entry(label)]);

    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.coords).toEqual([300, 700]);
  });

  it('pulls a giant cell label back inside the viewport when its centroid pans off screen', () => {
    // Centroid at px (500, -200) — 200px above the top edge. Clamp target is the
    // 20px top margin → px (500, 20) → map (500, 980).
    const label: GridCellLabel = { point: new Point([500, 1200]), text: 'A', cellSizePx: 5000 };
    const drawn = draw([entry(label)]);

    expect(drawn[0]?.coords?.[0]).toBeCloseTo(500);
    expect(drawn[0]?.coords?.[1]).toBeCloseTo(980);
  });

  it('does not touch the input label when clamping (regression: clamp rebound the caller point)', () => {
    const point = new Point([500, 1200]);
    const label: GridCellLabel = { point, text: 'A', cellSizePx: 5000 };
    draw([entry(label)]);

    // The renderer must never rebind or move the grid system's own objects.
    expect(label.point).toBe(point);
    expect(label.point.getCoordinates()).toEqual([500, 1200]);
  });

  it('caps the pull at half the cell size, so the label never leaves the cell it names', () => {
    // Centroid at px (500, -2000); half-cell bound is 1200/2 - 20 = 580, so the
    // label rises only to px (500, -1420) → map (500, 2420) and stays off screen.
    const label: GridCellLabel = { point: new Point([500, 3000]), text: 'A', cellSizePx: 1200 };
    const drawn = draw([entry(label)]);

    expect(drawn[0]?.coords?.[0]).toBeCloseTo(500);
    expect(drawn[0]?.coords?.[1]).toBeCloseTo(2420);
  });

  it('shifts a world-copy label by its xOffset without mutating the base label', () => {
    const point = new Point([500, 500]);
    const label: GridCellLabel = { point, text: 'A', cellSizePx: 100 };
    const drawn = draw([entry(label, 600)]);

    expect(drawn[0]?.coords).toEqual([1100, 500]);
    expect(label.point).toBe(point);
    expect(label.point.getCoordinates()).toEqual([500, 500]);
  });

  it('hands a distinct pooled slot to each drawn label (regression: shared-slot pooling)', () => {
    const drawn = draw([
      entry({ point: new Point([100, 100]), text: 'A', cellSizePx: 100 }),
      entry({ point: new Point([200, 200]), text: 'B', cellSizePx: 100 }),
      entry({ point: new Point([300, 300]), text: 'C', cellSizePx: 100 }),
    ]);

    expect(drawn).toHaveLength(3);
    const features = drawn.map((d) => d.feature);
    expect(new Set(features).size).toBe(3);
  });
});
