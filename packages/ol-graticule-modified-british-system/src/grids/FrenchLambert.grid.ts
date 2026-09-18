/** OpenLayers grid-system factory for FrenchLambert; the theatre data itself is ol-free in `FrenchLambert.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';
import { ZONES } from './FrenchLambert.js';

export type FrenchLambertGridSystemOptions = MBSGridSystemOptions;

function createFrenchLambert(
  zone: 1 | 2 | 3,
  options?: FrenchLambertGridSystemOptions,
): PolygonClippedGridSystem {
  const spec = ZONES[zone];
  return createMBSGridSystem(
    spec.crs,
    spec.proj4,
    spec.scheme,
    spec.clipPolygon,
    options,
  );
}

export const createFrenchLambert1GridSystem = (
  options?: FrenchLambertGridSystemOptions,
): PolygonClippedGridSystem => createFrenchLambert(1, options);

export const createFrenchLambert2GridSystem = (
  options?: FrenchLambertGridSystemOptions,
): PolygonClippedGridSystem => createFrenchLambert(2, options);

export const createFrenchLambert3GridSystem = (
  options?: FrenchLambertGridSystemOptions,
): PolygonClippedGridSystem => createFrenchLambert(3, options);
