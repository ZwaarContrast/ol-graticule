import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UniversalGraticule } from '../UniversalGraticule.js';
import { CanvasGraticuleLayer } from '../CanvasGraticuleLayer.js';
import { WebGLGraticuleLayer } from '../WebGLGraticuleLayer.js';
import { PixelGridSystem } from '../grid-systems/PixelGridSystem.js';
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';
import Fill from 'ol/style/Fill';
import type { GridSystem } from '../types.js';

describe('UniversalGraticule (Facade)', () => {
  let gridSystem: PixelGridSystem;

  beforeEach(() => {
    gridSystem = new PixelGridSystem();
  });

  describe('constructor & backend resolution', () => {
    it('defaults to auto (Canvas in Node test environment)', () => {
      const graticule = new UniversalGraticule({ gridSystem });
      const child = graticule.getLayers().item(0);
      expect(child).toBeInstanceOf(CanvasGraticuleLayer);
    });

    it('forces CanvasGraticuleLayer when renderer is canvas', () => {
      const graticule = new UniversalGraticule({ gridSystem, renderer: 'canvas' });
      const child = graticule.getLayers().item(0);
      expect(child).toBeInstanceOf(CanvasGraticuleLayer);
    });

    it('forces WebGLGraticuleLayer when renderer is gl', () => {
      const graticule = new UniversalGraticule({ gridSystem, renderer: 'gl' });
      const child = graticule.getLayers().item(0);
      expect(child).toBeInstanceOf(WebGLGraticuleLayer);
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

    it('accepts edgeLabel options', () => {
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

    it('passes through LayerGroup options like opacity, zIndex, and visible', () => {
      const graticule = new UniversalGraticule({
        gridSystem,
        zIndex: 10,
        opacity: 0.7,
        visible: false,
      });
      expect(graticule.getZIndex()).toBe(10);
      expect(graticule.getOpacity()).toBe(0.7);
      expect(graticule.getVisible()).toBe(false);
    });
  });

  describe('delegation methods', () => {
    it('forwards getGridSystem and setGridSystem to the active backend', () => {
      const a = new PixelGridSystem();
      const b = new PixelGridSystem({ yInverted: true });
      const graticule = new UniversalGraticule({ gridSystem: a });
      expect(graticule.getGridSystem()).toBe(a);
      graticule.setGridSystem(b);
      expect(graticule.getGridSystem()).toBe(b);
      graticule.setGridSystem(null);
      expect(graticule.getGridSystem()).toBeNull();
    });

    it('forwards setHoverLens without throwing', () => {
      const graticule = new UniversalGraticule({ gridSystem });
      expect(() => graticule.setHoverLens({ radius: 80 })).not.toThrow();
      expect(() => graticule.setHoverLens(undefined)).not.toThrow();
    });

    it('delegates correctly when backed by WebGLGraticuleLayer', () => {
      const a = new PixelGridSystem();
      const b = new PixelGridSystem({ yInverted: true });
      const graticule = new UniversalGraticule({ gridSystem: a, renderer: 'gl' });
      expect(graticule.getGridSystem()).toBe(a);
      graticule.setGridSystem(b);
      expect(graticule.getGridSystem()).toBe(b);
      expect(() => graticule.setHoverLens({ radius: 100 })).not.toThrow();
    });
  });

  describe('with mock grid system', () => {
    it('works with a custom GridSystem implementation', () => {
      const mockSystem: GridSystem = {
        getFeatures: vi.fn().mockReturnValue([]),
        getLabels: vi.fn().mockReturnValue([]),
        formatCoordinate: vi.fn().mockReturnValue({ x: '50', y: '75' }),
      };

      const graticule = new UniversalGraticule({
        gridSystem: mockSystem,
        style: { edgeLabel: true },
      });
      expect(graticule.getGridSystem()).toBe(mockSystem);
    });
  });
});
