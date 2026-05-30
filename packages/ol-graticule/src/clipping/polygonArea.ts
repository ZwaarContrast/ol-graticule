/** Shoelace area helpers for open polygon rings. */

import type { Coordinate } from 'ol/coordinate';

/** Signed area of an open ring via the shoelace formula. Positive for CCW. */
export function signedArea(ring: Coordinate[]): number {
  const n = ring.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s * 0.5;
}

/** Absolute polygon area. Returns 0 for degenerate input. */
export function polygonArea(ring: Coordinate[]): number {
  if (ring.length < 3) return 0;
  return Math.abs(signedArea(ring));
}
