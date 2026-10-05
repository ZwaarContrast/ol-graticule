/** OpenLayers grid-system factory for IrishCassini; the theatre data itself is ol-free in `IrishCassini.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { IRISH_CASSINI_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';
import {
  IRISH_CASSINI_CLIP_POLYGON,
  IRISH_CASSINI_CRS,
  IRISH_CASSINI_PROJ4,
} from './IrishCassini.js';

export type IrishCassiniGridSystemOptions = MBSGridSystemOptions;

export function createIrishCassiniGridSystem(
  options?: IrishCassiniGridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    IRISH_CASSINI_CRS,
    IRISH_CASSINI_PROJ4,
    IRISH_CASSINI_SCHEME,
    IRISH_CASSINI_CLIP_POLYGON,
    options,
  );
}
