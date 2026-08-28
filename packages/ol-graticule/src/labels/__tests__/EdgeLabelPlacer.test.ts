import { describe, it, expect, vi } from 'vitest';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import VectorSource from 'ol/source/Vector';
import type Style from 'ol/style/Style';
import type { Geometry } from 'ol/geom';
import type { Extent } from 'ol/extent';
import type { Transform } from 'ol/transform';
import type VectorContext from 'ol/render/VectorContext';
import { resolveEdgeLabelHandler } from '../../style.js';
import {
  EdgeLabelPlacer,
  type DrawEntry,
  type EdgeLabelConfig,
  type EdgeLabelFrame,
  type ScreenFrame,
} from '../EdgeLabelPlacer.js';

type DrawCall = { feature: Feature<Geometry>; style: Style };

/** A no-op VectorContext that records only `drawFeature`. */
function makeVectorContext(drawFeature: ReturnType<typeof vi.fn>): VectorContext {
  const noop = (): void => undefined;
  return {
    drawCustom: noop, drawGeometry: noop, setStyle: noop, drawCircle: noop,
    drawFeature, drawGeometryCollection: noop, drawLineString: noop,
    drawMultiLineString: noop, drawMultiPoint: noop, drawMultiPolygon: noop,
    drawPoint: noop, drawPolygon: noop, drawText: noop, setFillStrokeStyle: noop,
    setImageStyle: noop, setTextStyle: noop,
  };
}

/** The Point geometry of a drawn label, guarded (no cast). */
function pointOf(feature: Feature<Geometry>): Point {
  const geom = feature.getGeometry();
  if (!(geom instanceof Point)) throw new Error('expected a Point label geometry');
  return geom;
}

/** A straight grid line spanning the extent, tagged so `nearestLine_` finds it. */
function gridLineFeature(axis: 'x' | 'y', at: number): Feature<Geometry> {
  const geom = axis === 'x'
    ? new LineString([[at, 0], [at, 1000]])
    : new LineString([[0, at], [1000, at]]);
  const feature = new Feature(geom);
  feature.set('gridAxis', axis);
  return feature;
}

/**
 * A north-up frame + screen for extent [0,0,1000,1000] in a 1000×1000 viewport
 * (px = [mx, 1000 - my], self-inverse). `worldWidth` > 0 enables wrap.
 */
function northUpFrame(worldWidth: number): EdgeLabelFrame {
  return {
    cx: 500, cy: 500, cos: 1, sin: 0,
    rotExtent: [0, 0, 1000, 1000],
    edgeTarget: [1000, 0, 0, 1000], // TOP maxY, BOTTOM minY, LEFT minX, RIGHT maxX
    edgeSpanLo: [0, 0, 0, 0],
    edgeSpanHi: [1000, 1000, 1000, 1000],
    worldWidth,
  };
}

function northUpScreen(): ScreenFrame {
  const t: Transform = [1, 0, 0, -1, 0, 1000];
  return { toPixel: t, fromPixel: t, viewW: 1000, viewH: 1000 };
}

function makeConfig(options: Partial<EdgeLabelConfig>): EdgeLabelConfig {
  return {
    xLabelPosition: options.xLabelPosition ?? 'top',
    yLabelPosition: options.yLabelPosition ?? 'left',
    xLabelOffset: options.xLabelOffset ?? 2,
    yLabelOffset: options.yLabelOffset ?? 2,
    edgeLabelCoverage: options.edgeLabelCoverage ?? 'all',
    edgeLabelLeader: options.edgeLabelLeader ?? 'none',
    edgeLabelExtend: options.edgeLabelExtend ?? 'line',
  };
}

function makePlacer(source: VectorSource, config: EdgeLabelConfig): EdgeLabelPlacer {
  const handler = resolveEdgeLabelHandler(true);
  if (!handler) throw new Error('expected a default edge label handler');
  return new EdgeLabelPlacer(config, handler, source, undefined);
}

/** Draw entry buffers in the sorted order `collectEdgeLabels_` would produce. */
function buffersFor(
  labels: Array<{ x: number; y: number; text: string; axis: 'x' | 'y' }>,
): { xBuf: DrawEntry[]; yBuf: DrawEntry[] } {
  const xBuf: DrawEntry[] = [];
  const yBuf: DrawEntry[] = [];
  for (const l of labels) {
    const entry: DrawEntry = {
      label: { point: new Point([l.x, l.y]), text: l.text, axis: l.axis },
      sortKey: l.axis === 'x' ? l.x : -l.y,
      xOffset: 0,
      coord0: l.x,
      coord1: l.y,
    };
    (l.axis === 'x' ? xBuf : yBuf).push(entry);
  }
  xBuf.sort((a, b) => a.sortKey - b.sortKey);
  yBuf.sort((a, b) => a.sortKey - b.sortKey);
  return { xBuf, yBuf };
}

function place(
  labels: Array<{ x: number; y: number; text: string; axis: 'x' | 'y' }>,
  options: Partial<EdgeLabelConfig> = {},
): { drawFeature: ReturnType<typeof vi.fn> } {
  const source = new VectorSource({ useSpatialIndex: false });
  const seen = new Set<string>();
  for (const l of labels) {
    const at = l.axis === 'x' ? l.x : l.y;
    const key = `${l.axis}:${at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    source.addFeature(gridLineFeature(l.axis, at));
  }
  const placer = makePlacer(source, makeConfig(options));
  const { xBuf, yBuf } = buffersFor(labels);
  const drawFeature = vi.fn();
  const extent: Extent = [0, 0, 1000, 1000];
  placer.place(
    makeVectorContext(drawFeature), northUpFrame(0), northUpScreen(), extent, 1,
    xBuf, xBuf.length, yBuf, yBuf.length,
  );
  return { drawFeature };
}

function drawCalls(drawFeature: ReturnType<typeof vi.fn>): DrawCall[] {
  return drawFeature.mock.calls.map((args) => {
    const feature: Feature<Geometry> = args[0];
    const style: Style = args[1];
    return { feature, style };
  });
}

describe('EdgeLabelPlacer', () => {
  it('calls drawFeature exactly once per non-culled label (regression: labels silently dropped)', () => {
    const { drawFeature } = place([
      { x: 100, y: 500, text: '100', axis: 'x' },
      { x: 300, y: 500, text: '300', axis: 'x' },
      { x: 500, y: 500, text: '500', axis: 'x' },
      { x: 0, y: 200, text: '200', axis: 'y' },
      { x: 0, y: 500, text: '500y', axis: 'y' },
      { x: 0, y: 800, text: '800', axis: 'y' },
    ]);

    expect(drawFeature).toHaveBeenCalledTimes(6);
  });

  it('draws all Y labels, not just the first (regression: sort+cull direction bug)', () => {
    const { drawFeature } = place([
      { x: 0, y: 100, text: '100', axis: 'y' },
      { x: 0, y: 300, text: '300', axis: 'y' },
      { x: 0, y: 500, text: '500', axis: 'y' },
      { x: 0, y: 700, text: '700', axis: 'y' },
      { x: 0, y: 900, text: '900', axis: 'y' },
    ]);

    const calls = drawCalls(drawFeature);
    const texts = calls.map((c) => c.style.getText()?.getText()).sort();
    expect(texts).toEqual(['100', '300', '500', '700', '900']);
  });

  it('hands a DISTINCT Text instance to each drawFeature call (regression: shared-Text pooling bug)', () => {
    const { drawFeature } = place([
      { x: 100, y: 500, text: '100', axis: 'x' },
      { x: 300, y: 500, text: '300', axis: 'x' },
      { x: 0, y: 200, text: '200y', axis: 'y' },
      { x: 0, y: 800, text: '800y', axis: 'y' },
    ]);

    const calls = drawCalls(drawFeature);
    const textInstances = new Set(calls.map((c) => c.style.getText()));
    expect(textInstances.size).toBe(calls.length);
  });

  it('shifts on-screen world-wrap copies into place and culls off-screen ones', () => {
    // wrapX with a 600-wide world; base line at x=200. Copies land at -400
    // (off screen), 200, and 800. The two on-screen ones draw at their
    // shifted x, the off-screen one is culled.
    const worldWidth = 600;
    const source = new VectorSource({ useSpatialIndex: false });
    source.addFeature(gridLineFeature('x', 200));
    const placer = makePlacer(source, makeConfig({}));

    const base = { point: new Point([200, 500]), text: '200', axis: 'x' as const };
    const xBuf: DrawEntry[] = [-worldWidth, 0, worldWidth].map((xOffset) => ({
      label: { point: new Point([200 + xOffset, 500]), text: base.text, axis: base.axis },
      sortKey: 200 + xOffset,
      xOffset,
      coord0: 200,
      coord1: 500,
    }));

    const drawFeature = vi.fn();
    const extent: Extent = [0, 0, 1000, 1000];
    placer.place(
      makeVectorContext(drawFeature), northUpFrame(worldWidth), northUpScreen(), extent, 1,
      xBuf, xBuf.length, [], 0,
    );

    const xs = drawCalls(drawFeature).map((c) => pointOf(c.feature).getCoordinates()[0]);
    expect(xs.length).toBe(2);
    expect(new Set(xs).size).toBe(2);
    expect(xs).toContain(200);
    expect(xs).toContain(200 + worldWidth);
  });

  it('preserves per-label text content on each drawFeature call', () => {
    const { drawFeature } = place([
      { x: 100, y: 500, text: 'X1', axis: 'x' },
      { x: 300, y: 500, text: 'X2', axis: 'x' },
      { x: 0, y: 200, text: 'Y1', axis: 'y' },
      { x: 0, y: 800, text: 'Y2', axis: 'y' },
    ]);

    const calls = drawCalls(drawFeature);
    const byText = calls.map((c) => c.style.getText()?.getText());
    expect(byText).toContain('X1');
    expect(byText).toContain('X2');
    expect(byText).toContain('Y1');
    expect(byText).toContain('Y2');
  });

  it('positions X-axis labels at the top edge with center alignment (default)', () => {
    const { drawFeature } = place([
      { x: 200, y: 500, text: 'top', axis: 'x' },
    ]);

    const [call] = drawCalls(drawFeature);
    const geom = call ? pointOf(call.feature) : undefined;
    const [gx, gy] = geom ? geom.getCoordinates() : [NaN, NaN];
    const text = call?.style.getText();

    // X labels snap to viewport maxY (=1000 from fixture), preserving X
    expect(gx).toBe(200);
    expect(gy).toBe(1000);
    expect(text?.getTextAlign()).toBe('center');
    expect(text?.getTextBaseline()).toBe('top');
  });

  it('positions Y-axis labels at the left edge with left alignment (default)', () => {
    const { drawFeature } = place([
      { x: 999, y: 400, text: 'left', axis: 'y' },
    ]);

    const [call] = drawCalls(drawFeature);
    const geom = call ? pointOf(call.feature) : undefined;
    const [gx, gy] = geom ? geom.getCoordinates() : [NaN, NaN];
    const text = call?.style.getText();

    // Y labels snap to viewport minX (=0 from fixture), preserving Y
    expect(gx).toBe(0);
    expect(gy).toBe(400);
    expect(text?.getTextAlign()).toBe('left');
    expect(text?.getTextBaseline()).toBe('middle');
  });

  it('flips X labels to bottom edge when xLabelPosition="bottom"', () => {
    const { drawFeature } = place(
      [{ x: 200, y: 500, text: 'x', axis: 'x' }],
      { xLabelPosition: 'bottom' },
    );

    const [call] = drawCalls(drawFeature);
    const geom = call ? pointOf(call.feature) : undefined;
    const gy = geom ? geom.getCoordinates()[1] : NaN;
    expect(gy).toBe(0); // minY of fixture extent
    expect(call?.style.getText()?.getTextBaseline()).toBe('bottom');
  });

  it('flips Y labels to right edge when yLabelPosition="right"', () => {
    const { drawFeature } = place(
      [{ x: 500, y: 400, text: 'y', axis: 'y' }],
      { yLabelPosition: 'right' },
    );

    const [call] = drawCalls(drawFeature);
    const geom = call ? pointOf(call.feature) : undefined;
    const gx = geom ? geom.getCoordinates()[0] : NaN;
    expect(gx).toBe(1000); // maxX of fixture extent
    expect(call?.style.getText()?.getTextAlign()).toBe('right');
  });

  it('culls overlapping Y labels when they fall within minYGap pixels', () => {
    // minYGap = fontSize + 4 = 10 + 4 = 14px at resolution 1
    // Labels spaced 5 units apart (=5px) should mostly be culled;
    // labels spaced 100 units apart should not.
    const { drawFeature: tight } = place([
      { x: 0, y: 500, text: 'a', axis: 'y' },
      { x: 0, y: 505, text: 'b', axis: 'y' },
      { x: 0, y: 510, text: 'c', axis: 'y' },
    ]);
    const { drawFeature: spaced } = place([
      { x: 0, y: 100, text: 'a', axis: 'y' },
      { x: 0, y: 300, text: 'b', axis: 'y' },
      { x: 0, y: 500, text: 'c', axis: 'y' },
    ]);

    expect(tight.mock.calls.length).toBeLessThan(3);
    expect(spaced.mock.calls.length).toBe(3);
  });

  it('culls overlapping X labels whose text boxes collide on the edge', () => {
    // Per-edge collision uses each label's text width, so 1-char labels a few
    // pixels apart overlap and cull; 200 px apart they don't.
    const { drawFeature: tight } = place([
      { x: 100, y: 500, text: 'a', axis: 'x' },
      { x: 104, y: 500, text: 'b', axis: 'x' },
      { x: 108, y: 500, text: 'c', axis: 'x' },
    ]);
    const { drawFeature: spaced } = place([
      { x: 100, y: 500, text: 'a', axis: 'x' },
      { x: 300, y: 500, text: 'b', axis: 'x' },
      { x: 500, y: 500, text: 'c', axis: 'x' },
    ]);

    expect(tight.mock.calls.length).toBeLessThan(3);
    expect(spaced.mock.calls.length).toBe(3);
  });
});

describe('EdgeLabelPlacer axis mode (edgeLabelExtend: "axis")', () => {
  // The shared gridLineFeature spans exactly the viewport, so it can never cross
  // an edge; axis mode needs lines that over/undershoot, built explicitly here.
  function placeAxis(
    features: Array<{ axis: 'x' | 'y'; coords: [number, number][] }>,
    labels: Array<{ x: number; y: number; text: string; axis: 'x' | 'y' }>,
    options: Partial<EdgeLabelConfig> = {},
  ): DrawCall[] {
    const source = new VectorSource({ useSpatialIndex: false });
    for (const f of features) {
      const feature = new Feature(new LineString(f.coords));
      feature.set('gridAxis', f.axis);
      source.addFeature(feature);
    }
    const placer = makePlacer(source, makeConfig({ edgeLabelExtend: 'axis', ...options }));
    const { xBuf, yBuf } = buffersFor(labels);
    const drawFeature = vi.fn();
    placer.place(
      makeVectorContext(drawFeature), northUpFrame(0), northUpScreen(), [0, 0, 1000, 1000], 1,
      xBuf, xBuf.length, yBuf, yBuf.length,
    );
    return drawCalls(drawFeature);
  }

  /** The lone draw call, asserting exactly one. */
  function only(calls: DrawCall[]): DrawCall {
    expect(calls).toHaveLength(1);
    const [call] = calls;
    if (!call) throw new Error('expected exactly one draw call');
    return call;
  }

  /** Screen px of a drawn label under northUpScreen (px = [mx, 1000 - my]). */
  function drawnScreen(call: DrawCall): [number, number] {
    const [mx, my] = pointOf(call.feature).getCoordinates();
    return [mx, 1000 - my];
  }

  it('rides the top edge at a meridian for an x-axis label', () => {
    const [sx, sy] = drawnScreen(only(placeAxis(
      [{ axis: 'x', coords: [[300, -100], [300, 1100]] }],
      [{ x: 300, y: 500, text: '300', axis: 'x' }],
    )));
    expect(sx).toBeCloseTo(300);
    expect(sy).toBeCloseTo(0);
  });

  it('interpolates the top-edge crossing for a tilted x-axis line', () => {
    // Diagonal meridian (200,-500)->(400,1500) crosses screen y=0 at x=350.
    const [sx, sy] = drawnScreen(only(placeAxis(
      [{ axis: 'x', coords: [[200, -500], [400, 1500]] }],
      [{ x: 300, y: 500, text: '300', axis: 'x' }],
    )));
    expect(sx).toBeCloseTo(350);
    expect(sy).toBeCloseTo(0);
  });

  it('rides the bottom edge when xLabelPosition is "bottom"', () => {
    const [sx, sy] = drawnScreen(only(placeAxis(
      [{ axis: 'x', coords: [[300, -100], [300, 1100]] }],
      [{ x: 300, y: 500, text: '300', axis: 'x' }],
      { xLabelPosition: 'bottom' },
    )));
    expect(sx).toBeCloseTo(300);
    expect(sy).toBeCloseTo(1000);
  });

  it('rides the left edge at a parallel for a y-axis label', () => {
    const [sx, sy] = drawnScreen(only(placeAxis(
      [{ axis: 'y', coords: [[-100, 700], [1100, 700]] }],
      [{ x: 500, y: 700, text: '700', axis: 'y' }],
    )));
    expect(sx).toBeCloseTo(0);
    expect(sy).toBeCloseTo(300);
  });

  it('rides the right edge when yLabelPosition is "right"', () => {
    const [sx, sy] = drawnScreen(only(placeAxis(
      [{ axis: 'y', coords: [[-100, 700], [1100, 700]] }],
      [{ x: 500, y: 700, text: '700', axis: 'y' }],
      { yLabelPosition: 'right' },
    )));
    expect(sx).toBeCloseTo(1000);
    expect(sy).toBeCloseTo(300);
  });

  it('anchors a clipped line at its near end, not an extrapolated crossing', () => {
    // Tilted meridian (200,0)->(400,600) stops short of the top edge (near end at
    // screen y=400); the label drops from that end's screen x (400).
    const [sx, sy] = drawnScreen(only(placeAxis(
      [{ axis: 'x', coords: [[200, 0], [400, 600]] }],
      [{ x: 300, y: 300, text: '300', axis: 'x' }],
    )));
    expect(sx).toBeCloseTo(400);
    expect(sy).toBeCloseTo(0);
  });

  it('drops a label whose crossing falls outside the viewport', () => {
    const calls = placeAxis(
      [{ axis: 'x', coords: [[1200, -100], [1200, 1100]] }],
      [{ x: 1200, y: 500, text: '1200', axis: 'x' }],
    );
    expect(calls).toHaveLength(0);
  });

  it('draws a leader from a clipped axis label to its grid line end', () => {
    const source = new VectorSource({ useSpatialIndex: false });
    const feature = new Feature(new LineString([[200, 0], [400, 600]]));
    feature.set('gridAxis', 'x');
    source.addFeature(feature);
    const placer = makePlacer(
      source, makeConfig({ edgeLabelExtend: 'axis', edgeLabelLeader: 'line' }),
    );
    const { xBuf } = buffersFor([{ x: 300, y: 300, text: '300', axis: 'x' }]);
    const drawFeature = vi.fn();
    const drawGeometry = vi.fn();
    const ctx = makeVectorContext(drawFeature);
    ctx.drawGeometry = drawGeometry;
    placer.place(ctx, northUpFrame(0), northUpScreen(), [0, 0, 1000, 1000], 1, xBuf, xBuf.length, [], 0);

    expect(drawFeature).toHaveBeenCalledTimes(1);
    expect(drawGeometry).toHaveBeenCalledTimes(1);
    const geom = drawGeometry.mock.calls[0]?.[0];
    if (!(geom instanceof LineString)) throw new Error('expected a LineString leader');
    // Anchor on the top edge (400,1000 map) back to the line's near end (400,600).
    expect(geom.getCoordinates()).toEqual([[400, 1000], [400, 600]]);
  });
});
