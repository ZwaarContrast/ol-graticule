import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';
import Point from 'ol/geom/Point';
import {
  DEFAULT_LINE_STROKE,
  DEFAULT_MINOR_LINE_STROKE,
  DEFAULT_LINE_STYLE,
  createDefaultEdgeLabelText,
  createDefaultEdgeLabelHandler,
  createDefaultCellLabelHandler,
  resolveLineStyle,
} from '../style.js';
import type { EdgeLabelContext, CellLabelContext } from '../style.js';

describe('default constants', () => {
  it('major and minor stroke instances are wired into DEFAULT_LINE_STYLE by reference', () => {
    expect(DEFAULT_LINE_STROKE).toBeInstanceOf(Stroke);
    expect(DEFAULT_MINOR_LINE_STROKE).toBeInstanceOf(Stroke);
    expect(DEFAULT_LINE_STYLE.major).toBe(DEFAULT_LINE_STROKE);
    expect(DEFAULT_LINE_STYLE.minor).toBe(DEFAULT_MINOR_LINE_STROKE);
  });

  it('major stroke is wider than minor stroke', () => {
    const majorW = DEFAULT_LINE_STROKE.getWidth();
    const minorW = DEFAULT_MINOR_LINE_STROKE.getWidth();
    expect(majorW).toBeDefined();
    expect(minorW).toBeDefined();
    if (majorW !== undefined && minorW !== undefined) {
      expect(majorW).toBeGreaterThan(minorW);
    }
  });
});

describe('createDefaultEdgeLabelText', () => {
  it('returns a Text with fill and stroke configured', () => {
    const t = createDefaultEdgeLabelText();
    expect(t).toBeInstanceOf(Text);
    expect(t.getFill()).not.toBeNull();
    expect(t.getStroke()).not.toBeNull();
  });
});

describe('createDefaultEdgeLabelHandler', () => {
  it('create returns a slot with feature + text + style', () => {
    const h = createDefaultEdgeLabelHandler();
    const slot = h.create();
    expect(slot.feature).toBeInstanceOf(Feature);
    expect(slot.style).toBeInstanceOf(Style);
    expect(slot.text).toBeInstanceOf(Text);
  });

  it('places an x-axis label at the top edge when xLabelPosition=top', () => {
    const h = createDefaultEdgeLabelHandler();
    const slot = h.create();
    const ctx: EdgeLabelContext = {
      label: { axis: 'x', text: '12', point: new Point([7, 999]) },
      extent: [0, 0, 100, 50],
      resolution: 1,
      xLabelPosition: 'top',
      yLabelPosition: 'left',
      xLabelOffset: 4,
      yLabelOffset: 4,
    };
    expect(h.update(slot, ctx)).toBe(true);
    const geom = slot.feature.getGeometry();
    expect(geom).toBeInstanceOf(Point);
    if (geom instanceof Point) {
      expect(geom.getCoordinates()).toEqual([7, 50]);
    }
    expect(slot.text.getTextBaseline()).toBe('top');
    expect(slot.text.getTextAlign()).toBe('center');
    expect(slot.text.getOffsetY()).toBe(4);
  });

  it('places a y-axis label at the right edge when yLabelPosition=right', () => {
    const h = createDefaultEdgeLabelHandler();
    const slot = h.create();
    const ctx: EdgeLabelContext = {
      label: { axis: 'y', text: 'N', point: new Point([999, 25]) },
      extent: [0, 0, 100, 50],
      resolution: 1,
      xLabelPosition: 'top',
      yLabelPosition: 'right',
      xLabelOffset: 4,
      yLabelOffset: 4,
    };
    expect(h.update(slot, ctx)).toBe(true);
    const geom = slot.feature.getGeometry();
    if (geom instanceof Point) {
      expect(geom.getCoordinates()).toEqual([100, 25]);
    }
    expect(slot.text.getTextAlign()).toBe('right');
    expect(slot.text.getOffsetX()).toBe(-4);
  });

  it('returns false when the slot geometry is not a Point', () => {
    const h = createDefaultEdgeLabelHandler();
    const slot = h.create();
    slot.feature.setGeometry(undefined);
    const ctx: EdgeLabelContext = {
      label: { axis: 'x', text: '1', point: new Point([0, 0]) },
      extent: [0, 0, 1, 1],
      resolution: 1,
      xLabelPosition: 'top',
      yLabelPosition: 'left',
      xLabelOffset: 0,
      yLabelOffset: 0,
    };
    expect(h.update(slot, ctx)).toBe(false);
  });
});

describe('createDefaultCellLabelHandler', () => {
  it('skips render when the cell is too small to fade in', () => {
    const h = createDefaultCellLabelHandler();
    const slot = h.create();
    const ctx: CellLabelContext = {
      label: { text: 'AA', point: new Point([0, 0]), cellSizePx: 10 },
    };
    expect(h.update(slot, ctx)).toBe(false);
  });

  it('renders the label text and scales font with cell size in the full band', () => {
    const h = createDefaultCellLabelHandler();
    const slot = h.create();
    const small: CellLabelContext = {
      label: { text: 'AA', point: new Point([0, 0]), cellSizePx: 120 },
    };
    const big: CellLabelContext = {
      label: { text: 'AA', point: new Point([0, 0]), cellSizePx: 360 },
    };
    expect(h.update(slot, small)).toBe(true);
    expect(slot.text.getText()).toBe('AA');
    const smallFont = slot.text.getFont() ?? '';
    expect(h.update(slot, big)).toBe(true);
    const bigFont = slot.text.getFont() ?? '';
    const smallPx = Number(smallFont.match(/(\d+)px/)?.[1]);
    const bigPx = Number(bigFont.match(/(\d+)px/)?.[1]);
    expect(Number.isFinite(smallPx)).toBe(true);
    expect(Number.isFinite(bigPx)).toBe(true);
    expect(bigPx).toBeGreaterThan(smallPx);
  });

  it('skips render when the cell exceeds fadeOutEnd', () => {
    const h = createDefaultCellLabelHandler();
    const slot = h.create();
    const ctx: CellLabelContext = {
      label: { text: 'AA', point: new Point([0, 0]), cellSizePx: 10_000 },
    };
    expect(h.update(slot, ctx)).toBe(false);
  });

  it('respects custom fadeStops range', () => {
    const h = createDefaultCellLabelHandler({ fadeStops: [0, 1, 50, 60] });
    const slot = h.create();
    const ctx: CellLabelContext = {
      label: { text: 'X', point: new Point([0, 0]), cellSizePx: 25 },
    };
    expect(h.update(slot, ctx)).toBe(true);
  });
});

function callStyleFn(
  resolved: ReturnType<typeof resolveLineStyle>,
  feature: Feature,
): Style {
  if (typeof resolved !== 'function') {
    throw new Error('expected resolveLineStyle to return a function');
  }
  const result = resolved(feature, 1);
  if (result instanceof Style) return result;
  if (Array.isArray(result) && result[0] instanceof Style) return result[0];
  throw new Error('expected the resolved function to produce a Style');
}

describe('resolveLineStyle', () => {
  it('wraps a single Stroke in a Style whose stroke is that exact instance', () => {
    const stroke = new Stroke({ color: 'red', width: 1 });
    const resolved = resolveLineStyle(stroke);
    expect(resolved).toBeInstanceOf(Style);
    if (resolved instanceof Style) {
      expect(resolved.getStroke()).toBe(stroke);
    }
  });

  it('returns a function for { major, minor } that picks minor by gridLineType', () => {
    const major = new Stroke({ color: 'red', width: 2 });
    const minor = new Stroke({ color: 'blue', width: 1 });
    const resolved = resolveLineStyle({ major, minor });
    const feat = new Feature();
    feat.set('gridLineType', 'minor');
    expect(callStyleFn(resolved, feat).getStroke()).toBe(minor);
  });

  it('uses major when gridLineType is undefined or unknown', () => {
    const major = new Stroke({ color: 'red', width: 2 });
    const minor = new Stroke({ color: 'blue', width: 1 });
    const resolved = resolveLineStyle({ major, minor });
    const unset = new Feature();
    expect(callStyleFn(resolved, unset).getStroke()).toBe(major);
    const garbled = new Feature();
    garbled.set('gridLineType', 'something-not-known');
    expect(callStyleFn(resolved, garbled).getStroke()).toBe(major);
  });

  it('uses the boundary stroke when gridLineType is "boundary"', () => {
    const major = new Stroke({ color: 'red', width: 2 });
    const minor = new Stroke({ color: 'blue', width: 1 });
    const boundary = new Stroke({ color: 'green', width: 3 });
    const resolved = resolveLineStyle({ major, minor, boundary });
    const feat = new Feature();
    feat.set('gridLineType', 'boundary');
    expect(callStyleFn(resolved, feat).getStroke()).toBe(boundary);
  });

  it('falls back to major for boundary when no boundary stroke was supplied', () => {
    const major = new Stroke({ color: 'red', width: 2 });
    const minor = new Stroke({ color: 'blue', width: 1 });
    const resolved = resolveLineStyle({ major, minor });
    const feat = new Feature();
    feat.set('gridLineType', 'boundary');
    expect(callStyleFn(resolved, feat).getStroke()).toBe(major);
  });

  it('falls back to DEFAULT_LINE_STYLE strokes when input is undefined', () => {
    const resolved = resolveLineStyle(undefined);
    const majorFeat = new Feature();
    const minorFeat = new Feature();
    minorFeat.set('gridLineType', 'minor');
    expect(callStyleFn(resolved, majorFeat).getStroke()).toBe(DEFAULT_LINE_STROKE);
    expect(callStyleFn(resolved, minorFeat).getStroke()).toBe(DEFAULT_MINOR_LINE_STROKE);
  });
});
