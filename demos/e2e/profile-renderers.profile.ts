import { test, type CDPSession, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { blockExternalTiles, tallyHotFunctions, type CpuProfile } from './helpers.js';

// Headless Chromium defaults to SwiftShader (SOFTWARE WebGL), which cripples the
// GL variant while Canvas 2D (CPU) is unaffected — a false ~4x gap. Force the
// real GPU (ANGLE/Metal) so this benchmark measures what users actually get.
test.use({
  launchOptions: {
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  },
});

/**
 * Canvas vs WebGL, head to head, on every demo. For each demo we run the SAME
 * seeded zoom cycle under both renderers (selected via the `demo-renderer`
 * localStorage key the demos read) and report wall time, Script/Layout CPU,
 * frame jank (long/dropped frames from a rAF recorder), the WebGL context count,
 * and the top hot functions. This is the benchmark that quantifies the WebGL
 * variant's cost against the Canvas baseline and tracks regressions.
 *
 *   npx playwright test --config=playwright.profile.config.ts profile-renderers.profile.ts
 *   (results land in demos/e2e/profile-results/renderers-*.txt)
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, 'profile-results');

const DEMOS = [
  { path: '/ol-graticule/', name: 'ol-graticule' },
  { path: '/ol-graticule-rd/', name: 'rd' },
  { path: '/ol-graticule-mgrs/', name: 'mgrs' },
  { path: '/ol-graticule-marinequadratkarte/', name: 'marinequadratkarte' },
  { path: '/ol-graticule-pixel/', name: 'pixel' },
  { path: '/ol-graticule-projected/', name: 'projected' },
  { path: '/ol-graticule-heeresgitter/', name: 'heeresgitter' },
  { path: '/ol-graticule-luftwaffe-planquadrat/', name: 'luftwaffe' },
  { path: '/ol-graticule-modified-british-system/', name: 'mbs' },
] as const;

const RENDERERS = ['canvas', 'webgl'] as const;
type Renderer = (typeof RENDERERS)[number];

const WHEELS = 80;
const PREZOOM = 6; // wheel in first so a min-zoom-gated grid (GSGS) is populated

interface Sample {
  wallMs: number;
  scriptS: number;
  layoutS: number;
  frames: number;
  medianFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  longFrames: number; // frames slower than 50 ms (visible jank)
  fps: number;
  canvases: number;
  hot: { name: string; source: string; selfMs: number }[];
}

async function getMetrics(client: CDPSession): Promise<Record<string, number>> {
  const raw = await client.send('Performance.getMetrics');
  const out: Record<string, number> = {};
  for (const m of raw.metrics) out[m.name] = m.value;
  return out;
}

// Seeded so the wheel sequence is identical across renderers/runs (fair A/B).
async function driveZoomCycles(page: Page, cx: number, cy: number, steps: number): Promise<void> {
  let seed = 0x9e3779b1;
  const rng = (): number => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let level = 0;
  for (let i = 0; i < steps; i++) {
    const dir = level >= 6 ? 1 : level <= -2 ? -1 : rng() < 0.5 ? -1 : 1;
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, dir * 250);
    level += dir < 0 ? 1 : -1;
    await page.waitForTimeout(12 + Math.floor(rng() * 24));
  }
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i] ?? 0;
}

async function measure(page: Page, renderer: Renderer, path: string): Promise<Sample> {
  // Select renderer before any page script runs + install a rAF frame recorder.
  await page.addInitScript((r) => {
    try {
      localStorage.setItem('demo-renderer', r);
    } catch {
      /* ignore */
    }
    const w = window as unknown as { __frames?: number[] };
    w.__frames = [];
    let last = performance.now();
    const tick = (): void => {
      const now = performance.now();
      w.__frames?.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, renderer);

  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#map').waitFor({ state: 'attached' });
  await page.waitForTimeout(1400);

  const box = await page.locator('#map').boundingBox();
  if (!box) throw new Error('no #map box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Populate a min-zoom-gated grid before the measured window.
  for (let i = 0; i < PREZOOM; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -250);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(600);

  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('Profiler.enable');
  await client.send('Profiler.setSamplingInterval', { interval: 80 });

  await page.evaluate(() => {
    (window as unknown as { __frames: number[] }).__frames.length = 0;
  });
  const before = await getMetrics(client);
  await client.send('Profiler.start');
  const t0 = Date.now();

  await driveZoomCycles(page, cx, cy, WHEELS);

  const wallMs = Date.now() - t0;
  const stopped = await client.send('Profiler.stop');
  const after = await getMetrics(client);
  const frames: number[] = await page.evaluate(
    () => (window as unknown as { __frames: number[] }).__frames.slice(),
  );
  const canvases = await page.evaluate(() => document.querySelectorAll('canvas').length);
  await client.detach();

  const hot = tallyHotFunctions(stopped.profile as unknown as CpuProfile, 12)
    .filter((f) => f.name !== '(idle)' && f.name !== '(program)')
    .slice(0, 8)
    .map((f) => ({ name: f.name, source: f.source, selfMs: f.selfMs }));

  const sorted = [...frames].sort((a, b) => a - b);
  const total = frames.reduce((s, v) => s + v, 0);
  return {
    wallMs,
    scriptS: (after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0),
    layoutS: (after.LayoutDuration ?? 0) - (before.LayoutDuration ?? 0),
    frames: frames.length,
    medianFrameMs: pct(sorted, 50),
    p95FrameMs: pct(sorted, 95),
    maxFrameMs: sorted[sorted.length - 1] ?? 0,
    longFrames: frames.filter((d) => d > 50).length,
    fps: total > 0 ? (frames.length / total) * 1000 : 0,
    canvases,
    hot,
  };
}

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

for (const demo of DEMOS) {
  test(`renderers: ${demo.name}`, async ({ browser }) => {
    test.slow();
    const samples: Record<Renderer, Sample> = {} as Record<Renderer, Sample>;
    for (const renderer of RENDERERS) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await blockExternalTiles(page);
      samples[renderer] = await measure(page, renderer, demo.path);
      await context.close();
    }

    const c = samples.canvas;
    const g = samples.webgl;
    const ratio = c.wallMs > 0 ? (g.wallMs / c.wallMs).toFixed(2) : 'n/a';
    const lines: string[] = [];
    lines.push(`==== ${demo.name} (${demo.path}) — ${WHEELS} seeded wheel steps ====`);
    lines.push(
      `             ${'wall ms'.padStart(9)} ${'script s'.padStart(9)} ${'layout s'.padStart(9)} ` +
      `${'fps'.padStart(6)} ${'med ms'.padStart(7)} ${'p95 ms'.padStart(7)} ${'max ms'.padStart(7)} ` +
      `${'jank'.padStart(5)} ${'canv'.padStart(5)}`,
    );
    for (const r of RENDERERS) {
      const s = samples[r];
      lines.push(
        `  ${r.padEnd(10)} ${String(s.wallMs).padStart(9)} ${s.scriptS.toFixed(3).padStart(9)} ` +
        `${s.layoutS.toFixed(3).padStart(9)} ${s.fps.toFixed(1).padStart(6)} ` +
        `${s.medianFrameMs.toFixed(1).padStart(7)} ${s.p95FrameMs.toFixed(1).padStart(7)} ` +
        `${s.maxFrameMs.toFixed(1).padStart(7)} ${String(s.longFrames).padStart(5)} ${String(s.canvases).padStart(5)}`,
      );
    }
    lines.push(`  webgl/canvas wall ratio: ${ratio}x  (< 1.0 = WebGL faster)`);
    lines.push('');
    lines.push('  webgl hot self-time:');
    for (const f of g.hot) lines.push(`    ${f.selfMs.toFixed(1).padStart(8)} ms  ${f.name} [${f.source}]`);
    const summary = lines.join('\n') + '\n';
    writeFileSync(join(OUT_DIR, `renderers-${demo.name}.txt`), summary);
    console.log('\n' + summary);
  });
}
