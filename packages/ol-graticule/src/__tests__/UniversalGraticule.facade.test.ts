import { describe, it, expect } from 'vitest';
import { UniversalGraticule } from '../UniversalGraticule.js';
import { CanvasGraticuleLayer } from '../CanvasGraticuleLayer.js';
import { WebGLGraticuleLayer } from '../WebGLGraticuleLayer.js';
import type { GridSystem } from '../types.js';

const stubGrid: GridSystem = {
  getFeatures: () => [],
  getLabels: () => [],
  formatCoordinate: () => ({ x: '', y: '' }),
};

function child(g: UniversalGraticule) {
  return g.getLayers().item(0);
}

describe('UniversalGraticule facade', () => {
  it("renderer:'canvas' backs the group with a CanvasGraticuleLayer", () => {
    expect(child(new UniversalGraticule({ renderer: 'canvas' }))).toBeInstanceOf(CanvasGraticuleLayer);
  });

  it("renderer:'gl' backs the group with a WebGLGraticuleLayer", () => {
    expect(child(new UniversalGraticule({ renderer: 'gl' }))).toBeInstanceOf(WebGLGraticuleLayer);
  });

  it("renderer:'auto' falls back to canvas when WebGL is unavailable (node env)", () => {
    expect(child(new UniversalGraticule({}))).toBeInstanceOf(CanvasGraticuleLayer);
  });

  it('forwards grid + lens controls to the active variant', () => {
    const g = new UniversalGraticule({ renderer: 'canvas', gridSystem: stubGrid });
    expect(g.getGridSystem()).toBe(stubGrid);
    g.setGridSystem(null);
    expect(g.getGridSystem()).toBeNull();
    expect(() => g.setHoverLens(undefined)).not.toThrow();
  });

  it('applies group options to the group, not doubled onto the child', () => {
    const g = new UniversalGraticule({ renderer: 'canvas', opacity: 0.5 });
    expect(g.getOpacity()).toBe(0.5);
    expect(child(g)?.getOpacity()).toBe(1);
  });
});
