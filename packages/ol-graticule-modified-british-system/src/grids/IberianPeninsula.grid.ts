/** OpenLayers grid-system factory for IberianPeninsula; the theatre data itself is ol-free in `IberianPeninsula.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { IBERIAN_PENINSULA_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';
import {
  IBERIAN_PENINSULA_CLIP_POLYGON,
  IBERIAN_PENINSULA_CRS,
  IBERIAN_PENINSULA_PROJ4,
} from './IberianPeninsula.js';

export type IberianPeninsulaGridSystemOptions = MBSGridSystemOptions;

export function createIberianPeninsulaGridSystem(
  options?: IberianPeninsulaGridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    IBERIAN_PENINSULA_CRS,
    IBERIAN_PENINSULA_PROJ4,
    IBERIAN_PENINSULA_SCHEME,
    IBERIAN_PENINSULA_CLIP_POLYGON,
    options,
  );
}
