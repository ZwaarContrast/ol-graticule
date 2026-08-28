import { describe, it, expect } from 'vitest';
import { borderAnchor, distToSegmentSq } from '../edgeCrossing.js';

describe('distToSegmentSq', () => {
  it('is 0 for a point on the segment', () => {
    expect(distToSegmentSq(5, 0, 0, 0, 10, 0)).toBe(0);
  });
  it('is the perpendicular distance squared inside the span', () => {
    expect(distToSegmentSq(5, 3, 0, 0, 10, 0)).toBeCloseTo(9);
  });
  it('clamps to the nearer endpoint outside the span', () => {
    expect(distToSegmentSq(-4, 0, 0, 0, 10, 0)).toBeCloseTo(16);
  });
});

describe('borderAnchor', () => {
  const out: [number, number] = [0, 0];
  const c = { cx: 0, cy: 0 };

  // Visible rectangle spans [-10,10] on both axes in these unrotated cases.
  const LO = -10;
  const HI = 10;

  const EXTEND = true;
  const CLAMP = false;

  describe('no rotation (cos=1, sin=0)', () => {
    it('places a parallel label at the left edge longitude', () => {
      // Horizontal line y=3 spanning x in [-10,10]; left edge at x=-5.
      const ok = borderAnchor(-10, 3, 10, 3, c.cx, c.cy, 1, 0, false, -5, LO, HI, LO, HI, EXTEND, out);
      expect(ok).toBe(true);
      expect(out[0]).toBeCloseTo(-5);
      expect(out[1]).toBeCloseTo(3);
    });

    it('places a meridian label at the top edge latitude', () => {
      // Vertical line x=4 spanning y in [-10,10]; top edge at y=8.
      const ok = borderAnchor(4, -10, 4, 10, c.cx, c.cy, 1, 0, true, 8, LO, HI, LO, HI, EXTEND, out);
      expect(ok).toBe(true);
      expect(out[0]).toBeCloseTo(4);
      expect(out[1]).toBeCloseTo(8);
    });

    it('extend=true projects a clipped line onto the map border', () => {
      // Parallel y=3 spans only x in [2,8]; extended to the left edge x=-5.
      const ok = borderAnchor(2, 3, 8, 3, c.cx, c.cy, 1, 0, false, -5, LO, HI, LO, HI, EXTEND, out);
      expect(ok).toBe(true);
      expect(out[0]).toBeCloseTo(-5);
      expect(out[1]).toBeCloseTo(3);
    });

    it('extend=false anchors a clipped line at its visible end', () => {
      // Same line; without extend it rides its own end at x=2 (inside viewport).
      const ok = borderAnchor(2, 3, 8, 3, c.cx, c.cy, 1, 0, false, -5, LO, HI, LO, HI, CLAMP, out);
      expect(ok).toBe(true);
      expect(out[0]).toBeCloseTo(2);
      expect(out[1]).toBeCloseTo(3);
    });

    it('extend=false rejects when the line end lands outside the viewport', () => {
      // Parallel y=3 spans x in [20,30], entirely right of the viewport.
      expect(borderAnchor(20, 3, 30, 3, c.cx, c.cy, 1, 0, false, -5, LO, HI, LO, HI, CLAMP, out)).toBe(false);
    });

    it('rejects a crossing beyond the visible edge segment', () => {
      // Meridian at x=40 crosses the top edge outside the rect's x-span.
      expect(borderAnchor(40, -10, 40, 10, c.cx, c.cy, 1, 0, true, 8, LO, HI, LO, HI, EXTEND, out)).toBe(false);
    });

    it('rejects a degenerate (parallel-to-axis) line', () => {
      // A "meridian" that is actually horizontal cannot interpolate X at a lat.
      expect(borderAnchor(-5, 3, 5, 3, c.cx, c.cy, 1, 0, true, 8, LO, HI, LO, HI, EXTEND, out)).toBe(false);
    });
  });

  describe('with rotation', () => {
    it('anchor sits on the view line and on the un-rotated edge longitude', () => {
      // Parallel y=3, x in [-10,10]; view rotated 30°; left edge at x=-5.
      const r = Math.PI / 6;
      const cos = Math.cos(r);
      const sin = Math.sin(r);
      const ok = borderAnchor(-10, 3, 10, 3, 0, 0, cos, sin, false, -5, -20, 20, -20, 20, EXTEND, out);
      expect(ok).toBe(true);
      // The anchor lies on the parallel (view coords y=3)...
      expect(out[1]).toBeCloseTo(3);
      // ...and rotating it back by -r puts it on the edge longitude x=-5.
      const backX = out[0] * cos + out[1] * sin;
      expect(backX).toBeCloseTo(-5);
    });
  });
});
