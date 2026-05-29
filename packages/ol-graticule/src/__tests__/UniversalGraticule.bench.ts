import { bench, describe } from 'vitest';
import Point from 'ol/geom/Point';
import { UniversalGraticule } from '../UniversalGraticule.js';
import { PixelGridSystem } from '../grid-systems/PixelGridSystem.js';

const mockVectorContext = {
  drawFeature: () => {},
};

interface UniversalGraticuleInternal {
  collectEdgeLabels_: (
    worlds: number[],
    extent: [number, number, number, number],
    getLabels: () => unknown[],
  ) => { xCount: number; yCount: number };
  drawLabels_: (
    ctx: { drawFeature: () => void },
    extent: [number, number, number, number],
    resolution: number,
    xCount: number,
    yCount: number,
  ) => void;
  collectCellLabels_: (
    worlds: number[],
    extent: [number, number, number, number],
    getLabels: () => unknown[],
  ) => number;
  drawCellLabels_: (ctx: { drawFeature: () => void }, count: number) => void;
}

describe('UniversalGraticule — Rendering Hot Path', () => {
  const gridSystem = new PixelGridSystem();
  const graticule = new UniversalGraticule({
    gridSystem,
    style: { edgeLabel: true },
  });

  // Vitest benches need access to private rendering helpers; narrow via a
  // typed internal interface rather than `any`.
  const inst = graticule as unknown as UniversalGraticuleInternal;

  const extent: [number, number, number, number] = [0, 0, 1000, 1000];
  const resolution = 1;

  // Pre-generate 1000 labels to simulate a very busy view
  const xLabels = Array.from({ length: 500 }, (_, i) => ({
    point: new Point([i * 2, 500]),
    text: `X-${i}`,
    axis: 'x' as const,
  }));
  const yLabels = Array.from({ length: 500 }, (_, i) => ({
    point: new Point([500, i * 2]),
    text: `Y-${i}`,
    axis: 'y' as const,
  }));
  const allLabels = [...xLabels, ...yLabels];

  const cellLabels = Array.from({ length: 1000 }, (_, i) => ({
    point: new Point([(i % 30) * 33 + 15, Math.floor(i / 30) * 33 + 15]),
    text: `Cell-${i}`,
    cellSizePx: 100,
  }));

  bench('collectEdgeLabels (1000 labels, 1 world)', () => {
    inst.collectEdgeLabels_([0], extent, () => allLabels);
  });

  bench('drawLabels (1000 labels, no culling)', () => {
    // Populate buffers first
    const { xCount, yCount } = inst.collectEdgeLabels_([0], extent, () => allLabels);
    inst.drawLabels_(mockVectorContext, extent, resolution, xCount, yCount);
  });

  bench('collectCellLabels (1000 labels)', () => {
    inst.collectCellLabels_([0], extent, () => cellLabels);
  });

  bench('drawCellLabels (1000 labels)', () => {
    const count = inst.collectCellLabels_([0], extent, () => cellLabels);
    inst.drawCellLabels_(mockVectorContext, count);
  });
});
