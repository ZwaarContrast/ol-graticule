import { asArray, asString } from 'ol/color';

/** Re-express a CSS colour string at a new alpha (rgb preserved). */
export function withAlpha(color: string, alpha: number): string {
  const [r, g, b] = asArray(color);
  return asString([r, g, b, alpha]);
}

/** Convert any ColorLike to normalized float [r, g, b, a] in 0..1. */
export function toRgbaNormalized(color: unknown, defaultAlpha = 1): [number, number, number, number] {
  if (typeof color === 'string' || Array.isArray(color)) {
    const c = asArray(color);
    return [(c[0] ?? 0) / 255, (c[1] ?? 0) / 255, (c[2] ?? 0) / 255, c[3] ?? defaultAlpha];
  }
  return [0, 0, 0, defaultAlpha];
}

