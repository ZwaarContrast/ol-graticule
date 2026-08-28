import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasGraticuleLayer } from '../CanvasGraticuleLayer.js';
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

describe('CanvasGraticuleLayer', () => {
  let gridSystem: PixelGridSystem;

  beforeEach(() => {
    gridSystem = new PixelGridSystem();
  });

  describe('constructor', () => {
    it('creates a layer with a VectorSource', () => {
      const graticule = new CanvasGraticuleLayer({ gridSystem });
      const source = graticule.getSource();
      expect(source).toBeDefined();
      expect(source).not.toBeNull();
    });

    it('accepts custom line styles via style.line', () => {
      const major = new Stroke({ color: 'red', width: 2 });
      const minor = new Stroke({ color: 'blue', width: 0.5 });
      const graticule = new CanvasGraticuleLayer({
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
      const graticule = new CanvasGraticuleLayer({
        gridSystem,
        style: { edgeLabel },
      });
      expect(graticule).toBeDefined();
    });

    it('accepts style.edgeLabel: true as the "default edge labels" shortcut', () => {
      const graticule = new CanvasGraticuleLayer({
        gridSystem,
        style: { edgeLabel: true },
      });
      expect(graticule).toBeDefined();
    });

    it('accepts maxLines option', () => {
      const graticule = new CanvasGraticuleLayer({
        gridSystem,
        maxLines: 50,
      });
      expect(graticule).toBeDefined();
    });

    it('passes through VectorLayer options like className and zIndex', () => {
      const graticule = new CanvasGraticuleLayer({
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
      const graticule = new CanvasGraticuleLayer({
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
      const graticule = new CanvasGraticuleLayer({
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
      const graticule = new CanvasGraticuleLayer({
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
      const graticule = new CanvasGraticuleLayer({
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
      const graticule = new CanvasGraticuleLayer({
        gridSystem,
        style: { line: stroke },
      });

      const style = graticule.getStyle();
      expect(typeof style).not.toBe('function');
      const single = style as Style;
      expect(single.getStroke()?.getColor()).toBe('green');
      expect(single.getStroke()?.getWidth()).toBe(3);
    });

    it('honors a user-supplied StyleFunction for line features', () => {
      const custom = new Style({ stroke: new Stroke({ color: 'pink', width: 4 }) });
      const styleFn = vi.fn().mockReturnValue(custom);
      const graticule = new CanvasGraticuleLayer({
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

      const graticule = new CanvasGraticuleLayer({
        gridSystem: mockSystem,
        style: { edgeLabel: true },
      });
      expect(graticule).toBeDefined();
    });
  });

  describe('setVisible', () => {
    it('toggles visibility', () => {
      const graticule = new CanvasGraticuleLayer({ gridSystem, visible: true });
      expect(graticule.getVisible()).toBe(true);
      graticule.setVisible(false);
      expect(graticule.getVisible()).toBe(false);
      graticule.setVisible(true);
      expect(graticule.getVisible()).toBe(true);
    });
  });

  describe('source initialization', () => {
    it('starts with an empty source', () => {
      const graticule = new CanvasGraticuleLayer({ gridSystem });
      const source = graticule.getSource()!;
      const features = source.getFeatures();
      expect(features).toHaveLength(0);
    });
  });

  describe('setGridSystem', () => {
    it('swaps the underlying grid system', () => {
      const a = new PixelGridSystem();
      const b = new PixelGridSystem({ yInverted: true });
      const graticule = new CanvasGraticuleLayer({ gridSystem: a });
      expect(graticule.getGridSystem()).toBe(a);
      graticule.setGridSystem(b);
      expect(graticule.getGridSystem()).toBe(b);
    });

    it('attaches a postrender listener when swapping to a grid system with getCellLabels', () => {
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

      const graticule = new CanvasGraticuleLayer({ gridSystem: simple });
      const inst = graticule as unknown as { postrenderKey_: unknown };
      expect(inst.postrenderKey_).toBeNull();

      graticule.setGridSystem(withCells);
      expect(inst.postrenderKey_).not.toBeNull();

      graticule.setGridSystem(simple);
      expect(inst.postrenderKey_).toBeNull();
    });
  });
});
