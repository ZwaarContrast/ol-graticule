import { describe, it, expect } from 'vitest';
import { UniversalGraticule } from '../UniversalGraticule.js';
import { CanvasGraticuleLayer } from '../CanvasGraticuleLayer.js';
import { WebGLGraticuleLayer } from '../WebGLGraticuleLayer.js';
import { applyBlend, BLEND_LAYER_CLASS } from '../util/blend.js';

function fakeCanvas(): { style: { mixBlendMode: string } } {
  return { style: { mixBlendMode: '' } };
}

describe('applyBlend', () => {
  it('sets mix-blend-mode on the canvas', () => {
    const canvas = fakeCanvas();
    applyBlend(canvas as unknown as HTMLCanvasElement, 'difference');
    expect(canvas.style.mixBlendMode).toBe('difference');
  });

  it('leaves the canvas alone without a blend mode', () => {
    const canvas = fakeCanvas();
    applyBlend(canvas as unknown as HTMLCanvasElement, undefined);
    expect(canvas.style.mixBlendMode).toBe('');
  });

  it('no-ops on a canvas with no CSS box', () => {
    expect(() =>
      applyBlend({} as unknown as OffscreenCanvas, 'difference'),
    ).not.toThrow();
  });
});

describe('blend option', () => {
  it('gives the canvas backend its own layer canvas', () => {
    const layer = new CanvasGraticuleLayer({ blend: 'difference' });
    expect(layer.getClassName()).toBe(BLEND_LAYER_CLASS);
  });

  it('leaves the default class when unblended', () => {
    expect(new CanvasGraticuleLayer({}).getClassName()).toBe('ol-layer');
  });

  it('lets a caller-supplied className win', () => {
    const layer = new CanvasGraticuleLayer({ blend: 'difference', className: 'my-grid' });
    expect(layer.getClassName()).toBe('my-grid');
  });

  it('reaches the WebGL backend', () => {
    const layer = new WebGLGraticuleLayer({ blend: 'difference' });
    expect(layer.blend).toBe('difference');
  });


  it('survives the UniversalGraticule facade', () => {
    const g = new UniversalGraticule({ renderer: 'canvas', blend: 'difference' });
    expect((g.getLayers().item(0) as CanvasGraticuleLayer).getClassName()).toBe(
      BLEND_LAYER_CLASS,
    );
  });
});
