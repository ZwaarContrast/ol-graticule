import { describe, it, expect } from 'vitest';
import {
  apply,
  compose,
  create,
  makeInverse,
} from 'ol/transform';
import { screenToBitmapTransform } from '../rendering/HoverLensRenderer.js';

// Rebuild the OL canvas pixelTransform (maps bitmap px -> screen CSS px via the
// canvas' CSS transform), the way CanvasLayerRenderer.prepareContainer does.
function pixelTransform(size: number, pr: number, rotation: number, bitmap: number) {
  return compose(create(), size / 2, size / 2, 1 / pr, 1 / pr, rotation, -bitmap / 2, -bitmap / 2);
}

describe('screenToBitmapTransform', () => {
  const pr = 2;
  const size = 600;
  const bitmap = 1700; // rotated viewport bbox, larger than size * pr

  it('is the identity at rotation 0', () => {
    const t = screenToBitmapTransform(create(), makeInverse(create(), pixelTransform(size, pr, 0, size * pr)), pr);
    expect(t[0]).toBeCloseTo(1);
    expect(t[1]).toBeCloseTo(0);
    expect(t[2]).toBeCloseTo(0);
    expect(t[3]).toBeCloseTo(1);
    expect(t[4]).toBeCloseTo(0);
    expect(t[5]).toBeCloseTo(0);
  });

  it.each([0, 0.4, Math.PI / 2, -1.2, Math.PI])(
    'round-trips a screen point back to itself at rotation %f',
    (rotation) => {
      const px = pixelTransform(size, pr, rotation, bitmap);
      const toBitmap = screenToBitmapTransform(create(), makeInverse(create(), px), pr);

      for (const p of [[120, 300], [10, 590], [450, 75]]) {
        const screenDevice = [p[0] * pr, p[1] * pr];
        const onBitmap = apply(toBitmap, [...screenDevice]);
        const backToScreen = apply(px, [...onBitmap]); // CSS transform of the canvas
        expect(backToScreen[0]).toBeCloseTo(p[0]);
        expect(backToScreen[1]).toBeCloseTo(p[1]);
      }
    },
  );
});
