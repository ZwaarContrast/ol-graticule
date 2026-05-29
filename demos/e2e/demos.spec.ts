import { expect, test } from '@playwright/test';
import { blockExternalTiles } from './helpers.js';

/**
 * Smoke + visual-regression tests for each grid-system demo.
 *
 * We intercept and abort every third-party tile request (cartocdn,
 * openstreetmap, etc.) so the basemap stays blank and only the
 * graticule canvas renders. That makes the screenshot deterministic
 * across machines and CI runs.
 *
 * What we verify:
 *   1. Page loads without uncaught JS errors
 *   2. The graticule canvas mounts under `#map` / `#bg-map`
 *   3. The canvas paints visible pixels (i.e. the graticule actually
 *      drew lines)
 *   4. A pixel-by-pixel screenshot of the canvas matches the baseline
 *      (visual regression for the grid-line layout)
 */

const DEMOS = [
  { path: '/', selector: '#bg-map', name: 'index' },
  { path: '/ol-graticule/', selector: '#map', name: 'ol-graticule' },
  { path: '/ol-graticule-pixel/', selector: '#map', name: 'ol-graticule-pixel' },
  { path: '/ol-graticule-projected/', selector: '#map', name: 'ol-graticule-projected' },
  { path: '/ol-graticule-modified-british-system/', selector: '#map', name: 'mbs' },
  { path: '/ol-graticule-rd/', selector: '#map', name: 'rd' },
  { path: '/ol-graticule-mgrs/', selector: '#map', name: 'mgrs' },
  { path: '/ol-graticule-marinequadratkarte/', selector: '#map', name: 'kriegsmarine' },
  { path: '/ol-graticule-luftwaffe-planquadrat/', selector: '#map', name: 'luftwaffe' },
  { path: '/ol-graticule-heeresgitter/', selector: '#map', name: 'heeresgitter' },
];

test.beforeEach(async ({ page }) => {
  await blockExternalTiles(page);
});

for (const demo of DEMOS) {
  test(`${demo.name}: graticule canvas renders without external tiles`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(demo.path);
    await page.waitForLoadState('domcontentloaded');

    const target = page.locator(demo.selector);
    await expect(target).toBeAttached();

    const canvas = target.locator('canvas').first();
    await expect(canvas).toBeAttached({ timeout: 10_000 });

    // One full render cycle without tiles available.
    await page.waitForTimeout(1500);

    // Sanity: graticule lines actually drew pixels onto the canvas. OL
    // uses a 2D context for vector layers, so we read back alpha values
    // directly. If the context can't be acquired the test fails loud
    // rather than silently passing on a stub.
    const pixelStats = await canvas.evaluate((el) => {
      if (!(el instanceof HTMLCanvasElement)) {
        return { reason: 'target is not an HTMLCanvasElement', anyOpaque: false };
      }
      const { width, height } = el;
      if (width === 0 || height === 0) {
        return { reason: 'canvas has zero dimensions', anyOpaque: false };
      }
      const ctx = el.getContext('2d');
      if (!ctx) {
        return { reason: '2D context unavailable', anyOpaque: false };
      }
      const w = Math.min(width, 400);
      const h = Math.min(height, 400);
      const data = ctx.getImageData(0, 0, w, h).data;
      let opaqueCount = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) opaqueCount += 1;
      }
      return {
        reason: opaqueCount === 0 ? 'every sampled pixel was transparent' : '',
        anyOpaque: opaqueCount > 0,
        opaqueCount,
        sampledPixels: (data.length / 4) | 0,
      };
    });
    expect(
      pixelStats.anyOpaque,
      `graticule canvas had no painted pixels: ${pixelStats.reason}`,
    ).toBe(true);

    expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);

    // Visual regression. First run creates baselines under
    // `e2e/demos.spec.ts-snapshots/`; subsequent runs diff against them.
    await expect(canvas).toHaveScreenshot(`${demo.name}.png`, {
      maxDiffPixelRatio: 0.02,
    });
  });
}
