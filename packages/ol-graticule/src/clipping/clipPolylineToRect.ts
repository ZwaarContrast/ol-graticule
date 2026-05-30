/** Liang-Barsky polyline clipping against an axis-aligned 2D rectangle. */

import { inspectBboxRelToRect } from './bboxFastPath.js';

type ClipPoint = readonly [number, number];

const EPS = 1e-12;

export function clipPolylineToRect(
  polyline: ReadonlyArray<ClipPoint>,
  xLo: number,
  yLo: number,
  xHi: number,
  yHi: number,
): [number, number][][] {
  const out: [number, number][][] = [];
  if (polyline.length < 2) return out;

  const { allInside, outsideRect } = inspectBboxRelToRect(polyline, xLo, yLo, xHi, yHi);
  if (outsideRect) return out;
  if (allInside) {
    out.push(polyline.map((p): [number, number] => [p[0], p[1]]));
    return out;
  }

  let current: [number, number][] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const p0 = polyline[i]!;
    const p1 = polyline[i + 1]!;
    const seg = liangBarsky_(p0, p1, xLo, yLo, xHi, yHi);
    if (seg === null) {
      if (current.length > 1) out.push(current);
      current = [];
      continue;
    }
    const [pa, pb] = seg;
    if (current.length === 0) {
      current.push(pa);
    } else {
      const last = current[current.length - 1]!;
      if (Math.abs(last[0] - pa[0]) > EPS || Math.abs(last[1] - pa[1]) > EPS) {
        if (current.length > 1) out.push(current);
        current = [pa];
      }
    }
    current.push(pb);
  }
  if (current.length > 1) out.push(current);
  return out;
}

function liangBarsky_(
  p0: ClipPoint,
  p1: ClipPoint,
  xLo: number,
  yLo: number,
  xHi: number,
  yHi: number,
): [[number, number], [number, number]] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];

  const ps: [number, number][] = [
    [-dx, p0[0] - xLo],
    [dx, xHi - p0[0]],
    [-dy, p0[1] - yLo],
    [dy, yHi - p0[1]],
  ];
  for (let k = 0; k < 4; k++) {
    const p = ps[k]![0];
    const q = ps[k]![1];
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [
    [p0[0] + t0 * dx, p0[1] + t0 * dy],
    [p0[0] + t1 * dx, p0[1] + t1 * dy],
  ];
}
