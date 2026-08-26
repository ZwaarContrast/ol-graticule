import { describe, it, expect, beforeAll } from 'vitest';
import { addProjection, addCoordinateTransforms } from 'ol/proj';
import Projection from 'ol/proj/Projection';
import type { Extent } from 'ol/extent';
import { ProjectedGridSystem } from '../ProjectedGridSystem.js';

// Degradation gate for the per-line transform cache. Instead of a flaky
// wall-clock threshold, it counts the coordinate transforms `getFeatures`
// actually performs, through a fake curved CRS whose forward transform is a
// counter. The cache's whole job is to eliminate those transforms across repeat
// frames and pans, so the counts are a deterministic, machine-independent proxy
// for the work saved. Break the cache (rebuild every frame) and these fail.

const CRS = 'TEST:CURVE';
const VIEW = 'EPSG:3857';
const CRS_EXTENT: Extent = [0, 0, 100_000, 100_000];
// Offset into a plausible Web Mercator area; curvature so lines densify past 2
// points (a straight map would collapse every line and hide the reuse win).
const OX = 500_000;
const CURVE = 1_500;
const FREQ = 1 / 8_000;

let transformCount = 0;

function countPairs(coords: number[]): number {
  return coords.length / 2;
}

beforeAll(() => {
  addProjection(new Projection({ code: CRS, units: 'm', extent: CRS_EXTENT }));
  addCoordinateTransforms(
    CRS,
    VIEW,
    (input, output, dimension = 2) => {
      transformCount += countPairs(input);
      const out = output ?? new Array<number>(input.length);
      for (let i = 0; i < input.length; i += dimension) {
        const x = input[i]!;
        const y = input[i + 1]!;
        out[i] = OX + x + CURVE * Math.sin(y * FREQ);
        out[i + 1] = OX + y + CURVE * Math.sin(x * FREQ);
      }
      return out;
    },
    (input, output, dimension = 2) => {
      const out = output ?? new Array<number>(input.length);
      for (let i = 0; i < input.length; i += dimension) {
        out[i] = input[i]! - OX;
        out[i + 1] = input[i + 1]! - OX;
      }
      return out;
    },
  );
});

function makeGrid(): ProjectedGridSystem {
  // emitBoundary:false isolates the line cache — the boundary rectangle is not
  // cached and would transform a fixed handful of points every frame.
  return new ProjectedGridSystem({ crs: CRS, extent: CRS_EXTENT, emitBoundary: false });
}

/** Transforms performed by one getFeatures call over a viewport at a resolution. */
function frame(grid: ProjectedGridSystem, extent: Extent, resolution: number): number {
  const before = transformCount;
  grid.getFeatures(extent, resolution, VIEW);
  return transformCount - before;
}

const RES = 40;
// A viewport well inside the CRS extent so pans stay in bounds.
const VIEWPORT: Extent = [OX + 20_000, OX + 20_000, OX + 60_000, OX + 60_000];
function panned(e: Extent, dx: number, dy: number): Extent {
  return [e[0] + dx, e[1] + dy, e[2] + dx, e[3] + dy];
}

describe('ProjectedGridSystem line-transform cache — degradation gate', () => {
  it('reports the transform counts (baseline)', () => {
    const grid = makeGrid();
    const cold = frame(grid, VIEWPORT, RES);
    const repeat = frame(grid, VIEWPORT, RES);
    const smallPan = frame(grid, panned(VIEWPORT, 400, 400), RES); // < one interval
    const bandChange = frame(grid, VIEWPORT, RES * 8); // 3 bands out
    console.log(
      `[line-cache] cold=${cold} repeat=${repeat} smallPan=${smallPan} bandChange=${bandChange}`,
    );
    // A cold render does substantial transform work; a densification blow-up
    // (or collapse) shifts this out of a broad sane band.
    expect(cold).toBeGreaterThan(1_000);
    expect(cold).toBeLessThan(50_000);
  });

  it('a repeat of the identical frame transforms nothing (both caches hit)', () => {
    const grid = makeGrid();
    frame(grid, VIEWPORT, RES);
    expect(frame(grid, VIEWPORT, RES)).toBe(0);
  });

  it('a sub-interval pan reuses transformed lines (only cheap re-probe)', () => {
    const grid = makeGrid();
    const cold = frame(grid, VIEWPORT, RES);
    const pan = frame(grid, panned(VIEWPORT, 400, 400), RES);
    // No new grid line enters, and the window margin already covers the shift,
    // so the pan must not re-transform lines — only the context sag-probe runs.
    expect(pan).toBeLessThan(cold * 0.15);
  });

  it('a band change re-transforms rather than reusing stale geometry (negative control)', () => {
    const grid = makeGrid();
    frame(grid, VIEWPORT, RES);
    const smallPan = frame(grid, panned(VIEWPORT, 400, 400), RES);
    const bandChange = frame(grid, VIEWPORT, RES * 8);
    // Band is part of cache validity: a zoom-band change must rebuild lines at
    // the new sampling density, so it does materially more than an in-band pan's
    // cheap re-probe — proving the counter is live and the cache isn't vacuous.
    expect(bandChange).toBeGreaterThan(smallPan * 2);
  });
});
