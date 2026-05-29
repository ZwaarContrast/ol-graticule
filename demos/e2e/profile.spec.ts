import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { blockExternalTiles, tallyHotFunctions, type CpuProfile } from './helpers.js';

/**
 * CPU-profile the interactive hot paths of each grid demo via CDP.
 *
 * Sequence per demo: zoom in three steps, sweep the mouse across the map,
 * pan four times, zoom out three steps, sweep again, zoom in again. While
 * this runs we collect a V8 CPU profile and a Performance metrics delta.
 *
 * Reports land under `e2e/profile-results/<name>.{summary.txt,profile.cpuprofile}`.
 * The `.cpuprofile` files are openable in Chrome DevTools → Performance → Load Profile.
 *
 * Skipped by default because the run takes ~5 s × demos. Run explicitly:
 *   npx playwright test profile.spec.ts
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, 'profile-results');

const DEMOS = [
  { path: '/ol-graticule/', name: 'ol-graticule' },
  { path: '/ol-graticule-projected/', name: 'ol-graticule-projected' },
  { path: '/ol-graticule-modified-british-system/', name: 'mbs' },
  { path: '/ol-graticule-rd/', name: 'rd' },
  { path: '/ol-graticule-mgrs/', name: 'mgrs' },
  { path: '/ol-graticule-marinequadratkarte/', name: 'kriegsmarine' },
  { path: '/ol-graticule-luftwaffe-planquadrat/', name: 'luftwaffe' },
  { path: '/ol-graticule-heeresgitter/', name: 'heeresgitter' },
];

interface PerfMetrics {
  Timestamp?: number;
  TaskDuration?: number;
  ScriptDuration?: number;
  LayoutDuration?: number;
  RecalcStyleDuration?: number;
  JSHeapUsedSize?: number;
  JSHeapTotalSize?: number;
}

async function getMetrics(client: CDPSession): Promise<PerfMetrics> {
  const raw = await client.send('Performance.getMetrics');
  const interesting = new Set([
    'Timestamp', 'TaskDuration', 'ScriptDuration', 'LayoutDuration',
    'RecalcStyleDuration', 'JSHeapUsedSize', 'JSHeapTotalSize',
  ]);
  const out: Record<string, number> = {};
  for (const m of raw.metrics) {
    if (interesting.has(m.name)) out[m.name] = m.value;
  }
  return out;
}

async function driveInteractions(page: Page, mapBox: { x: number; y: number; width: number; height: number }): Promise<void> {
  const cx = mapBox.x + mapBox.width / 2;
  const cy = mapBox.y + mapBox.height / 2;

  // Each demo opens centred on its grid's region. Stay there: zoom IN to
  // the most detailed view first (where cell subdivision, projection,
  // and clipping all do the most work), and run pan + sweep there. A
  // moderate zoom-out + zoom-back-in sequence at the end checks that
  // re-zooming hits the per-resolution caches.

  // Zoom in 4 steps to the detail level where subdivision activates.
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -250);
    await page.waitForTimeout(200);
  }

  // Heavy sweep at detail zoom — 40 positions in a tight figure-8 over the
  // grid's interior. Cell label + clipping cost peaks here.
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    const r = 0.25;
    const x = cx + mapBox.width * r * Math.sin(t * Math.PI * 4);
    const y = cy + mapBox.height * r * Math.sin(t * Math.PI * 2);
    await page.mouse.move(x, y);
    await page.waitForTimeout(16);
  }

  // Four pan drags inside the grid extent (small radius around centre).
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const r = mapBox.width * 0.10;
    const x0 = cx + r * Math.cos(angle);
    const y0 = cy + r * Math.sin(angle);
    const x1 = cx - r * Math.cos(angle);
    const y1 = cy - r * Math.sin(angle);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    const steps = 10;
    for (let s = 1; s <= steps; s++) {
      await page.mouse.move(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(150);
  }

  // Zoom out 2 steps to a wider but still-in-extent view.
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(200);
  }

  // Sweep at the medium zoom (different cell sizes, exercises interval logic).
  for (let i = 0; i < 25; i++) {
    const t = i / 25;
    const x = cx + mapBox.width * 0.2 * Math.cos(t * Math.PI * 3);
    const y = cy + mapBox.height * 0.2 * Math.sin(t * Math.PI * 2);
    await page.mouse.move(x, y);
    await page.waitForTimeout(16);
  }

  // Zoom back in 2 steps to detail — should hit the per-resolution caches.
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -250);
    await page.waitForTimeout(200);
  }

  // Final sweep at detail.
  for (let i = 0; i < 30; i++) {
    const t = i / 30;
    const x = cx + mapBox.width * 0.15 * Math.cos(t * Math.PI * 5);
    const y = cy + mapBox.height * 0.15 * Math.sin(t * Math.PI * 3);
    await page.mouse.move(x, y);
    await page.waitForTimeout(16);
  }
}

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await blockExternalTiles(page);
});

for (const demo of DEMOS) {
  test(`profile ${demo.name}: zoom + mouse + pan + zoom`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo.path);
    await page.waitForLoadState('domcontentloaded');

    const mapEl = page.locator('#map');
    await expect(mapEl).toBeAttached();
    await page.waitForTimeout(1500);

    const mapBox = await mapEl.boundingBox();
    if (!mapBox) throw new Error(`no bounding box for #map on ${demo.path}`);

    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');
    await client.send('Profiler.enable');
    await client.send('Profiler.setSamplingInterval', { interval: 100 });

    const metricsBefore = await getMetrics(client);

    await client.send('Profiler.start');
    const tStart = Date.now();

    await driveInteractions(page, mapBox);

    const wallMs = Date.now() - tStart;
    const stopped = await client.send('Profiler.stop');
    const metricsAfter = await getMetrics(client);

    await client.detach();

    const profile = stopped.profile as unknown as CpuProfile;
    const hot = tallyHotFunctions(profile, 20);

    const cpuPath = join(OUT_DIR, `${demo.name}.cpuprofile`);
    writeFileSync(cpuPath, JSON.stringify(profile));

    const scriptDelta = (metricsAfter.ScriptDuration ?? 0) - (metricsBefore.ScriptDuration ?? 0);
    const taskDelta = (metricsAfter.TaskDuration ?? 0) - (metricsBefore.TaskDuration ?? 0);
    const layoutDelta = (metricsAfter.LayoutDuration ?? 0) - (metricsBefore.LayoutDuration ?? 0);
    const recalcDelta =
      (metricsAfter.RecalcStyleDuration ?? 0) - (metricsBefore.RecalcStyleDuration ?? 0);
    const heapAfter = ((metricsAfter.JSHeapUsedSize ?? 0) / (1024 * 1024)).toFixed(2);

    const lines: string[] = [];
    lines.push(`Demo: ${demo.name} (${demo.path})`);
    lines.push(`Wall-clock interaction time: ${wallMs} ms`);
    lines.push('');
    lines.push('Page metrics delta (seconds of CPU time across the run):');
    lines.push(`  Script:        ${scriptDelta.toFixed(3)} s`);
    lines.push(`  Layout:        ${layoutDelta.toFixed(3)} s`);
    lines.push(`  Recalc style:  ${recalcDelta.toFixed(3)} s`);
    lines.push(`  Total tasks:   ${taskDelta.toFixed(3)} s`);
    lines.push(`  Heap (end):    ${heapAfter} MB`);
    lines.push('');
    lines.push('Top 20 hot functions by self time:');
    lines.push(
      `  ${'self ms'.padStart(9)}  ${'total ms'.padStart(9)}  function`,
    );
    for (const fn of hot) {
      lines.push(
        `  ${fn.selfMs.toFixed(1).padStart(9)}  ${fn.totalMs.toFixed(1).padStart(9)}  ${fn.name}  [${fn.source}]`,
      );
    }
    const summary = lines.join('\n') + '\n';
    writeFileSync(join(OUT_DIR, `${demo.name}.summary.txt`), summary);

    console.log(`\n${summary}\nCPU profile written to ${cpuPath}\n`);
  });
}
