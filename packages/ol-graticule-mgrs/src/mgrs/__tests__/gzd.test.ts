import { describe, it, expect } from 'vitest';
import { iterateVisibleGzds } from '../gzd.js';

function gzdsIn(extent: [number, number, number, number]): string[] {
  const out: string[] = [];
  for (const g of iterateVisibleGzds(...extent)) {
    out.push(g.zone === 0 ? g.band : `${g.zone}${g.band}`);
  }
  return out.sort();
}

describe('iterateVisibleGzds', () => {
  it('returns the single GZD for a small viewport that fits inside one zone', () => {
    // Paris, ~3km box: should be just 31U.
    const cells = gzdsIn([2.29, 48.85, 2.31, 48.87]);
    expect(cells).toEqual(['31U']);
  });

  it('returns all four corner GZDs at a zone+band intersection', () => {
    // Centred on the equator + zone 31/32 boundary (lon=6, lat=0).
    const cells = gzdsIn([5.5, -0.5, 6.5, 0.5]);
    expect(cells).toContain('31M');
    expect(cells).toContain('31N');
    expect(cells).toContain('32M');
    expect(cells).toContain('32N');
  });

  it('emits 32V (Norway) when the viewport is over south-west Norway', () => {
    const cells = gzdsIn([5, 58, 6, 60]);
    expect(cells).toContain('32V');
    expect(cells).not.toContain('31V'); // 31V doesn't reach east of 3 deg
  });

  it('omits 32X / 34X / 36X (Svalbard drops)', () => {
    const cells = gzdsIn([0, 72, 42, 84]);
    // The non-existent zones must not appear.
    expect(cells).not.toContain('32X');
    expect(cells).not.toContain('34X');
    expect(cells).not.toContain('36X');
    // The widened replacements should.
    expect(cells).toContain('31X');
    expect(cells).toContain('33X');
    expect(cells).toContain('35X');
    expect(cells).toContain('37X');
  });

  it('emits UPS Y/Z when viewport extends into the north polar cap', () => {
    const cells = gzdsIn([-180, 84, 180, 90]);
    expect(cells).toContain('Y');
    expect(cells).toContain('Z');
    // Should not include any UTM zones, viewport is purely above 84.
    for (const c of cells) expect(c.length).toBe(1);
  });

  it('emits UPS A/B when viewport extends into the south polar cap', () => {
    const cells = gzdsIn([-180, -90, 180, -81]);
    expect(cells).toContain('A');
    expect(cells).toContain('B');
    for (const c of cells) expect(c.length).toBe(1);
  });

  it('emits both UPS-N and UPS-S along with UTM bands when viewport spans the globe', () => {
    const cells = gzdsIn([-180, -90, 180, 90]);
    expect(cells).toContain('Y');
    expect(cells).toContain('Z');
    expect(cells).toContain('A');
    expect(cells).toContain('B');
    // Plenty of UTM bands too.
    expect(cells).toContain('31U');
    expect(cells).toContain('33X');
  });

  it('Y but not Z when viewport touches only the western half of the north cap', () => {
    const cells = gzdsIn([-170, 85, -10, 89]);
    expect(cells).toContain('Y');
    expect(cells).not.toContain('Z');
  });
});
