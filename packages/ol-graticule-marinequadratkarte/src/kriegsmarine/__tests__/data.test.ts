import { describe, expect, it } from 'vitest';
import {
  irregularSquares,
  largePartialSquares,
  largeRegularSquares,
  partialSquares,
  polygonalSquares,
  twoByFiveSquares,
} from '../data.js';
import type { SquareGroup } from '../types.js';

function allRegularGroups(): SquareGroup[] {
  return [
    ...largeRegularSquares,
    ...largePartialSquares,
    ...irregularSquares,
    ...twoByFiveSquares,
    ...partialSquares,
  ];
}

describe('kriegsmarine data integrity', () => {
  it('every regular SquareGroup has a non-empty ids list', () => {
    for (const group of allRegularGroups()) {
      expect(group.ids.length).toBeGreaterThan(0);
      for (const id of group.ids) {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('all rectangular bounds: NW lat ≥ SE lat (northern hemisphere convention)', () => {
    for (const group of allRegularGroups()) {
      const nwLat = group.nw[0];
      const seLat = group.se[0];
      expect(
        nwLat,
        `Group ${group.ids.join(',')}: NW lat ${nwLat} should be ≥ SE lat ${seLat}`,
      ).toBeGreaterThanOrEqual(seLat);
    }
  });

  it('polygonalSquares each have at least 3 vertices', () => {
    for (const poly of polygonalSquares) {
      expect(poly.poly.length, `Polygon ${poly.id}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('polygonalSquares each have a non-empty id', () => {
    for (const poly of polygonalSquares) {
      expect(poly.id.length).toBeGreaterThan(0);
    }
  });

  it('every cell id is two uppercase letters (with umlauts) optionally followed by digits', () => {
    for (const group of allRegularGroups()) {
      for (const id of group.ids) {
        expect(id, `cell id ${id}`).toMatch(/^[A-ZÄÖÜ][A-ZÄÖÜ][0-9]*$/);
      }
    }
    for (const poly of polygonalSquares) {
      expect(poly.id, `polygon id ${poly.id}`).toMatch(/^[A-ZÄÖÜ][A-ZÄÖÜ][0-9]*$/);
    }
  });

  it('all latitudes are within [-90, 90] and longitudes within [-180, 180]', () => {
    for (const group of allRegularGroups()) {
      for (const corner of [group.nw, group.se]) {
        expect(corner[0]).toBeGreaterThanOrEqual(-90);
        expect(corner[0]).toBeLessThanOrEqual(90);
        expect(corner[1]).toBeGreaterThanOrEqual(-180);
        expect(corner[1]).toBeLessThanOrEqual(180);
      }
    }
  });

  it('all cell ids across all groups are unique', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const group of allRegularGroups()) {
      for (const id of group.ids) {
        if (seen.has(id)) duplicates.push(id);
        seen.add(id);
      }
    }
    for (const poly of polygonalSquares) {
      if (seen.has(poly.id)) duplicates.push(poly.id);
      seen.add(poly.id);
    }
    expect(duplicates).toEqual([]);
  });
});
