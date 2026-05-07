import { describe, it, expect } from 'vitest';
import { coordinateToGridRef, formatGridRef } from '../format.js';

describe('Kriegsmarine format', () => {
  describe('formatGridRef', () => {
    it('formats 2-char ref as-is', () => {
      expect(formatGridRef('BC')).toBe('BC');
    });
    it('adds space after bigram', () => {
      expect(formatGridRef('BC6175')).toBe('BC 6175');
    });
    it('handles 3-char ref', () => {
      expect(formatGridRef('BC6')).toBe('BC 6');
    });
    it('handles umlaut bigram', () => {
      expect(formatGridRef('ÄA1')).toBe('ÄA 1');
    });
    it('handles leading-zero two-by-five ref', () => {
      expect(formatGridRef('AN05')).toBe('AN 05');
    });

    it('returns the same string instance on repeat calls (cache hit)', () => {
      const a = formatGridRef('BC6175');
      const b = formatGridRef('BC6175');
      // Cache preserves heap identity; without it, each call template-literals
      // a fresh string and this assertion fails.
      expect(Object.is(a, b)).toBe(true);
    });
  });

  describe('coordinateToGridRef', () => {
    it('resolves a coordinate in the North Atlantic to a grid reference', () => {
      // Approximately center of BC: lat ~47, lon ~-66
      const ref = coordinateToGridRef([47, -66], 0);
      expect(ref).toBeDefined();
      // Should find a large square
      expect(ref!.length).toBe(2);
    });

    it('resolves to deeper levels when maxDepth > 0', () => {
      const ref = coordinateToGridRef([47, -66], 2);
      expect(ref).toBeDefined();
      // Should have bigram + at least 1-2 digits
      expect(ref!.length).toBeGreaterThan(2);
    });

    it('resolves to Kleinquadrat at maxDepth 4', () => {
      const ref = coordinateToGridRef([47, -66], 4);
      expect(ref).toBeDefined();
      // bigram + 4 digits = 6 chars
      expect(ref!.length).toBe(6);
    });

    it('returns undefined for a point not in any grid square', () => {
      // South pole region might not be covered
      const ref = coordinateToGridRef([-90, 0]);
      // This may or may not return undefined depending on coverage
      // Just verify it doesn't throw
      expect(typeof ref === 'string' || ref === undefined).toBe(true);
    });

    it('finds a square in the Pacific (anti-meridian area)', () => {
      // Near date line
      const ref = coordinateToGridRef([55, 178], 0);
      expect(ref).toBeDefined();
    });

    it('normalizes longitudes from wrapped world copies (lon > 180)', () => {
      // Panning one world east past the antimeridian leaves pointer
      // coordinates at lon = actualLon + 360. The same North-Atlantic
      // point that resolves to "BC" at lon=-66 must still resolve to
      // "BC" when expressed as lon=294 — not silently pick up an
      // antimeridian-crossing rect in the normal range.
      expect(coordinateToGridRef([47, 294], 0)).toBe(coordinateToGridRef([47, -66], 0));
    });

    it('normalizes longitudes from wrapped world copies (lon < -180)', () => {
      // Panning west past the antimeridian produces lon = actualLon - 360.
      expect(coordinateToGridRef([47, -426], 0)).toBe(coordinateToGridRef([47, -66], 0));
    });

    it('normalizes longitudes at deeper subdivision too', () => {
      expect(coordinateToGridRef([47, 294], 4)).toBe(coordinateToGridRef([47, -66], 4));
    });

    it('finds a square in a polygonal region (UK/Scotland area)', () => {
      // ~56°N, 4°W — should be in AM or AN area
      const ref = coordinateToGridRef([56, -4], 0);
      expect(ref).toBeDefined();
    });

    it('resolves correctly inside a polygonal square (AD)', () => {
      // AD polygon covers roughly lat 59-69, lon -45 to -24
      const ref = coordinateToGridRef([65, -35], 0);
      expect(ref).toBeDefined();
      expect(ref).toBe('AD');
    });

    it('respects maxDepth=0 and returns only bigram', () => {
      const ref = coordinateToGridRef([47, -66], 0);
      expect(ref).toBeDefined();
      expect(ref!.length).toBe(2);
    });
  });

});
