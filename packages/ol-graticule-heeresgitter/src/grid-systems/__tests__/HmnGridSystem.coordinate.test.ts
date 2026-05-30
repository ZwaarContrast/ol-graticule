import { describe, expect, it } from 'vitest';

import { HmnGridSystem } from '../HmnGridSystem.js';
import { DhgGridSystem } from '../DhgGridSystem.js';

describe('HmnGridSystem.formatCoordinate / isValidCoordinate', () => {
  it('returns a placeholder reference for a point outside the DHG validity polygon', () => {
    const grid = new HmnGridSystem();
    // Open Pacific in EPSG:3857 metres, far outside any DHG strip.
    const pacific3857: [number, number] = [-17_000_000, 1_500_000];
    const formatted = grid.formatCoordinate(pacific3857, 'EPSG:3857');
    expect(formatted).toHaveProperty('combined');
    if ('combined' in formatted) expect(formatted.combined).toBe('-');
    expect(grid.isValidCoordinate(pacific3857, 'EPSG:3857')).toBe(false);
  });

  it('returns a canonical reference for a point inside the DHG validity polygon', () => {
    const grid = new HmnGridSystem({ maxDepth: 2 });
    const hadres3857: [number, number] = [1_799_725, 6_223_550];
    const formatted = grid.formatCoordinate(hadres3857, 'EPSG:3857');
    expect(formatted).toHaveProperty('combined');
    if ('combined' in formatted) {
      expect(formatted.combined).toMatch(/^[A-HJ-Z]{2}$/);
    }
    expect(grid.isValidCoordinate(hadres3857, 'EPSG:3857')).toBe(true);
  });

  it('memoizes formatCoordinate per (coord, projection) so repeats return the same object', () => {
    const grid = new HmnGridSystem();
    const hadres3857: [number, number] = [1_799_725, 6_223_550];
    const a = grid.formatCoordinate(hadres3857, 'EPSG:3857');
    const b = grid.formatCoordinate(hadres3857, 'EPSG:3857');
    expect(a).toBe(b);
  });

  it('maxDepth=2 is a strict prefix of maxDepth=4 output at the same point', () => {
    const hadres3857: [number, number] = [1_799_725, 6_223_550];
    const k2 = new HmnGridSystem({ maxDepth: 2 }).formatCoordinate(hadres3857, 'EPSG:3857');
    const k4 = new HmnGridSystem({ maxDepth: 4 }).formatCoordinate(hadres3857, 'EPSG:3857');
    if (!('combined' in k2) || !('combined' in k4)) {
      throw new Error('expected combined output from HmnGridSystem');
    }
    expect(k4.combined.startsWith(k2.combined)).toBe(true);
    expect(k4.combined.length).toBeGreaterThan(k2.combined.length);
  });
});

describe('DhgGridSystem.formatCoordinate / isValidCoordinate', () => {
  it('returns axis-formatted placeholders for points outside DHG validity', () => {
    const grid = new DhgGridSystem();
    const pacific3857: [number, number] = [-17_000_000, 1_500_000];
    const formatted = grid.formatCoordinate(pacific3857, 'EPSG:3857');
    expect(formatted).toHaveProperty('x');
    expect(formatted).toHaveProperty('y');
    if ('x' in formatted) {
      expect(formatted.x).toBe('-');
      expect(formatted.y).toBe('-');
    }
    expect(grid.isValidCoordinate(pacific3857, 'EPSG:3857')).toBe(false);
  });

  it('formats a Berlin coordinate as Kennziffer-prefixed easting + plain northing', () => {
    const grid = new DhgGridSystem();
    // Berlin Reichstag (52°31'06"N, 13°22'34"E) in EPSG:3857
    const berlin3857: [number, number] = [1_489_290, 6_894_280];
    const formatted = grid.formatCoordinate(berlin3857, 'EPSG:3857');
    expect(formatted).toHaveProperty('x');
    expect(formatted).toHaveProperty('y');
    if ('x' in formatted) {
      expect(formatted.x).toMatch(/^3\d{3}$/);
      expect(formatted.y).toMatch(/^\d{4}$/);
    }
    expect(grid.isValidCoordinate(berlin3857, 'EPSG:3857')).toBe(true);
  });
});

describe('HmnGridSystem — public getters and edge labels', () => {
  it('getLabels returns an empty array (DHG underneath carries those)', () => {
    const grid = new HmnGridSystem();
    expect(grid.getLabels([-10, 40, 20, 60], 0.05, 'EPSG:4326')).toEqual([]);
  });

  it('exposes the datumShift the instance was constructed with', () => {
    const grid = new HmnGridSystem();
    expect(grid.datumShift).toBeDefined();
  });

  it('exposes the configured maxDepth (default and overridden)', () => {
    expect(new HmnGridSystem().maxDepth).toBeGreaterThanOrEqual(2);
    expect(new HmnGridSystem({ maxDepth: 2 }).maxDepth).toBe(2);
    expect(new HmnGridSystem({ maxDepth: 4 }).maxDepth).toBe(4);
  });
});

describe('DhgGridSystem — public getters', () => {
  it('exposes the datumShift the instance was constructed with', () => {
    const grid = new DhgGridSystem();
    expect(grid.datumShift).toBeDefined();
  });

  it('exposes the configured zoneBoundaryMode', () => {
    const grid = new DhgGridSystem();
    expect(typeof grid.zoneBoundaryMode).toBe('string');
  });
});
