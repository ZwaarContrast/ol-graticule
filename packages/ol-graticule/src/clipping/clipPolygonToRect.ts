/** Sutherland-Hodgman polygon clipping against an axis-aligned rectangle. */

import { inspectBboxRelToRect } from './bboxFastPath.js';

type RectPoint = readonly [number, number];

/** Clip a closed polygon against an axis-aligned rectangle. */
export function clipPolygonToRect(
  polygon: ReadonlyArray<RectPoint>,
  xLo: number,
  yLo: number,
  xHi: number,
  yHi: number,
): [number, number][] {
  if (polygon.length < 3) return [];
  const { allInside, outsideRect } = inspectBboxRelToRect(polygon, xLo, yLo, xHi, yHi);
  if (outsideRect) return [];
  if (allInside) {
    return polygon.map((p): [number, number] => [p[0], p[1]]);
  }
  let out: [number, number][] = polygon.map((p) => [p[0], p[1]]);
  out = clipEdge_(out, (p) => p[0] >= xLo, (a, b) => intersectVertical_(a, b, xLo));
  if (out.length === 0) return [];
  out = clipEdge_(out, (p) => p[0] <= xHi, (a, b) => intersectVertical_(a, b, xHi));
  if (out.length === 0) return [];
  out = clipEdge_(out, (p) => p[1] >= yLo, (a, b) => intersectHorizontal_(a, b, yLo));
  if (out.length === 0) return [];
  out = clipEdge_(out, (p) => p[1] <= yHi, (a, b) => intersectHorizontal_(a, b, yHi));
  return out;
}

function clipEdge_(
  polygon: ReadonlyArray<[number, number]>,
  inside: (p: RectPoint) => boolean,
  intersect: (a: RectPoint, b: RectPoint) => [number, number],
): [number, number][] {
  const n = polygon.length;
  if (n === 0) return [];
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const prev = polygon[(i + n - 1) % n]!;
    const cur = polygon[i]!;
    const prevIn = inside(prev);
    const curIn = inside(cur);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push([cur[0], cur[1]]);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  return out;
}

function intersectVertical_(a: RectPoint, b: RectPoint, x: number): [number, number] {
  const dx = b[0] - a[0];
  if (dx === 0) return [x, a[1]];
  const t = (x - a[0]) / dx;
  return [x, a[1] + t * (b[1] - a[1])];
}

function intersectHorizontal_(a: RectPoint, b: RectPoint, y: number): [number, number] {
  const dy = b[1] - a[1];
  if (dy === 0) return [a[0], y];
  const t = (y - a[1]) / dy;
  return [a[0] + t * (b[0] - a[0]), y];
}
