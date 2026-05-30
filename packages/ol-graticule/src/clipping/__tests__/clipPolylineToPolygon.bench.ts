import { bench, describe } from 'vitest';
import {
  clipPolylineToPolygon,
  createClipScratch,
} from '../clipPolylineToPolygon.js';
import { PolygonEdgeIndex } from '../PolygonEdgeIndex.js';

function buildBoundary(): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * Math.PI * 2;
    points.push([Math.cos(t) * 100 + 50, Math.sin(t) * 80 + 40]);
  }
  return points;
}

function buildPolylineFlat(n: number): number[] {
  const out: number[] = new Array((n + 1) * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out[i * 2] = -100 + 300 * t;
    out[i * 2 + 1] = -50 + 200 * t;
  }
  return out;
}

const boundary = buildBoundary();
const edgeIndex = new PolygonEdgeIndex([boundary]);
const scratch = createClipScratch();
const polyline50 = buildPolylineFlat(50);
const polyline500 = buildPolylineFlat(500);

describe('clipPolylineToPolygon — typical hot path', () => {
  bench('50-segment polyline against 32-vertex polygon', () => {
    clipPolylineToPolygon(polyline50, 0, polyline50.length, 2, edgeIndex, scratch);
  });

  bench('500-segment polyline against 32-vertex polygon', () => {
    clipPolylineToPolygon(polyline500, 0, polyline500.length, 2, edgeIndex, scratch);
  });
});
