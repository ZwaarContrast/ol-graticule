import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { blockExternalTiles, tallyHotFunctions, type CpuProfile } from './helpers.js';

/**
 * Rapid scroll-zoom cycle profile: wheel in and out in tight bursts (faster than
 * the zoom animation, so zooms pile up like a user spinning the wheel in/out).
 * This is the worst case for the grid hot path: every zoom step re-runs the
 * per-resolution render context, line densification, and re-render. Reports hot
 * functions plus Script/Layout CPU per demo.
 *
 *   npx playwright test --config=playwright.profile.config.ts profile-zoomcycle.profile.ts
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, 'profile-results');

const DEMOS = [
  { path: '/ol-graticule/', name: 'zoomcycle-ol-graticule' },
  { path: '/ol-graticule-rd/', name: 'zoomcycle-rd' },
  { path: '/ol-graticule-modified-british-system/', name: 'zoomcycle-mbs' },
  { path: '/ol-graticule-mgrs/', name: 'zoomcycle-mgrs' },
];

const WHEELS = 90; // rapid, varied direction changes

async function getMetrics(client: CDPSession): Promise<Record<string, number>> {
  const raw = await client.send('Performance.getMetrics');
  const out: Record<string, number> = {};
  for (const m of raw.metrics) out[m.name] = m.value;
  return out;
}

/**
 * Fast, erratic scroll-zoom: short random in/out runs (zoom in a bit, out, in
 * further), well faster than the zoom animation so steps pile up. Seeded so the
 * sequence is identical across runs (fair before/after). Stays in a zoom band so
 * it doesn't wander to whole-world or max detail.
 */
async function driveZoomCycles(page: Page, cx: number, cy: number): Promise<void> {
  let seed = 0x9e3779b1;
  const rng = (): number => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let level = 0; // net zoom-in steps; keep within [-2, 6]
  for (let i = 0; i < WHEELS; i++) {
    const dir = level >= 6 ? 1 : level <= -2 ? -1 : rng() < 0.5 ? -1 : 1; // -1 = in
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, dir * 250);
    level += dir < 0 ? 1 : -1;
    await page.waitForTimeout(12 + Math.floor(rng() * 24)); // 12 to 36 ms: FAST
  }
}

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await blockExternalTiles(page);
});

for (const demo of DEMOS) {
  test(`${demo.name}: rapid scroll-zoom in/out`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo.path);
    await page.waitForLoadState('domcontentloaded');
    const mapEl = page.locator('#map');
    await expect(mapEl).toBeAttached();
    await page.waitForTimeout(1500);

    const mapBox = await mapEl.boundingBox();
    if (!mapBox) throw new Error(`no #map box for ${demo.path}`);
    const cx = mapBox.x + mapBox.width / 2;
    const cy = mapBox.y + mapBox.height / 2;

    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');
    await client.send('Profiler.enable');
    await client.send('Profiler.setSamplingInterval', { interval: 100 });

    const before = await getMetrics(client);
    await client.send('Profiler.start');
    const tStart = Date.now();

    await driveZoomCycles(page, cx, cy);

    const wallMs = Date.now() - tStart;
    const stopped = await client.send('Profiler.stop');
    const after = await getMetrics(client);
    await client.detach();

    const profile = stopped.profile as unknown as CpuProfile;
    const hot = tallyHotFunctions(profile, 30);

    writeFileSync(join(OUT_DIR, `${demo.name}.cpuprofile`), JSON.stringify(profile));

    const scriptDelta = (after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0);
    const layoutDelta = (after.LayoutDuration ?? 0) - (before.LayoutDuration ?? 0);
    const taskDelta = (after.TaskDuration ?? 0) - (before.TaskDuration ?? 0);
    const idleMs = hot.find((f) => f.name === '(idle)')?.selfMs ?? 0;

    const lines: string[] = [];
    lines.push(`Demo: ${demo.name} (${demo.path})`);
    lines.push(`${WHEELS} fast random in/out wheel steps (12 to 36 ms apart)`);
    lines.push(`Wall-clock: ${wallMs} ms, approx busy: ${(wallMs - idleMs).toFixed(0)} ms`);
    lines.push(`Script: ${scriptDelta.toFixed(3)} s, Layout: ${layoutDelta.toFixed(3)} s, Tasks: ${taskDelta.toFixed(3)} s`);
    lines.push('');
    lines.push('Top 30 by self time:');
    lines.push(`  ${'self ms'.padStart(9)}  ${'total ms'.padStart(9)}  function  [source]`);
    for (const fn of hot) {
      lines.push(`  ${fn.selfMs.toFixed(1).padStart(9)}  ${fn.totalMs.toFixed(1).padStart(9)}  ${fn.name}  [${fn.source}]`);
    }
    const summary = lines.join('\n') + '\n';
    writeFileSync(join(OUT_DIR, `${demo.name}.summary.txt`), summary);
    console.log('\n' + summary + '\n');
  });
}
