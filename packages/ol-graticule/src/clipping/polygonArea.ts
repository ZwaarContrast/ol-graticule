/** Shoelace area helpers for open polygon rings. */

import type { Coordinate } from 'ol/coordinate';

/**
 * Signed area of an open ring. Positive for CCW. Translation-relative
 * shoelace: every vertex is taken relative to the first, which keeps the
 * products small and the sum numerically stable for large coordinates.
 */
export function signedArea(ring: Coordinate[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  const [ox, oy] = ring[0];
  let twice = 0;
  for (let i = 1, j = 2; j < n; i++, j++) {
    twice +=
      (ring[i][0] - ox) * (ring[j][1] - oy) -
      (ring[j][0] - ox) * (ring[i][1] - oy);
  }
  return twice / 2;
}

/** Absolute polygon area. Returns 0 for degenerate input. */
export function polygonArea(ring: Coordinate[]): number {
  if (ring.length < 3) return 0;
  return Math.abs(signedArea(ring));
}
