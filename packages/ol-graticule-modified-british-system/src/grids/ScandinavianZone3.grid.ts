/** OpenLayers grid-system factory for ScandinavianZone3; the theatre data itself is ol-free in `ScandinavianZone3.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { SCANDINAVIAN_ZONE_3_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';
import {
  SCANDINAVIAN_ZONE_3_CLIP_POLYGON,
  SCANDINAVIAN_ZONE_3_CRS,
  SCANDINAVIAN_ZONE_3_PROJ4,
} from './ScandinavianZone3.js';

export type ScandinavianZone3GridSystemOptions = MBSGridSystemOptions;

export function createScandinavianZone3GridSystem(
  options?: ScandinavianZone3GridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    SCANDINAVIAN_ZONE_3_CRS,
    SCANDINAVIAN_ZONE_3_PROJ4,
    SCANDINAVIAN_ZONE_3_SCHEME,
    SCANDINAVIAN_ZONE_3_CLIP_POLYGON,
    options,
  );
}
