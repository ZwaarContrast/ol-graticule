/** Even-odd ray-casting point-in-ring test on an open ring. */
export function pointInRing(
  x: number,
  y: number,
  ring: ReadonlyArray<readonly [number, number]>,
): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const vi = ring[i]!;
    const vj = ring[j]!;
    const xi = vi[0], yi = vi[1];
    const xj = vj[0], yj = vj[1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

/** Multi-ring PIP with even-odd parity across rings. */
export function pointInRings(
  x: number,
  y: number,
  rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
): boolean {
  let inside = false;
  for (let r = 0; r < rings.length; r++) {
    if (pointInRing(x, y, rings[r]!)) inside = !inside;
  }
  return inside;
}
