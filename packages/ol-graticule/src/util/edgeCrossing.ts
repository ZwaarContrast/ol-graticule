/**
 * Geometry for anchoring edge labels to the visible viewport border under view
 * rotation. A rotated viewport is a rotated rectangle, so a label belongs where
 * its line meets that rectangle, not the axis-aligned view extent. Rotate into
 * the frame where the viewport is axis-aligned, place the anchor, rotate back.
 */

/** Squared distance from point `p` to segment `a`–`b`. */
export function distToSegmentSq(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const raw = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  const t = Math.max(0, Math.min(1, raw));
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/**
 * Anchor point (view coords) for an edge label, written into `out`. `cos`/`sin`
 * are of the view rotation about `(cx,cy)`; `vertical` marks a meridian.
 * `target` is the screen edge in the un-rotated frame, `spanLo`-`spanHi` its
 * visible extent, `targetLo`-`targetHi` the viewport's extent on that axis.
 *
 * `extend` projects the line onto the edge; otherwise the anchor clamps to the
 * line's own span. Returns `false` when the crossing falls off the edge or the
 * line runs parallel to it.
 */export function borderAnchor(
  x0: number, y0: number, x1: number, y1: number,
  cx: number, cy: number, cos: number, sin: number,
  vertical: boolean, target: number, spanLo: number, spanHi: number,
  targetLo: number, targetHi: number, extend: boolean,
  out: [number, number],
): boolean {
  // Un-rotate, so the viewport is axis-aligned.
  const dx0 = x0 - cx, dy0 = y0 - cy;
  const dx1 = x1 - cx, dy1 = y1 - cy;
  const rx0 = cx + dx0 * cos + dy0 * sin;
  const ry0 = cy - dx0 * sin + dy0 * cos;
  const rx1 = cx + dx1 * cos + dy1 * sin;
  const ry1 = cy - dx1 * sin + dy1 * cos;

  // Target axis: Y for a meridian, X for a parallel.
  const axis0 = vertical ? ry0 : rx0;
  const axis1 = vertical ? ry1 : rx1;
  const cross0 = vertical ? rx0 : ry0;
  const cross1 = vertical ? rx1 : ry1;

  const lo = Math.min(axis0, axis1);
  const hi = Math.max(axis0, axis1);
  const at = extend ? target : Math.max(lo, Math.min(target, hi));
  if (at < targetLo || at > targetHi) return false;

  const d = axis1 - axis0;
  if (Math.abs(d) < 1e-9) return false;
  const cross = cross0 + ((cross1 - cross0) * (at - axis0)) / d;
  if (cross < spanLo || cross > spanHi) return false;

  const tx = vertical ? cross : at;
  const ty = vertical ? at : cross;

  // Back into view coords.
  const ex = tx - cx, ey = ty - cy;
  out[0] = cx + ex * cos - ey * sin;
  out[1] = cy + ex * sin + ey * cos;
  return true;
}
