import { getTransform } from 'ol/proj';
import type { ProjectionLike } from 'ol/proj';

/** Insert `stepsPerEdge` evenly-spaced points along each edge of `ring`. */
export function densifyRing(
  ring: ReadonlyArray<readonly [number, number]>,
  stepsPerEdge: number,
): [number, number][] {
  const n = ring.length;
  const steps = Math.max(1, stepsPerEdge | 0);
  const out: [number, number][] = new Array(n * steps);
  let w = 0;
  for (let i = 0; i < n; i++) {
    const p0 = ring[i]!;
    const p1 = ring[(i + 1) % n]!;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      out[w++] = [p0[0] + t * dx, p0[1] + t * dy];
    }
  }
  return out;
}

/** Project every vertex of an open ring from `fromProjection` to `toProjection`. */
export function projectRing(
  ring: ReadonlyArray<readonly [number, number]>,
  fromProjection: ProjectionLike,
  toProjection: ProjectionLike,
): [number, number][] {
  const transformFn = getTransform(fromProjection, toProjection);
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const [x, y] = transformFn([p[0], p[1]], undefined, 2);
    if (x === undefined || y === undefined) continue;
    if (!isFinite(x) || !isFinite(y)) continue;
    out.push([x, y]);
  }
  return out;
}
