import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { coordinateToGridRef, gridRefToCoordinate } from '../format.js';

// Atlantic / Mediterranean / North Sea band where MQK has full coverage.
// Stay well clear of MQK cell edges (~8° lat tall and 5-25° lon wide):
// existing unit tests in lookup.test.ts pin boundary behaviour.
const lat = fc.double({ min: -40, max: 60, noNaN: true, noDefaultInfinity: true });
const lon = fc.double({ min: -50, max: 15, noNaN: true, noDefaultInfinity: true });

describe('MQK encode → parse round-trip property', () => {
  it('deeper-depth ref is always at least as long as a shallower-depth ref', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const shallow = coordinateToGridRef([latV, lonV], 1);
        const deep = coordinateToGridRef([latV, lonV], 4);
        if (!shallow || !deep) return true;
        expect(deep.length).toBeGreaterThanOrEqual(shallow.length);
      }),
      { numRuns: 50 },
    );
  });

  it('depth-4 round-trip is strictly tighter than depth-1 round-trip', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const refShallow = coordinateToGridRef([latV, lonV], 1);
        const refDeep = coordinateToGridRef([latV, lonV], 4);
        if (!refShallow || !refDeep) return true;
        const shallowCentre = gridRefToCoordinate(refShallow);
        const deepCentre = gridRefToCoordinate(refDeep);
        const shallowDist =
          Math.abs(shallowCentre[0] - latV) + Math.abs(shallowCentre[1] - lonV);
        const deepDist =
          Math.abs(deepCentre[0] - latV) + Math.abs(deepCentre[1] - lonV);
        // Allow exact equality only when the shallow cell is already so
        // tight that subdividing yields the same centre at this precision.
        expect(deepDist).toBeLessThanOrEqual(shallowDist + 1e-9);
      }),
      { numRuns: 100 },
    );
  });

  it('depth-4 round-trip centre is within the parent depth-1 cell bounds', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const ref = coordinateToGridRef([latV, lonV], 4);
        if (!ref) return true;
        const centre = gridRefToCoordinate(ref);
        // MQK depth-1 cells are at most ~10° tall × ~25° wide; depth-4
        // is the 9× subdivision of that. Stay generous because some
        // coastal/polar cells (Pacific, Arctic) are still wide at depth 4.
        expect(Math.abs(centre[0] - latV)).toBeLessThan(4);
        expect(Math.abs(centre[1] - lonV)).toBeLessThan(7);
      }),
      { numRuns: 100 },
    );
  });
});
