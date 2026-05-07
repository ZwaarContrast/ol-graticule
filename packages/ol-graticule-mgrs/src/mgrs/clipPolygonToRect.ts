/** Sutherland-Hodgman polygon clipping against an axis-aligned rectangle, with area and centroid helpers. */

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

/** Polygon absolute area (shoelace formula). */
export function polygonArea(polygon: ReadonlyArray<RectPoint>): number {
  const n = polygon.length;
  if (n < 3) return 0;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i]!;
    const p2 = polygon[(i + 1) % n]!;
    a += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return Math.abs(a) * 0.5;
}

/** Area-weighted centroid of a simple polygon, falling back to vertex mean for degenerate slivers. */
export function polygonCentroid(polygon: ReadonlyArray<RectPoint>): [number, number] {
  const n = polygon.length;
  if (n === 0) return [NaN, NaN];
  if (n === 1) return [polygon[0]![0], polygon[0]![1]];
  let cx = 0;
  let cy = 0;
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i]!;
    const p2 = polygon[(i + 1) % n]!;
    const cross = p1[0] * p2[1] - p2[0] * p1[1];
    signedArea += cross;
    cx += (p1[0] + p2[0]) * cross;
    cy += (p1[1] + p2[1]) * cross;
  }
  if (Math.abs(signedArea) < 1e-12) {
    let mx = 0;
    let my = 0;
    for (let i = 0; i < n; i++) {
      mx += polygon[i]![0];
      my += polygon[i]![1];
    }
    return [mx / n, my / n];
  }
  const factor = 1 / (3 * signedArea);
  return [cx * factor, cy * factor];
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
