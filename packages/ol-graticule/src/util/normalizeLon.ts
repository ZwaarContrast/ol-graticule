/** Wrap a longitude to [-180, 180]; non-finite values pass through. */
export function normalizeLon(lon: number): number {
  if (!Number.isFinite(lon)) return lon;
  if (lon > 180) return lon - 360 * Math.ceil((lon - 180) / 360);
  if (lon < -180) return lon + 360 * Math.ceil((-180 - lon) / 360);
  return lon;
}
