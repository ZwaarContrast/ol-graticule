/** Shoelace area helpers for open polygon rings. */

import type { Coordinate } from 'ol/coordinate';
import { linearRing } from 'ol/geom/flat/area';

/**
 * Signed area of an open ring. Positive for CCW. Delegates to OL's
 * `linearRing` (translation-relative shoelace, numerically stable for large
 * coords) after flattening the tuple ring. OL's convention is negative for
 * CCW, so the result is negated to keep this contract.
 */
export function signedArea(ring: Coordinate[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  const flat = new Array<number>(n * 2);
  for (let i = 0; i < n; i++) {
    flat[i * 2] = ring[i][0];
    flat[i * 2 + 1] = ring[i][1];
  }
  return -linearRing(flat, 0, flat.length, 2);
}

/** Absolute polygon area. Returns 0 for degenerate input. */
export function polygonArea(ring: Coordinate[]): number {
  if (ring.length < 3) return 0;
  return Math.abs(signedArea(ring));
}
