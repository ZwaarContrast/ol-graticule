/** OpenLayers grid-system factory for BritishCassini; the theatre data itself is ol-free in `BritishCassini.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { BRITISH_CASSINI_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';
import {
  BRITISH_CASSINI_CLIP_POLYGON,
  BRITISH_CASSINI_CRS,
  BRITISH_CASSINI_PROJ4,
} from './BritishCassini.js';

export type BritishCassiniGridSystemOptions = MBSGridSystemOptions;

export function createBritishCassiniGridSystem(
  options?: BritishCassiniGridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    BRITISH_CASSINI_CRS,
    BRITISH_CASSINI_PROJ4,
    BRITISH_CASSINI_SCHEME,
    BRITISH_CASSINI_CLIP_POLYGON,
    options,
  );
}
