/** OpenLayers grid-system factory for ItalianSouthern; the theatre data itself is ol-free in `ItalianSouthern.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { ITALIAN_SOUTHERN_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';
import {
  ITALIAN_SOUTHERN_CLIP_POLYGON,
  ITALIAN_SOUTHERN_CRS,
  ITALIAN_SOUTHERN_PROJ4,
} from './ItalianSouthern.js';

export type ItalianSouthernGridSystemOptions = MBSGridSystemOptions;

export function createItalianSouthernGridSystem(
  options?: ItalianSouthernGridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    ITALIAN_SOUTHERN_CRS,
    ITALIAN_SOUTHERN_PROJ4,
    ITALIAN_SOUTHERN_SCHEME,
    ITALIAN_SOUTHERN_CLIP_POLYGON,
    options,
  );
}
