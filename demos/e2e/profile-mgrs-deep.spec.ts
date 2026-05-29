import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { blockExternalTiles, tallyHotFunctions, type CpuProfile } from './helpers.js';

/**
 * Deep-zoom MGRS profile: zoom all the way in (subdividing into 1 m grid
 * lines is the worst case), then sweep + pan at that level.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, 'profile-results');

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await blockExternalTiles(page);
});

test('mgrs deep zoom: subdivide all the way in', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/ol-graticule-mgrs/');
  await page.waitForLoadState('domcontentloaded');

  const mapEl = page.locator('#map');
  await expect(mapEl).toBeAttached();
  await page.waitForTimeout(1500);

  const mapBox = await mapEl.boundingBox();
  if (!mapBox) throw new Error('no #map box');
  const cx = mapBox.x + mapBox.width / 2;
  const cy = mapBox.y + mapBox.height / 2;

  // Zoom all the way in until OL refuses to zoom further (maxZoom=12 is
  // the default; we send enough events that the last few become no-ops).
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(180);
  }

  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('Profiler.enable');
  await client.send('Profiler.setSamplingInterval', { interval: 100 });

  const rawBefore = await client.send('Performance.getMetrics');
  const before = new Map(rawBefore.metrics.map((m) => [m.name, m.value]));

  await client.send('Profiler.start');
  const tStart = Date.now();

  // Now do interaction work at deepest zoom: sweep + pan + another zoom in.
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    const x = cx + mapBox.width * 0.15 * Math.sin(t * Math.PI * 4);
    const y = cy + mapBox.height * 0.15 * Math.cos(t * Math.PI * 3);
    await page.mouse.move(x, y);
    await page.waitForTimeout(16);
  }
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3;
    const x0 = cx + 30 * Math.cos(angle);
    const y0 = cy + 30 * Math.sin(angle);
    const x1 = cx - 60 * Math.cos(angle);
    const y1 = cy - 60 * Math.sin(angle);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let s = 1; s <= 8; s++) {
      await page.mouse.move(x0 + ((x1 - x0) * s) / 8, y0 + ((y1 - y0) * s) / 8);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
  // Zoom 3 more steps even deeper, exercising re-subdivision.
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(200);
  }
  for (let i = 0; i < 20; i++) {
    const t = i / 20;
    const x = cx + mapBox.width * 0.1 * Math.cos(t * Math.PI * 4);
    const y = cy + mapBox.height * 0.1 * Math.sin(t * Math.PI * 3);
    await page.mouse.move(x, y);
    await page.waitForTimeout(16);
  }

  const wallMs = Date.now() - tStart;
  const stopped = await client.send('Profiler.stop');
  const rawAfter = await client.send('Performance.getMetrics');
  const after = new Map(rawAfter.metrics.map((m) => [m.name, m.value]));
  await client.detach();

  const profile = stopped.profile as unknown as CpuProfile;
  const hot = tallyHotFunctions(profile, 25);

  const cpuPath = join(OUT_DIR, 'mgrs-deep.cpuprofile');
  writeFileSync(cpuPath, JSON.stringify(profile));

  const scriptDelta = (after.get('ScriptDuration') ?? 0) - (before.get('ScriptDuration') ?? 0);
  const taskDelta = (after.get('TaskDuration') ?? 0) - (before.get('TaskDuration') ?? 0);
  const heapMb = ((after.get('JSHeapUsedSize') ?? 0) / 1024 / 1024).toFixed(2);

  const lines: string[] = [];
  lines.push('Demo: mgrs DEEP ZOOM');
  lines.push(`Wall-clock interaction time: ${wallMs} ms`);
  lines.push(`Script: ${scriptDelta.toFixed(3)} s, Tasks: ${taskDelta.toFixed(3)} s, Heap end: ${heapMb} MB`);
  lines.push('');
  lines.push('Top 25 by self time:');
  lines.push(`  ${'self ms'.padStart(9)}  ${'total ms'.padStart(9)}  function  [source]`);
  for (const fn of hot) {
    lines.push(
      `  ${fn.selfMs.toFixed(1).padStart(9)}  ${fn.totalMs.toFixed(1).padStart(9)}  ${fn.name}  [${fn.source}]`,
    );
  }
  const summary = lines.join('\n') + '\n';
  writeFileSync(join(OUT_DIR, 'mgrs-deep.summary.txt'), summary);
  console.log('\n' + summary + '\n');
});
