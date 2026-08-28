import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { blockExternalTiles } from './helpers.js';

/**
 * Smoke + visual-regression tests for each grid-system demo, run on BOTH
 * renderers (Canvas 2D and WebGL).
 *
 * External tile requests are aborted so the basemap stays blank and only the
 * graticule renders, keeping the screenshot deterministic across machines/CI.
 *
 * Both renderers are asserted against ONE shared baseline per demo (the Canvas
 * reference). Canvas is compared tightly (regression); WebGL is compared with a
 * looser per-pixel `threshold` that absorbs anti-aliasing / glyph-rasterisation
 * differences but still fails on STRUCTURAL divergence (a line or label in the
 * wrong place).
 *
 * `--update-snapshots` writes a missing baseline from the first run and leaves
 * an already-matching one untouched, so `canvas` runs FIRST and owns the shared
 * reference; `webgl` is then diffed against it.
 */

const RENDERERS = ['canvas', 'webgl'] as const;
type Renderer = (typeof RENDERERS)[number];

// Canvas vs its own baseline: tight (real regression).
const CANVAS_TOLERANCE = { maxDiffPixelRatio: 0.02 } as const;
// WebGL vs the Canvas baseline: same tight 2% pixel budget; the looser per-pixel
// threshold absorbs AA/GL-backend jitter, structural divergence still trips it.
const WEBGL_TOLERANCE = { maxDiffPixelRatio: 0.02, threshold: 0.3 } as const;

const tolerance = (r: Renderer): { maxDiffPixelRatio: number; threshold?: number } =>
  r === 'canvas' ? CANVAS_TOLERANCE : WEBGL_TOLERANCE;

/**
 * Assert the graticule actually painted pixels. OL vector layers use a 2D
 * context, so we read alpha back from every canvas under the target. Only
 * meaningful for the Canvas renderer (WebGL canvases have no 2D context and may
 * not preserve their drawing buffer); the screenshot assertion covers WebGL.
 */
async function expectPainted(target: Locator): Promise<void> {
  const anyOpaque = await target.evaluate((el) => {
    for (const c of el.querySelectorAll('canvas')) {
      const { width, height } = c;
      if (width === 0 || height === 0) continue;
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      const data = ctx.getImageData(0, 0, width, height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) return true;
      }
    }
    return false;
  });
  expect(anyOpaque, 'graticule painted no pixels onto any 2D canvas').toBe(true);
}

/**
 * Assert the demo mounted the EXPECTED renderer, so a silent WebGL→Canvas
 * fallback can't make the "webgl" run secretly test Canvas. `getContext('webgl')`
 * returns null on an already-2D canvas; the WebGL graticule layers are the page's
 * only WebGL contexts.
 */
async function expectRenderer(page: Page, renderer: Renderer): Promise<void> {
  const webglCanvases = await page.evaluate(() => {
    let n = 0;
    for (const c of document.querySelectorAll('canvas')) {
      if (c.getContext('webgl2') || c.getContext('webgl')) n += 1;
    }
    return n;
  });
  if (renderer === 'webgl') {
    expect(webglCanvases, 'expected a WebGL graticule layer, found none (Canvas fallback?)').toBeGreaterThan(0);
  } else {
    expect(webglCanvases, 'expected an all-Canvas map, found a WebGL context').toBe(0);
  }
}

/**
 * Rotate the view by +45° via OpenLayers' DragRotate (Alt+Shift+drag), so
 * rotation is driven through real input with no test-only hook in the demo.
 */
async function rotateView45(page: Page): Promise<void> {
  const size = page.viewportSize();
  const cx = size ? size.width / 2 : 512;
  const cy = size ? size.height / 2 : 384;
  const r = 200;
  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  await page.mouse.move(cx + r * Math.cos(-Math.PI / 4), cy + r * Math.sin(-Math.PI / 4), {
    steps: 20,
  });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.keyboard.up('Alt');
}

/** Load a demo with the chosen renderer selected (via the localStorage key the
 * demos read) and wait for its first canvas to mount + one render cycle. */
async function loadDemo(page: Page, path: string, selector: string, renderer: Renderer): Promise<Locator> {
  await page.addInitScript((r) => {
    try {
      localStorage.setItem('demo-renderer', r);
    } catch {
      /* ignore */
    }
  }, renderer);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
  const target = page.locator(selector);
  await expect(target).toBeAttached();
  await expect(target.locator('canvas').first()).toBeAttached({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  // Hide the dynamic info panel and the renderer toggle (whose label is the one
  // thing that differs between variants) so the snapshot is just the graticule.
  // `main` is the landing page's copy and card list, which sits over #bg-map;
  // without this the index baseline asserts prose, not rendering.
  await page.addStyleTag({
    content: '.badge, .renderer-toggle, main { display: none !important; }',
  });
  await expectRenderer(page, renderer);
  return target;
}

const DEMOS: { path: string; selector: string; name: string; renderers?: readonly Renderer[] }[] = [
  // The landing background has no toggle; in production it uses the facade's
  // 'auto' pick. The e2e forces each renderer via the localStorage key, so test
  // both against the shared baseline like every other demo.
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
  for (const renderer of demo.renderers ?? RENDERERS) {
    test(`${demo.name} [${renderer}]: renders and matches the shared baseline`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const target = await loadDemo(page, demo.path, demo.selector, renderer);

      if (renderer === 'canvas') await expectPainted(target);
      expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);

      // Both renderers diff against the SAME baseline: canvas is the reference
      // (regression), webgl matching it is the no-divergence guarantee.
      await expect(target).toHaveScreenshot(`${demo.name}.png`, tolerance(renderer));
    });

    test(`${demo.name} [${renderer}]: 45° rotation matches the shared baseline`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const target = await loadDemo(page, demo.path, demo.selector, renderer);
      await rotateView45(page);
      await page.waitForTimeout(1000);

      if (renderer === 'canvas') await expectPainted(target);
      expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);

      await expect(target).toHaveScreenshot(`${demo.name}-rotated.png`, tolerance(renderer));
    });
  }
}
