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

function buildPolyline(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([-100 + 300 * t, -50 + 200 * t]);
  }
  return out;
}

const boundary = buildBoundary();
const edgeIndex = new PolygonEdgeIndex([boundary]);
const scratch = createClipScratch();
const polyline50 = buildPolyline(50);
const polyline500 = buildPolyline(500);

describe('clipPolylineToPolygon — typical hot path', () => {
  bench('50-segment polyline against 32-vertex polygon', () => {
    clipPolylineToPolygon(polyline50, [boundary], edgeIndex, scratch);
  });

  bench('500-segment polyline against 32-vertex polygon', () => {
    clipPolylineToPolygon(polyline500, [boundary], edgeIndex, scratch);
  });
});
