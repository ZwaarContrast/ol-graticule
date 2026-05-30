import { bench, describe } from 'vitest';
import { clipPolygonToConvex } from '../clipPolygonToConvex.js';

type Pt = [number, number];

const xLo = 0, yLo = 0, xHi = 10, yHi = 10;
const rectRing: Pt[] = [[xLo, yLo], [xHi, yLo], [xHi, yHi], [xLo, yHi]];

const cellInside: Pt[] = [
  [2, 2], [4, 2], [6, 2],
  [6, 5],
  [6, 8], [4, 8], [2, 8],
  [2, 5],
];

const cellHalf: Pt[] = [
  [4, 4], [9, 4], [14, 4],
  [14, 7],
  [14, 10], [9, 10], [4, 10],
  [4, 7],
];

const cellOutside: Pt[] = [
  [20, 20], [22, 20], [24, 20],
  [24, 22],
  [24, 24], [22, 24], [20, 24],
  [20, 22],
];

describe('clipPolygonToConvex — 8-vertex cell vs 4-vertex rect ring', () => {
  bench('fully inside (no clipping needed)', () => {
    clipPolygonToConvex(cellInside, rectRing);
  });
  bench('half overlap (full Sutherland-Hodgman walk)', () => {
    clipPolygonToConvex(cellHalf, rectRing);
  });
  bench('fully outside (bbox-disjoint early-out)', () => {
    clipPolygonToConvex(cellOutside, rectRing);
  });
});
