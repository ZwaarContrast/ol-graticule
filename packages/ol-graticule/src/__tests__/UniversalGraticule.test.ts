import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UniversalGraticule } from '../UniversalGraticule.js';
import { PixelGridSystem } from '../grid-systems/PixelGridSystem.js';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';
import Fill from 'ol/style/Fill';
import Style from 'ol/style/Style';
import type { GridSystem } from '../types.js';
import type { Geometry } from 'ol/geom';

describe('UniversalGraticule', () => {
  let gridSystem: PixelGridSystem;

  beforeEach(() => {
    gridSystem = new PixelGridSystem();
  });

  describe('constructor', () => {
    it('creates a layer with a VectorSource', () => {
      const graticule = new UniversalGraticule({ gridSystem });
      const source = graticule.getSource();
      expect(source).toBeDefined();
      expect(source).not.toBeNull();
    });

    it('accepts custom line styles via style.line', () => {
      const major = new Stroke({ color: 'red', width: 2 });
      const minor = new Stroke({ color: 'blue', width: 0.5 });
      const graticule = new UniversalGraticule({
        gridSystem,
        style: { line: { major, minor } },
      });
      expect(graticule).toBeDefined();
    });

    it('accepts a Text template via style.edgeLabel', () => {
      const edgeLabel = new Text({
        font: '12px sans-serif',
        fill: new Fill({ color: 'white' }),
      });
      const graticule = new UniversalGraticule({
        gridSystem,
        style: { edgeLabel },
      });
      expect(graticule).toBeDefined();
    });

    it('accepts style.edgeLabel: true as the "default edge labels" shortcut', () => {
      const graticule = new UniversalGraticule({
        gridSystem,
        style: { edgeLabel: true },
      });
      expect(graticule).toBeDefined();
    });

    it('accepts maxLines option', () => {
      const graticule = new UniversalGraticule({
        gridSystem,
        maxLines: 50,
      });
      expect(graticule).toBeDefined();
    });

    it('passes through VectorLayer options like className and zIndex', () => {
      const graticule = new UniversalGraticule({
        gridSystem,
        className: 'my-graticule',
        zIndex: 10,
        visible: false,
      });
      expect(graticule.getClassName()).toBe('my-graticule');
      expect(graticule.getZIndex()).toBe(10);
      expect(graticule.getVisible()).toBe(false);
    });
  });

  describe('style function', () => {
    it('applies major style to features without gridLineType=minor', () => {
      const major = new Stroke({ color: 'red', width: 2 });
      const minor = new Stroke({ color: 'blue', width: 1 });
      const graticule = new UniversalGraticule({
        gridSystem,
        style: { line: { major, minor } },
      });

      const styleFn = graticule.getStyle() as (feature: Feature<Geometry>) => Style;

      const majorFeature = new Feature<Geometry>(new LineString([[0, 0], [0, 100]]));
      majorFeature.set('gridLineType', 'major');
      const majorStyle = styleFn(majorFeature);
      expect(majorStyle.getStroke()?.getColor()).toBe('red');
      expect(majorStyle.getStroke()?.getWidth()).toBe(2);
    });

    it('applies minor style to features with gridLineType=minor', () => {
      const major = new Stroke({ color: 'red', width: 2 });
      const minor = new Stroke({ color: 'blue', width: 1 });
      const graticule = new UniversalGraticule({
        gridSystem,
        style: { line: { major, minor } },
      });

      const styleFn = graticule.getStyle() as (feature: Feature<Geometry>) => Style;

      const minorFeature = new Feature<Geometry>(new LineString([[0, 0], [0, 100]]));
      minorFeature.set('gridLineType', 'minor');
      const minorStyle = styleFn(minorFeature);
      expect(minorStyle.getStroke()?.getColor()).toBe('blue');
      expect(minorStyle.getStroke()?.getWidth()).toBe(1);
    });

    it('falls back to major style for gridLineType=boundary when no boundary stroke is supplied', () => {
      const major = new Stroke({ color: 'red', width: 2 });
      const minor = new Stroke({ color: 'blue', width: 1 });
      const graticule = new UniversalGraticule({
        gridSystem,
        style: { line: { major, minor } },
      });
      const styleFn = graticule.getStyle() as (feature: Feature<Geometry>) => Style;
      const boundaryFeature = new Feature<Geometry>(new LineString([[0, 0], [0, 100]]));
      boundaryFeature.set('gridLineType', 'boundary');
      const style = styleFn(boundaryFeature);
      expect(style.getStroke()?.getColor()).toBe('red');
    });

    it('applies a dedicated boundary stroke when supplied', () => {
      const major = new Stroke({ color: 'red', width: 2 });
      const boundary = new Stroke({ color: 'purple', width: 3 });
      const graticule = new UniversalGraticule({
        gridSystem,
        style: { line: { major, boundary } },
      });
      const styleFn = graticule.getStyle() as (feature: Feature<Geometry>) => Style;
      const boundaryFeature = new Feature<Geometry>(new LineString([[0, 0], [0, 100]]));
      boundaryFeature.set('gridLineType', 'boundary');
      const style = styleFn(boundaryFeature);
      expect(style.getStroke()?.getColor()).toBe('purple');
      expect(style.getStroke()?.getWidth()).toBe(3);
    });

    it('applies a single Stroke to every feature when style.line is a bare Stroke', () => {
      const stroke = new Stroke({ color: 'green', width: 3 });
      const graticule = new UniversalGraticule({
        gridSystem,
        style: { line: stroke },
      });

      // Bare Stroke resolves to a static Style (not a function); the layer
      // uses it for every feature regardless of gridLineType.
      const style = graticule.getStyle();
      expect(typeof style).not.toBe('function');
      const single = style as Style;
      expect(single.getStroke()?.getColor()).toBe('green');
      expect(single.getStroke()?.getWidth()).toBe(3);
    });

    it('honors a user-supplied StyleFunction for line features', () => {
      const custom = new Style({ stroke: new Stroke({ color: 'pink', width: 4 }) });
      const styleFn = vi.fn().mockReturnValue(custom);
      const graticule = new UniversalGraticule({
        gridSystem,
        style: { line: styleFn },
      });
      const resolved = graticule.getStyle() as typeof styleFn;
      expect(resolved).toBe(styleFn);
    });
  });

  describe('with mock grid system', () => {
    it('works with a custom GridSystem implementation', () => {
      const mockSystem: GridSystem = {
        getFeatures: vi.fn().mockReturnValue([
          (() => {
            const f = new Feature<Geometry>(new LineString([[0, 0], [0, 100]]));
            f.set('gridLineType', 'major');
            return f;
          })(),
        ]),
        getLabels: vi.fn().mockReturnValue([
          { point: new Point([50, 100]), text: '50', axis: 'x' as const },
        ]),
        formatCoordinate: vi.fn().mockReturnValue({ x: '50', y: '75' }),
      };

      const graticule = new UniversalGraticule({
        gridSystem: mockSystem,
        style: { edgeLabel: true },
      });
      expect(graticule).toBeDefined();
    });
  });

  describe('setVisible', () => {
    it('toggles visibility', () => {
      const graticule = new UniversalGraticule({ gridSystem, visible: true });
      expect(graticule.getVisible()).toBe(true);
      graticule.setVisible(false);
      expect(graticule.getVisible()).toBe(false);
      graticule.setVisible(true);
      expect(graticule.getVisible()).toBe(true);
    });
  });

  describe('source initialization', () => {
    it('starts with an empty source', () => {
      const graticule = new UniversalGraticule({ gridSystem });
      const source = graticule.getSource()!;
      const features = source.getFeatures();
      expect(features).toHaveLength(0);
    });
  });

  describe('drawLabels_ (postrender label pass)', () => {
    type DrawCall = { feature: Feature<Geometry>; style: Style };

    function makeGraticule(
      labels: Array<{ x: number; y: number; text: string; axis: 'x' | 'y' }>,
      options: Partial<{
        xLabelPosition: 'top' | 'bottom';
        yLabelPosition: 'left' | 'right';
        xLabelOffset: number;
        yLabelOffset: number;
      }> = {},
    ): { graticule: UniversalGraticule; drawFeature: ReturnType<typeof vi.fn> } {
      const mockSystem: GridSystem = {
        getFeatures: vi.fn().mockReturnValue([]),
        getLabels: vi.fn(),
        formatCoordinate: vi.fn().mockReturnValue({ x: '', y: '' }),
      };

      const graticule = new UniversalGraticule({
        gridSystem: mockSystem,
        style: { edgeLabel: true },
        ...options,
      });

      // Bypasses postrender lifecycle so we can test the rendering logic in
      // isolation, push labels through `collectEdgeLabels_` (the scratch-buffer
      // populator) and call `drawLabels_` with the populated counts, which is
      // exactly what `handlePostrender_` does in production.
      const inst = graticule as unknown as {
        collectEdgeLabels_: (
          worldOffsets: number[],
          extent: [number, number, number, number],
          fetch: (shiftedExtent: [number, number, number, number]) => Array<{
            point: Point; text: string; axis: 'x' | 'y';
          }>,
        ) => { xCount: number; yCount: number };
        drawLabels_: (
          ctx: unknown,
          extent: [number, number, number, number],
          resolution: number,
          xCount: number,
          yCount: number,
        ) => void;
      };
      const labelFixture = labels.map((l) => ({
        point: new Point([l.x, l.y]),
        text: l.text,
        axis: l.axis,
      }));

      const drawFeature = vi.fn();
      const mockVectorContext = { drawFeature };

      const extent: [number, number, number, number] = [0, 0, 1000, 1000];
      const { xCount, yCount } = inst.collectEdgeLabels_([0], extent, () => labelFixture);
      inst.drawLabels_(mockVectorContext, extent, 1, xCount, yCount);

      return { graticule, drawFeature };
    }

    function drawCalls(drawFeature: ReturnType<typeof vi.fn>): DrawCall[] {
      return drawFeature.mock.calls.map((args) => ({
        feature: args[0] as Feature<Geometry>,
        style: args[1] as Style,
      }));
    }

    it('calls drawFeature exactly once per non-culled label (regression: labels silently dropped)', () => {
      const { drawFeature } = makeGraticule([
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
      const { drawFeature } = makeGraticule([
        { x: 0, y: 100, text: '100', axis: 'y' },
        { x: 0, y: 300, text: '300', axis: 'y' },
        { x: 0, y: 500, text: '500', axis: 'y' },
        { x: 0, y: 700, text: '700', axis: 'y' },
        { x: 0, y: 900, text: '900', axis: 'y' },
      ]);

      const calls = drawCalls(drawFeature);
      const texts = calls.map((c) => c.style.getText()!.getText() as string).sort();
      expect(texts).toEqual(['100', '300', '500', '700', '900']);
    });

    it('hands a DISTINCT Text instance to each drawFeature call (regression: shared-Text pooling bug)', () => {
      const { drawFeature } = makeGraticule([
        { x: 100, y: 500, text: '100', axis: 'x' },
        { x: 300, y: 500, text: '300', axis: 'x' },
        { x: 0, y: 200, text: '200y', axis: 'y' },
        { x: 0, y: 800, text: '800y', axis: 'y' },
      ]);

      const calls = drawCalls(drawFeature);
      const textInstances = new Set(calls.map((c) => c.style.getText()));
      // Without distinct Text instances, OL's renderer can end up rendering
      // whichever axis's text was applied last for all labels, which is
      // exactly how Y labels silently disappeared during review.
      expect(textInstances.size).toBe(calls.length);
    });

    it('applies world-wrap xOffset via a reusable Point (regression: world-copy allocation + correctness)', () => {
      // Simulates wrapX: three visible world copies at offsets [-worldWidth, 0, worldWidth].
      // The grid system emits labels in canonical coords; `collectEdgeLabels_` should
      // produce one draw per label per world copy with the correct x-shift applied,
      // without cloning the input Points.
      const mockSystem: GridSystem = {
        getFeatures: vi.fn().mockReturnValue([]),
        getLabels: vi.fn().mockReturnValue([
          { point: new Point([100, 500]), text: '100', axis: 'x' as const },
        ]),
        formatCoordinate: vi.fn().mockReturnValue({ x: '', y: '' }),
      };
      const graticule = new UniversalGraticule({
        gridSystem: mockSystem,
        style: { edgeLabel: true },
      });
      const inst = graticule as unknown as {
        collectEdgeLabels_: (
          worldOffsets: number[],
          extent: [number, number, number, number],
          fetch: (shiftedExtent: [number, number, number, number]) => Array<{
            point: Point; text: string; axis: 'x' | 'y';
          }>,
        ) => { xCount: number; yCount: number };
        drawLabels_: (
          ctx: unknown, extent: [number, number, number, number], resolution: number,
          xCount: number, yCount: number,
        ) => void;
      };

      const drawFeature = vi.fn();
      const extent: [number, number, number, number] = [0, 0, 1000, 1000];
      const worldWidth = 10000;
      const { xCount, yCount } = inst.collectEdgeLabels_(
        [-worldWidth, 0, worldWidth],
        extent,
        (shifted) => mockSystem.getLabels(shifted, 1, 'EPSG:3857'),
      );
      inst.drawLabels_({ drawFeature }, extent, 1, xCount, yCount);

      const calls = drawCalls(drawFeature);
      expect(calls.length).toBe(3);
      // The three drawn labels must have distinct x coordinates (original,
      // + worldWidth, - worldWidth). A bug where the reusable Point leaked
      // state across iterations would collapse these to one value.
      const xs = calls.map((c) => (c.feature.getGeometry() as Point).getCoordinates()[0]);
      expect(new Set(xs).size).toBe(3);
      expect(xs).toContain(100);
      expect(xs).toContain(100 - worldWidth);
      expect(xs).toContain(100 + worldWidth);
    });

    it('preserves per-label text content on each drawFeature call', () => {
      const { drawFeature } = makeGraticule([
        { x: 100, y: 500, text: 'X1', axis: 'x' },
        { x: 300, y: 500, text: 'X2', axis: 'x' },
        { x: 0, y: 200, text: 'Y1', axis: 'y' },
        { x: 0, y: 800, text: 'Y2', axis: 'y' },
      ]);

      const calls = drawCalls(drawFeature);
      const byText = calls.map((c) => c.style.getText()!.getText());
      expect(byText).toContain('X1');
      expect(byText).toContain('X2');
      expect(byText).toContain('Y1');
      expect(byText).toContain('Y2');
    });

    it('positions X-axis labels at the top edge with center alignment (default)', () => {
      const { drawFeature } = makeGraticule([
        { x: 200, y: 500, text: 'top', axis: 'x' },
      ]);

      const [call] = drawCalls(drawFeature);
      const geom = call!.feature.getGeometry() as Point;
      const [gx, gy] = geom.getCoordinates();
      const text = call!.style.getText()!;

      // X labels snap to viewport maxY (=1000 from fixture), preserving X
      expect(gx).toBe(200);
      expect(gy).toBe(1000);
      expect(text.getTextAlign()).toBe('center');
      expect(text.getTextBaseline()).toBe('top');
    });

    it('positions Y-axis labels at the left edge with left alignment (default)', () => {
      const { drawFeature } = makeGraticule([
        { x: 999, y: 400, text: 'left', axis: 'y' },
      ]);

      const [call] = drawCalls(drawFeature);
      const geom = call!.feature.getGeometry() as Point;
      const [gx, gy] = geom.getCoordinates();
      const text = call!.style.getText()!;

      // Y labels snap to viewport minX (=0 from fixture), preserving Y
      expect(gx).toBe(0);
      expect(gy).toBe(400);
      expect(text.getTextAlign()).toBe('left');
      expect(text.getTextBaseline()).toBe('middle');
    });

    it('flips X labels to bottom edge when xLabelPosition="bottom"', () => {
      const { drawFeature } = makeGraticule(
        [{ x: 200, y: 500, text: 'x', axis: 'x' }],
        { xLabelPosition: 'bottom' },
      );

      const [call] = drawCalls(drawFeature);
      const [, gy] = (call!.feature.getGeometry() as Point).getCoordinates();
      expect(gy).toBe(0); // minY of fixture extent
      expect(call!.style.getText()!.getTextBaseline()).toBe('bottom');
    });

    it('flips Y labels to right edge when yLabelPosition="right"', () => {
      const { drawFeature } = makeGraticule(
        [{ x: 500, y: 400, text: 'y', axis: 'y' }],
        { yLabelPosition: 'right' },
      );

      const [call] = drawCalls(drawFeature);
      const [gx] = (call!.feature.getGeometry() as Point).getCoordinates();
      expect(gx).toBe(1000); // maxX of fixture extent
      expect(call!.style.getText()!.getTextAlign()).toBe('right');
    });

    it('culls overlapping Y labels when they fall within minYGap pixels', () => {
      // minYGap = fontSize + 4 = 10 + 4 = 14px at resolution 1
      // Labels spaced 5 units apart (=5px) should mostly be culled;
      // labels spaced 100 units apart should not.
      const { drawFeature: tight } = makeGraticule([
        { x: 0, y: 500, text: 'a', axis: 'y' },
        { x: 0, y: 505, text: 'b', axis: 'y' },
        { x: 0, y: 510, text: 'c', axis: 'y' },
      ]);
      const { drawFeature: spaced } = makeGraticule([
        { x: 0, y: 100, text: 'a', axis: 'y' },
        { x: 0, y: 300, text: 'b', axis: 'y' },
        { x: 0, y: 500, text: 'c', axis: 'y' },
      ]);

      expect(tight.mock.calls.length).toBeLessThan(3);
      expect(spaced.mock.calls.length).toBe(3);
    });

    it('culls overlapping X labels when they fall within minXGap pixels', () => {
      // minXGap = max(40, textLen*charWidth+12). With 1-char labels, ~19px.
      const { drawFeature: tight } = makeGraticule([
        { x: 100, y: 500, text: 'a', axis: 'x' },
        { x: 110, y: 500, text: 'b', axis: 'x' },
        { x: 120, y: 500, text: 'c', axis: 'x' },
      ]);
      const { drawFeature: spaced } = makeGraticule([
        { x: 100, y: 500, text: 'a', axis: 'x' },
        { x: 300, y: 500, text: 'b', axis: 'x' },
        { x: 500, y: 500, text: 'c', axis: 'x' },
      ]);

      expect(tight.mock.calls.length).toBeLessThan(3);
      expect(spaced.mock.calls.length).toBe(3);
    });
  });

  describe('setGridSystem', () => {
    it('swaps the underlying grid system', () => {
      const a = new PixelGridSystem();
      const b = new PixelGridSystem({ yInverted: true });
      const graticule = new UniversalGraticule({ gridSystem: a });
      expect(graticule.getGridSystem()).toBe(a);
      graticule.setGridSystem(b);
      expect(graticule.getGridSystem()).toBe(b);
    });

    it('attaches a postrender listener when swapping to a grid system with getCellLabels (regression: listener not re-registered)', () => {
      const simple: GridSystem = {
        getFeatures: vi.fn().mockReturnValue([]),
        getLabels: vi.fn().mockReturnValue([]),
        formatCoordinate: vi.fn().mockReturnValue({ x: '', y: '' }),
      };
      const withCells: GridSystem = {
        getFeatures: vi.fn().mockReturnValue([]),
        getLabels: vi.fn().mockReturnValue([]),
        getCellLabels: vi.fn().mockReturnValue([]),
        formatCoordinate: vi.fn().mockReturnValue({ x: '', y: '' }),
      };

      // Construct without cell labels + without edge labels → no postrender listener.
      const graticule = new UniversalGraticule({ gridSystem: simple });
      const inst = graticule as unknown as { postrenderKey_: unknown };
      expect(inst.postrenderKey_).toBeNull();

      // Swap to a grid system that has cell labels → listener must attach.
      graticule.setGridSystem(withCells);
      expect(inst.postrenderKey_).not.toBeNull();

      // Swap back → listener must detach.
      graticule.setGridSystem(simple);
      expect(inst.postrenderKey_).toBeNull();
    });
  });
});
